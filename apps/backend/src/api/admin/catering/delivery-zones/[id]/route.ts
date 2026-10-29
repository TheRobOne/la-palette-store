import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadDeliveryZoneDto } from "../../../../../lib/delivery"
import { deleteDeliveryZoneWorkflow } from "../../../../../workflows/delete-delivery-zone"
import { saveDeliveryZoneWorkflow } from "../../../../../workflows/save-delivery-zone"
import type { AdminDeliveryZoneBodyType } from "../../../../validators/catering-delivery"

/** `POST /admin/catering/delivery-zones/:id` — full replace, codes included. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminDeliveryZoneBodyType>,
  res: MedusaResponse
) {
  const { result } = await saveDeliveryZoneWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ delivery_zone: await loadDeliveryZoneDto(req.scope, result.id) })
}

/** `DELETE /admin/catering/delivery-zones/:id` → `{ id, deleted: true }` */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await deleteDeliveryZoneWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.json(result)
}
