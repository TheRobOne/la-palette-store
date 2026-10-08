import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadMinOrderValue } from "../../../../lib/order-rules"
import { STOCK_LOCATION_NAME } from "../../../../lib/pickup"

/**
 * Store-wide order rules for the storefront cart (contract:
 * apps/backend/AGENTS.md → "Kontrakty dla storefrontu").
 *
 * `GET /store/catering/order-rules`
 *
 * The same minimum is enforced on cart completion
 * (src/workflows/hooks/complete-cart-validate.ts); this route only lets the
 * cart show it before checkout.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [minOrderValue, { data: locations }] = await Promise.all([
    loadMinOrderValue(req.scope),
    query.graph({
      entity: "stock_location",
      fields: [
        "address.address_1",
        "address.postal_code",
        "address.city",
        "address.phone",
      ],
      filters: { name: STOCK_LOCATION_NAME },
    }),
  ])

  const address = locations[0]?.address
  res.status(200).json({
    order_rules: {
      currency_code: "pln",
      min_order_value: minOrderValue,
      fulfillment: {
        pickup: {
          enabled: true,
          address: address
            ? {
                address_1: address.address_1,
                postal_code: address.postal_code,
                city: address.city,
                phone: address.phone,
              }
            : null,
        },
        delivery: { enabled: false },
      },
    },
  })
}
