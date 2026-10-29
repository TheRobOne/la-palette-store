import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  calculateShippingOptionsPricesWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"
import { type CartForQuote, quoteForCart } from "../../lib/delivery"
import { DELIVERY_AMOUNT_CONTEXT_KEY } from "../../modules/catering-delivery/service"

/**
 * Prices the "Dostawa" shipping option (specs/007-delivery-zones research
 * R-02, R-13): computes the delivery amount from our postal-code zones and
 * passes it to the catering-delivery provider's `calculatePrice`. Registered
 * on both workflows that price calculated options:
 *
 * - listShippingOptionsForCartWithPricingWorkflow — runs inside adding a
 *   shipping method and refreshing a cart's methods, so Medusa re-prices
 *   delivery on every cart update;
 * - calculateShippingOptionsPricesWorkflow — `POST
 *   /store/shipping-options/:id/calculate`, how the storefront reads the
 *   price of a calculated option.
 *
 * Out of zone without a staff price, or an invalid code → 0; the completion
 * hook refuses such carts, and the storefront shows the quote instead.
 */
async function deliveryPricingContext(cartId: string, container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "item_total", "shipping_address.postal_code"],
    filters: { id: cartId },
  })
  const cart = data[0] as CartForQuote | undefined
  if (!cart?.shipping_address?.postal_code) {
    return new StepResponse({})
  }

  const quote = await quoteForCart(container, cart)
  return new StepResponse({ [DELIVERY_AMOUNT_CONTEXT_KEY]: quote.amount ?? 0 })
}

listShippingOptionsForCartWithPricingWorkflow.hooks.setCalculatedShippingPricingContext(
  async ({ input }, { container }) => deliveryPricingContext(input.cart_id, container)
)

calculateShippingOptionsPricesWorkflow.hooks.setCalculatedShippingPricingContext(
  async ({ input }, { container }) => deliveryPricingContext(input.cart_id, container)
)
