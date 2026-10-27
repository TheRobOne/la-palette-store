import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadStoreDeliveryRules, quoteForPostalCode } from "../../../../lib/delivery"
import type { StoreDeliveryQuoteQueryType } from "../../../validators/catering-delivery"

/**
 * Delivery price for a postal code (specs/007-delivery-zones
 * contracts/store-api.md §4).
 *
 * `GET /store/catering/delivery-quote?postal_code=XX-XXX[&cart_id=…]`
 *
 * With a cart the amount accounts for the free-delivery threshold and a
 * staff-confirmed out-of-zone cost. Uncached — zones change in the Admin.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryQuoteQueryType>,
  res: MedusaResponse
) {
  const { postal_code, cart_id } = req.validatedQuery as StoreDeliveryQuoteQueryType

  let itemTotal: unknown = 0
  if (cart_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "item_total"],
      filters: { id: cart_id },
    })
    itemTotal = data[0]?.item_total ?? 0
  }

  const [quote, rules] = await Promise.all([
    quoteForPostalCode(req.scope, postal_code, {
      itemTotal: itemTotal as number,
      cartId: cart_id,
    }),
    loadStoreDeliveryRules(req.scope),
  ])

  res.status(200).json({
    delivery_quote: { ...quote, free_delivery_threshold: rules.freeThreshold },
  })
}
