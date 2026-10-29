import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deliveryZoneDto, loadDeliveryZoneDto, loadDeliveryZones } from "../../../../lib/delivery"
import { saveDeliveryZoneWorkflow } from "../../../../workflows/save-delivery-zone"
import type { AdminDeliveryZoneBodyType } from "../../../validators/catering-delivery"

/** `GET /admin/catering/delivery-zones` → `{ delivery_zones }`, sorted by name. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const zones = await loadDeliveryZones(req.scope)
  res.json({ delivery_zones: zones.map(deliveryZoneDto) })
}

/** `POST /admin/catering/delivery-zones` → `{ delivery_zone }` (contracts/admin-api.md). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminDeliveryZoneBodyType>,
  res: MedusaResponse
) {
  const { result } = await saveDeliveryZoneWorkflow(req.scope).run({ input: req.validatedBody })
  res.json({ delivery_zone: await loadDeliveryZoneDto(req.scope, result.id) })
}
