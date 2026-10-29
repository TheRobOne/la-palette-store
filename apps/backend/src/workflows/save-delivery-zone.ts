import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { loadDeliveryZones } from "../lib/delivery"
import { CATERING_MODULE } from "../modules/catering"
import { validateZoneInput } from "../modules/catering/delivery/zone-input"
import type CateringModuleService from "../modules/catering/service"

export type SaveDeliveryZoneInput = {
  /** absent = create */
  id?: string
  name: string
  price: number
  min_order_value?: number | null
  postal_codes: string[]
}

type Previous = {
  zone_id: string
  created: boolean
  zone?: { name: string; price: number; min_order_value: number | null }
  codes?: string[]
}

/**
 * Creates a delivery zone or replaces one in full — name, price, minimum and
 * its list of postal codes (specs/007-delivery-zones contracts/admin-api.md).
 * Validation names every invalid entry and the zone that already has a code;
 * the unique index on the code is the safety net. Compensation restores the
 * previous zone (or removes a created one).
 */
const saveDeliveryZoneStep = createStep(
  "save-delivery-zone",
  async (input: SaveDeliveryZoneInput, { container }) => {
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const zones = await loadDeliveryZones(container)
    const current = input.id ? zones.find((z) => z.id === input.id) : undefined
    if (input.id && !current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Delivery zone ${input.id} not found`)
    }

    const validation = validateZoneInput(input, zones)
    if (!validation.ok) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, validation.message)
    }

    const data = {
      name: input.name.trim(),
      price: input.price,
      min_order_value: input.min_order_value ?? null,
    }
    let zoneId: string
    let previous: Previous
    if (current) {
      zoneId = current.id
      previous = {
        zone_id: zoneId,
        created: false,
        zone: { name: current.name, price: current.price, min_order_value: current.min_order_value },
        codes: current.codes,
      }
      await catering.updateDeliveryZones({ id: zoneId, ...data })
      const existing = await catering.listDeliveryZoneCodes({ zone_id: zoneId })
      if (existing.length) {
        await catering.deleteDeliveryZoneCodes(existing.map((c) => c.id))
      }
    } else {
      const created = await catering.createDeliveryZones(data)
      zoneId = created.id
      previous = { zone_id: zoneId, created: true }
    }
    await catering.createDeliveryZoneCodes(
      validation.codes.map((code) => ({ code, zone_id: zoneId }))
    )

    return new StepResponse({ id: zoneId }, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    if (previous.created) {
      await catering.deleteDeliveryZones(previous.zone_id)
      return
    }
    await catering.updateDeliveryZones({ id: previous.zone_id, ...previous.zone })
    const codes = await catering.listDeliveryZoneCodes({ zone_id: previous.zone_id })
    if (codes.length) {
      await catering.deleteDeliveryZoneCodes(codes.map((c) => c.id))
    }
    await catering.createDeliveryZoneCodes(
      (previous.codes ?? []).map((code) => ({ code, zone_id: previous.zone_id }))
    )
  }
)

export const saveDeliveryZoneWorkflow = createWorkflow(
  "save-delivery-zone",
  (input: SaveDeliveryZoneInput) => {
    const zone = saveDeliveryZoneStep(input)
    return new WorkflowResponse(zone)
  }
)
