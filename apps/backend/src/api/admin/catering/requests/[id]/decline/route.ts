import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAdminRequests } from "../../../../../../lib/admin-requests"
import { decidePickupRequestWorkflow } from "../../../../../../workflows/decide-pickup-request"

/** `POST /admin/catering/requests/:id/decline` (contracts/admin-api.md). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await decidePickupRequestWorkflow(req.scope).run({
    input: { id: req.params.id, decision: "decline", actor_id: req.auth_context?.actor_id },
  })
  const [request] = await listAdminRequests(req.scope, { ids: [req.params.id] })
  res.json({ request })
}
