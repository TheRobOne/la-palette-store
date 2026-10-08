/**
 * Idempotent default pickup schedule (specs/004-pickup-scheduling FR-014):
 * daily capacity 10, lead time 48 h, booking horizon 60 days, windows
 * Tuesday–Sunday hourly 10:00–18:00. Creates only what is missing and never
 * overwrites staff changes. Called from seed.ts; can also run on its own:
 *
 *   npx medusa exec ./src/scripts/setup-pickup-schedule.ts
 */
import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

const METHOD = "pickup" as const
const DEFAULT_CAPACITY = 10
const DEFAULT_LEAD_TIME_HOURS = 48
const DEFAULT_HORIZON_DAYS = 60
const DEFAULT_WEEKDAYS = [2, 3, 4, 5, 6, 7] // Tuesday–Sunday
const DEFAULT_HOURS = [10, 11, 12, 13, 14, 15, 16, 17] // windows start 10:00 … 17:00

const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`

export async function setupPickupSchedule(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  const [settings] = await catering.listSchedulingSettings({}, { take: 1 })
  if (!settings) {
    await catering.createSchedulingSettings({ daily_capacity: DEFAULT_CAPACITY })
    logger.info(`Created scheduling settings (daily capacity ${DEFAULT_CAPACITY}).`)
  }

  const [schedule] = await catering.listFulfillmentSchedules({ fulfillment_method: METHOD })
  if (!schedule) {
    await catering.createFulfillmentSchedules({
      fulfillment_method: METHOD,
      is_enabled: true,
      lead_time_hours: DEFAULT_LEAD_TIME_HOURS,
      booking_horizon_days: DEFAULT_HORIZON_DAYS,
    })
    logger.info("Created pickup schedule (48 h lead time, 60 days horizon).")
  }

  const existingWindows = await catering.listWindowRules(
    { fulfillment_method: METHOD },
    { take: 1 }
  )
  if (existingWindows.length === 0) {
    await catering.createWindowRules(
      DEFAULT_WEEKDAYS.flatMap((weekday) =>
        DEFAULT_HOURS.map((hour) => ({
          fulfillment_method: METHOD,
          weekday,
          start_time: hh(hour),
          end_time: hh(hour + 1),
        }))
      )
    )
    logger.info("Created default pickup windows (Tue–Sun, hourly 10:00–18:00).")
  } else {
    logger.info("Pickup schedule already configured.")
  }
}

export default async function run({ container }: ExecArgs) {
  await setupPickupSchedule(container)
}
