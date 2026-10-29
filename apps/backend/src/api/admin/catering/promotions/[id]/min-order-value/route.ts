import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { promotionMinOrderValue } from "../../../../../../lib/promotion-min-order-value"
import { setPromotionMinOrderValueWorkflow } from "../../../../../../workflows/set-promotion-min-order-value"
import type { AdminPromotionMinOrderValueBodyType } from "../../../../../validators/catering-promotions"

/** `GET /admin/catering/promotions/:id/min-order-value` → `{ min_order_value: number | null }` */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "promotion",
    fields: ["id", "rules.attribute", "rules.operator", "rules.values.value"],
    filters: { id: req.params.id },
  })
  if (!data[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Promotion ${req.params.id} not found`)
  }
  res.json({ min_order_value: promotionMinOrderValue(data[0].rules as never) })
}

/** `POST /admin/catering/promotions/:id/min-order-value` `{ min_order_value: number | null }` */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPromotionMinOrderValueBodyType>,
  res: MedusaResponse
) {
  const { result } = await setPromotionMinOrderValueWorkflow(req.scope).run({
    input: { promotion_id: req.params.id, min_order_value: req.validatedBody.min_order_value },
  })
  res.json(result)
}
