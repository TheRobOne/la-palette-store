/**
 * Idempotent setup of city delivery (specs/007-delivery-zones research R-11):
 *
 *   stock location "Kuchnia La Palette"
 *     └─ fulfillment set "Dostawa" (type shipping)
 *          └─ service zone "Polska" (geo zone: PL)
 *               └─ shipping option "Dostawa", calculated by catering-delivery
 *
 * plus the delivery schedule (lead time 48 h, max 2 deliveries per window,
 * two-hour windows 10:00–18:00 on the pickup weekdays) and two example zones.
 * Zones decide the price, not Medusa geo zones (research R-01), so the
 * service zone covers all of Poland. Everything is created only if missing
 * and staff changes are never overwritten. The example zones are created
 * only together with the schedule (first run), so deleting them sticks; with
 * APP_ENV=production the schedule starts disabled and gets no example zones
 * (seed.ts runs on every deploy). Called from seed.ts after the pickup setup;
 * can also run on its own:
 *
 *   npx medusa exec ./src/scripts/setup-delivery.ts
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
} from "@medusajs/medusa/core-flows"
import {
  DELIVERY_FULFILLMENT_SET_NAME,
  DELIVERY_OPTION_TYPE_CODE,
  DELIVERY_PROVIDER_ID,
  DELIVERY_SERVICE_ZONE_NAME,
  DELIVERY_SHIPPING_OPTION_NAME,
  STOCK_LOCATION_NAME,
} from "../lib/pickup"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import { resolveDefaultShippingProfileId } from "./setup-pickup"

const COUNTRY_CODE = "pl"
const METHOD = "delivery" as const
const DEFAULT_LEAD_TIME_HOURS = 48
const DEFAULT_MAX_ORDERS_PER_WINDOW = 2
const DEFAULT_WINDOWS = [
  ["10:00", "12:00"],
  ["12:00", "14:00"],
  ["14:00", "16:00"],
  ["16:00", "18:00"],
] as const

/** Example zones for testing until staff enter the real ones (spec Assumptions). */
const EXAMPLE_ZONES = [
  { name: "Strefa 1", price: 30, codes: ["31-762", "31-763", "31-764", "32-005", "32-010", "32-020"] },
  { name: "Strefa 2", price: 50, codes: ["30-001", "31-001"] },
]

export async function setupDelivery(container: MedusaContainer) {
  const production = process.env.APP_ENV === "production"
  await setupDeliveryShippingOption(container)
  const firstRun = await setupDeliverySchedule(container, { enabled: !production })
  if (firstRun && !production) {
    await setupExampleZones(container)
  }
}

async function setupDeliveryShippingOption(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "fulfillment_sets.id",
      "fulfillment_sets.name",
      "fulfillment_sets.type",
      "fulfillment_providers.id",
    ],
    filters: { name: STOCK_LOCATION_NAME },
  })
  const location = locations[0]
  if (!location) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Stock location "${STOCK_LOCATION_NAME}" not found — run seed.ts first.`
    )
  }

  // The location must offer the provider, like it offers manual_manual.
  if (
    !location.fulfillment_providers?.some(
      (provider: { id?: string } | null) => provider?.id === DELIVERY_PROVIDER_ID
    )
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: DELIVERY_PROVIDER_ID },
    })
    logger.info(`Linked fulfillment provider "${DELIVERY_PROVIDER_ID}" to the stock location.`)
  }

  let fulfillmentSetId = location.fulfillment_sets?.find(
    // typed explicitly: CI has no generated .medusa/types
    (set: { type?: string; name?: string } | null) =>
      set?.type === "shipping" && set?.name === DELIVERY_FULFILLMENT_SET_NAME
  )?.id
  if (!fulfillmentSetId) {
    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: location.id,
        fulfillment_set_data: { name: DELIVERY_FULFILLMENT_SET_NAME, type: "shipping" },
      },
    })
    const [created] = await fulfillmentModuleService.listFulfillmentSets({
      name: DELIVERY_FULFILLMENT_SET_NAME,
      type: "shipping",
    })
    fulfillmentSetId = created.id
    logger.info(`Created delivery fulfillment set "${DELIVERY_FULFILLMENT_SET_NAME}".`)
  }

  let [serviceZone] = await fulfillmentModuleService.listServiceZones({
    name: DELIVERY_SERVICE_ZONE_NAME,
    fulfillment_set: { id: fulfillmentSetId },
  })
  if (!serviceZone) {
    serviceZone = await fulfillmentModuleService.createServiceZones({
      name: DELIVERY_SERVICE_ZONE_NAME,
      fulfillment_set_id: fulfillmentSetId!,
      geo_zones: [{ type: "country", country_code: COUNTRY_CODE }],
    })
    logger.info(`Created service zone "${DELIVERY_SERVICE_ZONE_NAME}".`)
  }

  const [existingOption] = await fulfillmentModuleService.listShippingOptions({
    name: DELIVERY_SHIPPING_OPTION_NAME,
    service_zone: { id: serviceZone.id },
  })
  if (existingOption) {
    logger.info(`Shipping option "${DELIVERY_SHIPPING_OPTION_NAME}" already exists.`)
    return
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: DELIVERY_SHIPPING_OPTION_NAME,
        service_zone_id: serviceZone.id,
        shipping_profile_id: await resolveDefaultShippingProfileId(container),
        provider_id: DELIVERY_PROVIDER_ID,
        price_type: "calculated",
        data: { id: "delivery" },
        type: {
          label: "Dostawa",
          description: "Dowozimy pod wskazany adres — cena zależy od strefy (kodu pocztowego).",
          code: DELIVERY_OPTION_TYPE_CODE,
        },
        rules: [
          { attribute: "enabled_in_store", operator: "eq", value: "true" },
          { attribute: "is_return", operator: "eq", value: "false" },
        ],
      },
    ],
  })
  logger.info(`Created shipping option "${DELIVERY_SHIPPING_OPTION_NAME}" (calculated).`)
}

/** Returns true when the schedule was created by this run. */
async function setupDeliverySchedule(
  container: MedusaContainer,
  { enabled }: { enabled: boolean }
): Promise<boolean> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  const [pickup] = await catering.listFulfillmentSchedules({ fulfillment_method: "pickup" })
  const [schedule] = await catering.listFulfillmentSchedules({ fulfillment_method: METHOD })
  if (!schedule) {
    await catering.createFulfillmentSchedules({
      fulfillment_method: METHOD,
      is_enabled: enabled,
      lead_time_hours: DEFAULT_LEAD_TIME_HOURS,
      booking_horizon_days: pickup?.booking_horizon_days ?? 60,
      max_orders_per_window: DEFAULT_MAX_ORDERS_PER_WINDOW,
    })
    logger.info(
      `Created ${enabled ? "enabled" : "disabled"} delivery schedule (48 h lead time, max ${DEFAULT_MAX_ORDERS_PER_WINDOW} per window).`
    )
  }

  const existing = await catering.listWindowRules({ fulfillment_method: METHOD }, { take: 1 })
  if (existing.length) {
    logger.info("Delivery windows already configured.")
    return !schedule
  }
  const pickupWeekdays = [
    ...new Set(
      (await catering.listWindowRules({ fulfillment_method: "pickup" })).map((w) => w.weekday)
    ),
  ].sort()
  await catering.createWindowRules(
    pickupWeekdays.flatMap((weekday) =>
      DEFAULT_WINDOWS.map(([start_time, end_time]) => ({
        fulfillment_method: METHOD,
        weekday,
        start_time,
        end_time,
      }))
    )
  )
  logger.info("Created default delivery windows (pickup weekdays, 2 h from 10:00 to 18:00).")
  return !schedule
}

async function setupExampleZones(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  const [anyZone] = await catering.listDeliveryZones({}, { take: 1 })
  if (anyZone) {
    logger.info("Delivery zones already configured.")
    return
  }
  for (const zone of EXAMPLE_ZONES) {
    const created = await catering.createDeliveryZones({ name: zone.name, price: zone.price })
    await catering.createDeliveryZoneCodes(
      zone.codes.map((code) => ({ code, zone_id: created.id }))
    )
  }
  logger.info(`Created example delivery zones (${EXAMPLE_ZONES.map((z) => z.name).join(", ")}).`)
}

export default async function run({ container }: ExecArgs) {
  await setupDelivery(container)
}
