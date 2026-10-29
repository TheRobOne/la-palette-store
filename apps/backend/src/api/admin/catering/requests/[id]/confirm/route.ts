import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAdminRequests } from "../../../../../../lib/admin-requests"
import { decidePickupRequestWorkflow } from "../../../../../../workflows/decide-pickup-request"
import type { AdminConfirmRequestBodyType } from "../../../../../validators/catering-delivery"

/**
 * `POST /admin/catering/requests/:id/confirm` `{ delivery_cost? }`
 * (005 contracts/admin-api.md; 007: the cost of an out-of-zone delivery).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfirmRequestBodyType>,
  res: MedusaResponse
) {
  await decidePickupRequestWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      decision: "confirm",
      actor_id: req.auth_context?.actor_id,
      delivery_cost: req.validatedBody?.delivery_cost,
    },
  })
  const [request] = await listAdminRequests(req.scope, { ids: [req.params.id] })
  res.json({ request })
}
