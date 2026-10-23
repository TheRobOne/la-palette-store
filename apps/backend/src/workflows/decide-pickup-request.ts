import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
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
}

const conflict = (message: string) =>
  new MedusaError(MedusaError.Types.CONFLICT, message)

/**
 * Staff decision on a request (specs/005-on-request-terms US2): confirm sets
 * the payment deadline (capped at the window start); decline ends the
 * request and frees its place. Compensation restores the previous state.
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

export const decidePickupRequestWorkflow = createWorkflow(
  "decide-pickup-request",
  (input: DecidePickupRequestInput) => {
    const booking = decidePickupRequestStep(input)
    return new WorkflowResponse(booking)
  }
)
