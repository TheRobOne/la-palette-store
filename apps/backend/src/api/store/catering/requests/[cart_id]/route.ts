import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { toStoreRequest } from "../../../../../lib/request-dto"
import { CATERING_MODULE } from "../../../../../modules/catering"
import type CateringModuleService from "../../../../../modules/catering/service"

/**
 * `GET /store/catering/requests/:cart_id` — the customer's request status
 * page data (contracts/store-api.md §3). The cart id is the customer's handle.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catering: CateringModuleService = req.scope.resolve(CATERING_MODULE)
  const [booking] = await catering.listBookings(
    { cart_id: req.params.cart_id, requires_confirmation: true },
    { order: { created_at: "DESC" }, take: 1 }
  )
  if (!booking) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No request for this cart")
  }
  res.json({ request: toStoreRequest(booking) })
}
