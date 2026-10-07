import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { unblockDateWorkflow } from "../../../../../workflows/unblock-date"

/** `DELETE /admin/catering/blocked-dates/:id` → `{ id, deleted: true }` */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await unblockDateWorkflow(req.scope).run({ input: req.params.id })
  res.json(result)
}
