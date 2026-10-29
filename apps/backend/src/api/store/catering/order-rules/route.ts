import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadStoreDeliveryRules } from "../../../../lib/delivery"
import { STOCK_LOCATION_NAME } from "../../../../lib/pickup"
import { CATERING_MODULE } from "../../../../modules/catering"
import type CateringModuleService from "../../../../modules/catering/service"

/**
 * Store-wide order rules for the storefront cart (contract:
 * apps/backend/AGENTS.md → "Kontrakty dla storefrontu").
 *
 * `GET /store/catering/order-rules`
 *
 * The same minimum is enforced on cart completion
 * (src/workflows/hooks/complete-cart-validate.ts); this route only lets the
 * cart show it before checkout. Delivery (specs/007-delivery-zones
 * contracts/store-api.md §1) is enabled while its schedule is enabled.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const catering: CateringModuleService = req.scope.resolve(CATERING_MODULE)

  const [rules, [deliverySchedule], { data: locations }] = await Promise.all([
    loadStoreDeliveryRules(req.scope),
    catering.listFulfillmentSchedules({ fulfillment_method: "delivery" }),
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
      min_order_value: rules.globalMinimum,
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
        delivery: {
          enabled: !!deliverySchedule?.is_enabled,
          free_delivery_threshold: rules.freeThreshold,
        },
      },
    },
  })
}
