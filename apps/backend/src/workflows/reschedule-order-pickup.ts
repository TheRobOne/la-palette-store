import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { findOrderBooking } from "../lib/order-booking"
import { withCapacityLock } from "../lib/pickup-booking"
import { emitPickupRescheduled } from "../lib/request-events"
import { CATERING_MODULE } from "../modules/catering"
import { CAPACITY_STATUSES, type RequestSnapshot } from "../modules/catering/models/booking"
import type CateringModuleService from "../modules/catering/service"
import { CATERING_TERM_METADATA_KEY } from "../modules/catering/scheduling/term"

/** Either an order (004) or a not-yet-paid request by its booking id (spec 005). */
export type RescheduleOrderPickupInput = {
  order_id?: string
  booking_id?: string
  date: string
  start: string
  end: string
}

type Previous = {
  booking: {
    id: string
    date: string
    start_time: string
    end_time: string
    previous_date: string | null
    previous_start_time: string | null
    previous_end_time: string | null
    rescheduled_at: Date | null
  }
  orderMetadata: Record<string, unknown> | null
  // spec 005: a request (no order yet) keeps its term on the cart and snapshot
  cart?: { id: string; metadata: Record<string, unknown> | null }
  requestSnapshot?: unknown
}

/**
 * Moves an order's pickup term (spec US5, FR-015). Rule checks and the
 * staff confirmation happen in the route; this step applies the change under
 * the new date's capacity lock, keeps the previous term on the booking and
 * mirrors the term into order.metadata.catering_term. Compensation restores
 * both. Emits `catering.pickup.rescheduled` for the customer e-mail.
 */
const rescheduleOrderPickupStep = createStep(
  "reschedule-order-pickup",
  async (input: RescheduleOrderPickupInput, { container }) => {
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const orderModule = container.resolve(Modules.ORDER)

    const booking = input.order_id
      ? await findOrderBooking(container, input.order_id)
      : input.booking_id
        ? (await catering.listBookings({ id: input.booking_id }))[0] ?? null
        : null
    if (!booking || !CAPACITY_STATUSES.includes(booking.status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No active pickup booking for ${input.order_id ?? input.booking_id}`
      )
    }
    const orderId = input.order_id ?? booking.order_id ?? null
    const term = {
      method: booking.fulfillment_method,
      date: input.date,
      start: input.start,
      end: input.end,
    }

    const order = orderId
      ? await orderModule.retrieveOrder(orderId, { select: ["id", "metadata"] })
      : null
    const cartModule = container.resolve(Modules.CART)
    const cart = orderId
      ? null
      : await cartModule.retrieveCart(booking.cart_id, { select: ["id", "metadata"] })

    const previous: Previous = {
      booking: {
        id: booking.id,
        date: booking.date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        previous_date: booking.previous_date,
        previous_start_time: booking.previous_start_time,
        previous_end_time: booking.previous_end_time,
        rescheduled_at: booking.rescheduled_at,
      },
      orderMetadata: order?.metadata ?? null,
      ...(cart
        ? {
            cart: { id: cart.id, metadata: cart.metadata ?? null },
            requestSnapshot: booking.request_snapshot,
          }
        : {}),
    }

    const updated = await withCapacityLock(container, input.date, async () => {
      const snapshot = booking.request_snapshot as RequestSnapshot | null
      const result = await catering.updateBookings({
        id: booking.id,
        ...(orderId ? { order_id: orderId } : {}),
        date: input.date,
        start_time: input.start,
        end_time: input.end,
        previous_date: booking.date,
        previous_start_time: booking.start_time,
        previous_end_time: booking.end_time,
        rescheduled_at: new Date(),
        // the request stays payable: its snapshot follows the new term
        ...(snapshot ? { request_snapshot: { ...snapshot, term } } : {}),
      })
      if (order) {
        await orderModule.updateOrders(order.id, {
          metadata: { ...(order.metadata ?? {}), [CATERING_TERM_METADATA_KEY]: term },
        })
      } else if (cart) {
        await cartModule.updateCarts(cart.id, {
          metadata: { ...(cart.metadata ?? {}), [CATERING_TERM_METADATA_KEY]: term },
        })
      }
      return result
    })

    // the customer is told about the new term (spec 006 US4)
    await emitPickupRescheduled(container, {
      id: booking.id,
      cart_id: booking.cart_id,
      order_id: orderId,
      previous: { date: booking.date, start: booking.start_time, end: booking.end_time },
      rescheduled_at: new Date(updated.rescheduled_at ?? Date.now()).toISOString(),
    })

    return new StepResponse(updated, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    await catering.updateBookings({
      ...previous.booking,
      ...(previous.cart ? { request_snapshot: previous.requestSnapshot as Record<string, unknown> } : {}),
    })
    if (previous.cart) {
      await container
        .resolve(Modules.CART)
        .updateCarts(previous.cart.id, { metadata: previous.cart.metadata ?? {} })
      return
    }
    const orderModule = container.resolve(Modules.ORDER)
    const orderId = (await catering.retrieveBooking(previous.booking.id)).order_id
    if (orderId) {
      await orderModule.updateOrders(orderId, { metadata: previous.orderMetadata ?? {} })
    }
  }
)

export const rescheduleOrderPickupWorkflow = createWorkflow(
  "reschedule-order-pickup",
  (input: RescheduleOrderPickupInput) => {
    const booking = rescheduleOrderPickupStep(input)
    return new WorkflowResponse(booking)
  }
)
