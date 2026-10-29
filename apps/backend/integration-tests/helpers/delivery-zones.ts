import type { MedusaContainer } from "@medusajs/framework/types"
import { CATERING_MODULE } from "../../src/modules/catering"
import type CateringModuleService from "../../src/modules/catering/service"

/**
 * Fixed test zones in place of the real ones the seed creates
 * (src/scripts/data/delivery-zones.ts), so tests do not change when staff's
 * zone lists do: "Strefa 1" (31-762, 31-763, 31-764, 32-005, 32-010, 32-020 —
 * 30 zł) and "Strefa 2" (30-001, 31-001 — 50 zł). 34-500 is outside both.
 */
export async function useTestDeliveryZones(container: MedusaContainer) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const seeded = await catering.listDeliveryZones({}, { relations: ["codes"] })
  await catering.deleteDeliveryZoneCodes(seeded.flatMap((z) => (z.codes ?? []).map((c) => c.id)))
  await catering.deleteDeliveryZones(seeded.map((z) => z.id))
  for (const zone of [
    { name: "Strefa 1", price: 30, codes: ["31-762", "31-763", "31-764", "32-005", "32-010", "32-020"] },
    { name: "Strefa 2", price: 50, codes: ["30-001", "31-001"] },
  ]) {
    const created = await catering.createDeliveryZones({ name: zone.name, price: zone.price })
    await catering.createDeliveryZoneCodes(zone.codes.map((code) => ({ code, zone_id: created.id })))
  }
}
