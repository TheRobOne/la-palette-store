import type { MedusaContainer } from "@medusajs/framework/types"
import { CATERING_MODULE } from "../modules/catering"
import type { FulfillmentMethod } from "../modules/catering/models/fulfillment-schedule"
import type CateringModuleService from "../modules/catering/service"

/** The Admin schedule DTO (contracts/admin-api.md Schedule). */
export async function loadScheduleDto(container: MedusaContainer, method: FulfillmentMethod) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const [[settings], [schedule], windows] = await Promise.all([
    catering.listSchedulingSettings({}, { take: 1 }),
    catering.listFulfillmentSchedules({ fulfillment_method: method }),
    catering.listWindowRules({ fulfillment_method: method }),
  ])

  return {
    method,
    is_enabled: schedule?.is_enabled ?? false,
    lead_time_hours: schedule?.lead_time_hours ?? 48,
    request_lead_time_hours: schedule?.request_lead_time_hours ?? 72,
    request_response_hours: schedule?.request_response_hours ?? 24,
    request_payment_hours: schedule?.request_payment_hours ?? 24,
    booking_horizon_days: schedule?.booking_horizon_days ?? 60,
    daily_capacity: settings?.daily_capacity ?? 0,
    windows: windows
      .map((w) => ({
        weekday: w.weekday,
        start: w.start_time,
        end: w.end_time,
        requires_confirmation: w.requires_confirmation,
      }))
      .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)),
  }
}
