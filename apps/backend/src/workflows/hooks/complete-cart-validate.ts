import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { assertMinOrderValue, loadMinOrderValue } from "../../lib/order-rules"

/**
 * Order rules enforced when a cart is completed, before the order is created
 * and the payment is authorized.
 *
 * A workflow hook accepts only ONE handler, so every future completion rule
 * (pickup slots, lead time, capacity, invoice data) must be added here
 * rather than in a new file.
 *
 * Rejections are thrown as `invalid_data` → POST /store/carts/:id/complete
 * answers 400 `{ type: "invalid_data", message }` with a Polish,
 * customer-readable message (contract: apps/backend/AGENTS.md).
 */
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const minOrderValue = await loadMinOrderValue(container)
  assertMinOrderValue(cart.item_total, minOrderValue)
})
