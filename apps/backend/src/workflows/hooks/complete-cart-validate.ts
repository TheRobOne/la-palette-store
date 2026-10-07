import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { assertInvoiceData } from "../../lib/invoice"
import { assertMinOrderValue, loadMinOrderValue } from "../../lib/order-rules"
import { releasePickupBooking, reservePickupTerm } from "../../lib/pickup-booking"
import { missingTermError, parseTerm } from "../../modules/catering/scheduling/term"

/**
 * Order rules enforced when a cart is completed, before the order is created
 * and the payment is authorized, in this order: minimum order value →
 * invoice data → pickup term (specs/004-pickup-scheduling).
 *
 * A workflow hook accepts only ONE handler, so every future completion rule
 * must be added here rather than in a new file.
 *
 * The pickup term is booked here, under a per-date lock (lib/pickup-booking);
 * the compensation (second argument) removes that booking when a later step
 * of the workflow fails, e.g. payment authorization.
 *
 * Rejections are thrown as `invalid_data` → POST /store/carts/:id/complete
 * answers 400 `{ type: "invalid_data", message }` with a Polish,
 * customer-readable message (contract: apps/backend/AGENTS.md).
 */
completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    const minOrderValue = await loadMinOrderValue(container)
    assertMinOrderValue(cart.item_total, minOrderValue)
    assertInvoiceData(cart)

    const term = parseTerm(cart.metadata)
    if (!term) {
      throw missingTermError()
    }

    const bookingId = await reservePickupTerm(container, cart.id, term)
    return new StepResponse(undefined, bookingId)
  },
  async (bookingId, { container }) => {
    await releasePickupBooking(bookingId, container)
  }
)
