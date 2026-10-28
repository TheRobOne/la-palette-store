import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { refreshCartShippingMethodsWorkflow } from "@medusajs/medusa/core-flows"
import { emitRequestEvent, REQUEST_EVENTS } from "../lib/request-events"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import {
  canConfirm,
  canDecline,
  paymentDeadline,
} from "../modules/catering/scheduling/requests"
import { warsawWallClockToInstant } from "../modules/catering/scheduling/time"

export type DecidePickupRequestInput = {
  id: string
  decision: "confirm" | "decline"
  actor_id?: string | null
  /** required when confirming an out-of-zone delivery, refused otherwise (spec 007) */
  delivery_cost?: number
}

const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)

/** Out of zone = a delivery request sent without a matching zone (snapshot at sending). */
const isOutOfZone = (booking: { fulfillment_method: string; delivery_zone_id?: string | null }) =>
  booking.fulfillment_method === "delivery" && !booking.delivery_zone_id

const conflict = (message: string) =>
  new MedusaError(MedusaError.Types.CONFLICT, message)

/**
 * Staff decision on a request (specs/005-on-request-terms US2): confirm sets
 * the payment deadline (capped at the window start) and, for an out-of-zone
 * delivery, the delivery cost (spec 007 US3); decline ends the request and
 * frees its place. Compensation restores the previous state.
 */
const decidePickupRequestStep = createStep(
  "decide-pickup-request",
  async (input: DecidePickupRequestInput, { container }) => {
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const [booking] = await catering.listBookings({ id: input.id, requires_confirmation: true })
    if (!booking) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Request ${input.id} not found`)
    }
    const previous = {
      id: booking.id,
      status: booking.status,
      payment_deadline: booking.payment_deadline,
      delivery_cost: booking.delivery_cost ?? null,
      decided_at: booking.decided_at,
      decided_by: booking.decided_by,
    }
    const now = new Date()

    if (input.decision === "confirm") {
      if (!canConfirm(booking, now)) {
        throw conflict(
          booking.status === "requested"
            ? "Czas na odpowiedź minął — zapytanie wygasło."
            : "Tego zapytania nie można już potwierdzić."
        )
      }
      const outOfZone = isOutOfZone(booking)
      if (outOfZone && input.delivery_cost === undefined) {
        throw invalid("Podaj koszt dostawy.")
      }
      if (!outOfZone && input.delivery_cost !== undefined) {
        throw invalid("Koszt dostawy podaje się tylko dla dostawy spoza stref.")
      }
      const [schedule] = await catering.listFulfillmentSchedules({
        fulfillment_method: booking.fulfillment_method,
      })
      const updated = await catering.updateBookings({
        id: booking.id,
        status: "confirmed",
        payment_deadline: paymentDeadline(
          now,
          schedule?.request_payment_hours ?? 24,
          warsawWallClockToInstant(booking.date, booking.start_time)
        ),
        decided_at: now,
        decided_by: input.actor_id ?? null,
        ...(outOfZone ? { delivery_cost: input.delivery_cost } : {}),
      })
      await emitRequestEvent(container, REQUEST_EVENTS.confirmed, booking)
      return new StepResponse(updated, previous)
    }

    if (!canDecline(booking)) {
      throw conflict("Tego zapytania nie można już odrzucić.")
    }
    const updated = await catering.updateBookings({
      id: booking.id,
      status: "declined",
      decided_at: now,
      decided_by: input.actor_id ?? null,
    })
    await emitRequestEvent(container, REQUEST_EVENTS.declined, booking)
    return new StepResponse(updated, previous)
  },
  async (previous, { container }) => {
    if (previous) {
      const catering: CateringModuleService = container.resolve(CATERING_MODULE)
      await catering.updateBookings(previous)
    }
  }
)

/**
 * After a delivery cost was set, re-price the request's cart: the pricing
 * hook now reads the confirmed cost (research R-13 d). Nothing to undo.
 */
const repriceRequestCartStep = createStep(
  "reprice-request-cart",
  async (input: DecidePickupRequestInput, { container }) => {
    if (input.decision !== "confirm" || input.delivery_cost === undefined) {
      return new StepResponse(undefined)
    }
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const [booking] = await catering.listBookings({ id: input.id })
    await refreshCartShippingMethodsWorkflow(container).run({
      input: { cart_id: booking.cart_id },
    })
    return new StepResponse(undefined)
  }
)

export const decidePickupRequestWorkflow = createWorkflow(
  "decide-pickup-request",
  (input: DecidePickupRequestInput) => {
    const booking = decidePickupRequestStep(input)
    repriceRequestCartStep(input)
    return new WorkflowResponse(booking)
  }
)
