import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { findOrderBooking } from "../lib/order-booking"
import { withCapacityLock } from "../lib/pickup-booking"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import { CATERING_TERM_METADATA_KEY } from "../modules/catering/scheduling/term"

export type RescheduleOrderPickupInput = {
  order_id: string
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
}

/**
 * Moves an order's pickup term (spec US5, FR-015). Rule checks and the
 * staff confirmation happen in the route; this step applies the change under
 * the new date's capacity lock, keeps the previous term on the booking and
 * mirrors the term into order.metadata.catering_term. Compensation restores
 * both.
 */
const rescheduleOrderPickupStep = createStep(
  "reschedule-order-pickup",
  async (input: RescheduleOrderPickupInput, { container }) => {
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const orderModule = container.resolve(Modules.ORDER)

    const booking = await findOrderBooking(container, input.order_id)
    if (!booking || booking.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order ${input.order_id} has no active pickup booking`
      )
    }
    const order = await orderModule.retrieveOrder(input.order_id, { select: ["id", "metadata"] })

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
      orderMetadata: order.metadata ?? null,
    }

    const updated = await withCapacityLock(container, input.date, async () => {
      const result = await catering.updateBookings({
        id: booking.id,
        order_id: input.order_id,
        date: input.date,
        start_time: input.start,
        end_time: input.end,
        previous_date: booking.date,
        previous_start_time: booking.start_time,
        previous_end_time: booking.end_time,
        rescheduled_at: new Date(),
      })
      await orderModule.updateOrders(input.order_id, {
        metadata: {
          ...(order.metadata ?? {}),
          [CATERING_TERM_METADATA_KEY]: {
            method: booking.fulfillment_method,
            date: input.date,
            start: input.start,
            end: input.end,
          },
        },
      })
      return result
    })

    return new StepResponse(updated, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    await catering.updateBookings(previous.booking)
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
