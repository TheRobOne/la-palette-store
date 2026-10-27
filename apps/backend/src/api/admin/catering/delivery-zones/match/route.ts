import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadDeliveryZones } from "../../../../../lib/delivery"
import { parsePostalCode } from "../../../../../modules/catering/delivery/postal-code"
import { matchZone } from "../../../../../modules/catering/delivery/quote"
import type { AdminDeliveryZoneMatchQueryType } from "../../../../validators/catering-delivery"

/**
 * `GET /admin/catering/delivery-zones/match?postal_code=` — the "check a
 * postal code" field on the zones page →
 * `{ postal_code, valid, zone: { id, name } | null }`.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminDeliveryZoneMatchQueryType>,
  res: MedusaResponse
) {
  const { postal_code } = req.validatedQuery as AdminDeliveryZoneMatchQueryType
  const code = parsePostalCode(postal_code)
  const zone = code ? matchZone(code, await loadDeliveryZones(req.scope)) : null
  res.json({
    postal_code: code ?? postal_code.trim(),
    valid: !!code,
    zone: zone ? { id: zone.id, name: zone.name } : null,
  })
}
