import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { unblockPeriodWorkflow } from "../../../../../workflows/unblock-date"

/** `DELETE /admin/catering/blocked-periods/:id` → `{ period_id, deleted: <days> }` */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await unblockPeriodWorkflow(req.scope).run({ input: req.params.id })
  res.json(result)
}
