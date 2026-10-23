import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toStoreRequest } from "../../../../lib/request-dto"
import { sendPickupRequestWorkflow } from "../../../../workflows/send-pickup-request"
import type { StoreSendRequestBodyType } from "../../../validators/catering-scheduling"

/**
 * `POST /store/catering/requests { cart_id }` — send a request for an
 * on-request term without payment (specs/005-on-request-terms/contracts/store-api.md §2).
 */
export async function POST(
  req: MedusaRequest<StoreSendRequestBodyType>,
  res: MedusaResponse
) {
  const { result } = await sendPickupRequestWorkflow(req.scope).run({
    input: { cart_id: req.validatedBody.cart_id },
  })
  res.json({ request: toStoreRequest(result) })
}
