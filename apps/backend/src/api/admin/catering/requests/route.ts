import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAdminRequests } from "../../../../lib/admin-requests"
import type { AdminRequestsQueryType } from "../../../validators/catering-scheduling"

/** `GET /admin/catering/requests?status&from&to` (specs/005-on-request-terms/contracts/admin-api.md). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminRequestsQueryType>,
  res: MedusaResponse
) {
  const { status, from, to } = req.validatedQuery as AdminRequestsQueryType
  res.json({ requests: await listAdminRequests(req.scope, { status, from, to }) })
}
