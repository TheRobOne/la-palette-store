import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { assertCartOrderRules } from "../../lib/cart-order-checks"
import { assertDeliveryAmount } from "../../lib/delivery-checks"
import { releasePickupBooking, reservePickupTerm } from "../../lib/pickup-booking"

/**
 * Order rules enforced when a cart is completed, before the order is created
 * and the payment is authorized, in this order: minimum order value →
 * invoice data → term (specs/004-pickup-scheduling) → method and, for
 * delivery, address, postal code, zone minimum and the delivery amount
 * (specs/007-delivery-zones research R-06).
 *
 * A workflow hook accepts only ONE handler, so every future completion rule
 * must be added here rather than in a new file.
 *
 * The pickup term is booked here, under a per-date lock (lib/pickup-booking):
 * a standard window creates an `active` booking; an on-request window
 * (spec 005) needs a confirmed, unexpired, unchanged request, which becomes
 * `active`. The compensation (second argument) undoes either when a later
 * step of the workflow fails, e.g. payment authorization.
 *
 * Rejections are thrown as `invalid_data` → POST /store/carts/:id/complete
 * answers 400 `{ type: "invalid_data", message }` with a Polish,
 * customer-readable message (contract: apps/backend/AGENTS.md).
 */
completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    const { term, delivery } = await assertCartOrderRules(container, cart)
    if (delivery) {
      assertDeliveryAmount(cart.shipping_methods?.[0]?.amount, delivery)
    }
    const compensation = await reservePickupTerm(container, cart, term, delivery)
    return new StepResponse(undefined, compensation)
  },
  async (compensation, { container }) => {
    await releasePickupBooking(compensation, container)
  }
)
