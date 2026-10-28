import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { assertCartOrderRules, loadCartForChecks } from "../lib/cart-order-checks"
import { bookingDeliveryFields, withCapacityLock } from "../lib/pickup-booking"
import { emitRequestEvent, REQUEST_EVENTS } from "../lib/request-events"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import {
  checkTerm,
  findWindow,
} from "../modules/catering/scheduling/availability"
import { loadSchedulingContext } from "../modules/catering/scheduling/load"
import {
  buildSnapshot,
  notOnRequestError,
  responseDeadline,
} from "../modules/catering/scheduling/requests"
import { unavailableTermError } from "../modules/catering/scheduling/term"
import { warsawWallClockToInstant } from "../modules/catering/scheduling/time"

export type SendPickupRequestInput = { cart_id: string }

/**
 * Sends a request for an on-request term (specs/005-on-request-terms US1):
 * the same order rules as a standard completion, the window must be "on
 * request", and — under the per-date capacity lock — a booking in state
 * `requested` takes a place, with a response deadline and a snapshot of the
 * cart. Idempotent per cart. Compensation removes the booking it created.
 */
const sendPickupRequestStep = createStep(
  "send-pickup-request",
  async (input: SendPickupRequestInput, { container }) => {
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const cart = await loadCartForChecks(container, input.cart_id)
    if (cart.completed_at) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Cart is already completed")
    }
    const { term, delivery } = await assertCartOrderRules(container, cart)

    const { booking, createdId } = await withCapacityLock(container, term.date, async () => {
      const [existing] = await catering.listBookings({
        cart_id: cart.id,
        status: ["requested", "confirmed"],
      })
      if (existing) {
        return { booking: existing, createdId: undefined }
      }

      const now = new Date()
      const context = await loadSchedulingContext(container, {
        method: term.method,
        from: term.date,
        to: term.date,
        now,
      })
      const window = findWindow(term, context)
      // out-of-zone delivery goes to the kitchen on any window (spec 007 FR-010)
      if (window && !window.requires_confirmation && delivery?.status !== "out_of_zone") {
        throw notOnRequestError()
      }
      if (checkTerm(term, context).length > 0) {
        throw unavailableTermError(term)
      }

      const [schedule] = await catering.listFulfillmentSchedules({
        fulfillment_method: term.method,
      })
      const booking = await catering.createBookings({
        cart_id: cart.id,
        fulfillment_method: term.method,
        date: term.date,
        start_time: term.start,
        end_time: term.end,
        status: "requested",
        requires_confirmation: true,
        response_deadline: responseDeadline(
          now,
          schedule?.request_response_hours ?? 24,
          warsawWallClockToInstant(term.date, term.start)
        ),
        request_snapshot: buildSnapshot(cart, term, delivery),
        ...bookingDeliveryFields(delivery),
      })
      return { booking, createdId: booking.id as string | undefined }
    })

    if (createdId) {
      await emitRequestEvent(container, REQUEST_EVENTS.created, booking)
    }
    return new StepResponse(booking, createdId)
  },
  async (createdId, { container }) => {
    if (createdId) {
      const catering: CateringModuleService = container.resolve(CATERING_MODULE)
      await catering.deleteBookings(createdId)
    }
  }
)

export const sendPickupRequestWorkflow = createWorkflow(
  "send-pickup-request",
  (input: SendPickupRequestInput) => {
    const booking = sendPickupRequestStep(input)
    return new WorkflowResponse(booking)
  }
)
