/**
 * Idempotent setup of in-person pickup — the only way orders are fulfilled
 * at launch (constitution: delivery zones are deferred).
 *
 *   stock location "Kuchnia La Palette" (address of the venue)
 *     └─ fulfillment set "Odbiór osobisty" (type pickup)
 *          └─ service zone "Lokal La Palette Garden" (geo zone: PL)
 *               └─ shipping option "Odbiór osobisty", flat 0 zł
 *
 * Every entity is looked up by its stable name and created only if missing;
 * the venue address is overwritten on every run so it stays correct.
 * Called from seed.ts (runs on every deploy); can also run on its own:
 *
 *   npx medusa exec ./src/scripts/setup-pickup.ts
 *
 * Verified against Medusa 2.21.1 source (core-flows / fulfillment module):
 * - listCartOptions filters by geo zones only when the cart has a shipping
 *   address; cart creation pre-fills `country_code: "pl"` (single-country
 *   region), which the PL geo zone below matches;
 * - completeCartWorkflow does not require a street address and creating the
 *   fulfillment in the Admin works with an empty delivery address.
 */
import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createLocationFulfillmentSetWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  updateStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  PICKUP_FULFILLMENT_SET_NAME,
  PICKUP_OPTION_TYPE_CODE,
  PICKUP_SERVICE_ZONE_NAME,
  PICKUP_SHIPPING_OPTION_NAME,
  STOCK_LOCATION_NAME,
  VENUE_ADDRESS,
} from "../lib/pickup"

const COUNTRY_CODE = "pl"
const CURRENCY_CODE = "pln"
const REGION_NAME = "Polska"
const FULFILLMENT_PROVIDER_ID = "manual_manual"

export async function setupPickup(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  // --- Stock location with the venue address ------------------------------
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_sets.id", "fulfillment_sets.name", "fulfillment_sets.type"],
    filters: { name: STOCK_LOCATION_NAME },
  })
  const location = locations[0]
  if (!location) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Stock location "${STOCK_LOCATION_NAME}" not found — run seed.ts first.`
    )
  }

  await updateStockLocationsWorkflow(container).run({
    input: { selector: { id: location.id }, update: { address: VENUE_ADDRESS } },
  })

  // --- Pickup fulfillment set ---------------------------------------------
  let fulfillmentSetId = location.fulfillment_sets?.find(
    (set) => set?.type === "pickup" && set?.name === PICKUP_FULFILLMENT_SET_NAME
  )?.id
  if (!fulfillmentSetId) {
    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: location.id,
        fulfillment_set_data: { name: PICKUP_FULFILLMENT_SET_NAME, type: "pickup" },
      },
    })
    const [created] = await fulfillmentModuleService.listFulfillmentSets({
      name: PICKUP_FULFILLMENT_SET_NAME,
      type: "pickup",
    })
    fulfillmentSetId = created.id
    logger.info(`Created pickup fulfillment set "${PICKUP_FULFILLMENT_SET_NAME}".`)
  }

  // --- Service zone. The PL geo zone is required: every cart gets a
  // shipping address with country_code "pl", and options are filtered by it.
  let [serviceZone] = await fulfillmentModuleService.listServiceZones({
    name: PICKUP_SERVICE_ZONE_NAME,
    fulfillment_set: { id: fulfillmentSetId },
  })
  if (!serviceZone) {
    serviceZone = await fulfillmentModuleService.createServiceZones({
      name: PICKUP_SERVICE_ZONE_NAME,
      fulfillment_set_id: fulfillmentSetId!,
      geo_zones: [{ type: "country", country_code: COUNTRY_CODE }],
    })
    logger.info(`Created service zone "${PICKUP_SERVICE_ZONE_NAME}".`)
  }

  // --- Shipping option "Odbiór osobisty", 0 zł ----------------------------
  const [existingOption] = await fulfillmentModuleService.listShippingOptions({
    name: PICKUP_SHIPPING_OPTION_NAME,
    service_zone: { id: serviceZone.id },
  })
  if (existingOption) {
    logger.info(`Shipping option "${PICKUP_SHIPPING_OPTION_NAME}" already exists.`)
  } else {
    const shippingProfileId = await resolveDefaultShippingProfileId(container)

    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id"],
      filters: { name: REGION_NAME },
    })

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: PICKUP_SHIPPING_OPTION_NAME,
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfileId,
          provider_id: FULFILLMENT_PROVIDER_ID,
          price_type: "flat",
          type: {
            label: "Odbiór osobisty",
            description: `${VENUE_ADDRESS.address_1}, ${VENUE_ADDRESS.postal_code} ${VENUE_ADDRESS.city}`,
            code: PICKUP_OPTION_TYPE_CODE,
          },
          prices: [
            { currency_code: CURRENCY_CODE, amount: 0 },
            ...(regions[0] ? [{ region_id: regions[0].id, amount: 0 }] : []),
          ],
          rules: [
            { attribute: "enabled_in_store", operator: "eq", value: "true" },
            { attribute: "is_return", operator: "eq", value: "false" },
          ],
        },
      ],
    })
    logger.info(`Created shipping option "${PICKUP_SHIPPING_OPTION_NAME}" (0 zł).`)
  }

  // Pickup is the only fulfillment at launch: flag anything else so it is
  // not silently offered to customers (never deleted automatically).
  const others = (
    await fulfillmentModuleService.listShippingOptions(
      {},
      { relations: ["service_zone.fulfillment_set"] }
    )
  ).filter((option) => option.service_zone?.fulfillment_set?.type !== "pickup")
  if (others.length) {
    logger.warn(
      `Non-pickup shipping options exist (${others
        .map((o) => o.name)
        .join(", ")}) — pickup should be the only option at launch.`
    )
  }
}

/**
 * The option must use the same shipping profile as the products, otherwise
 * completing the cart fails ("shipping profiles not satisfied"). seed.ts and
 * seed-catalog.ts both take the first profile, so this does too (and creates
 * it when the database has none yet — seed then reuses it for products).
 */
async function resolveDefaultShippingProfileId(
  container: MedusaContainer
): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  if (profiles[0]) {
    return profiles[0].id
  }

  const { result } = await createShippingProfilesWorkflow(container).run({
    input: { data: [{ name: "Default", type: "default" }] },
  })
  return result[0].id
}

export default async function run({ container }: ExecArgs) {
  await setupPickup(container)
}
