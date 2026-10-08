import type { MedusaContainer } from "@medusajs/framework/types"
import { CATERING_MODULE } from ".."
import type { FulfillmentMethod } from "../models/fulfillment-schedule"
import type CateringModuleService from "../service"
import type { ScheduleInputs } from "./availability"

/**
 * Loads everything computeAvailability/checkTerm need for `method` and the
 * dates [from, to] in five small queries. Bookings are counted per date
 * across all methods (kitchen-wide capacity); `excludeBookingIds` lets a
 * reschedule ignore the order's own booking.
 */
export async function loadSchedulingContext(
  container: MedusaContainer,
  {
    method,
    from,
    to,
    now = new Date(),
    excludeBookingIds = [],
  }: {
    method: FulfillmentMethod
    from: string
    to: string
    now?: Date
    excludeBookingIds?: string[]
  }
): Promise<ScheduleInputs> {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  const [settings, schedules, windows, blockedDates, bookings] = await Promise.all([
    catering.listSchedulingSettings({}, { take: 1 }),
    catering.listFulfillmentSchedules({ fulfillment_method: method }),
    catering.listWindowRules({ fulfillment_method: method }),
    catering.listBlockedDates({ date: { $gte: from, $lte: to } }),
    catering.listBookings(
      { status: "active", date: { $gte: from, $lte: to } },
      { select: ["id", "date"] }
    ),
  ])

  const bookingsPerDate: Record<string, number> = {}
  for (const booking of bookings) {
    if (!excludeBookingIds.includes(booking.id)) {
      bookingsPerDate[booking.date] = (bookingsPerDate[booking.date] ?? 0) + 1
    }
  }

  const schedule = schedules[0]
  return {
    now,
    method,
    schedule: schedule
      ? {
          is_enabled: schedule.is_enabled,
          lead_time_hours: schedule.lead_time_hours,
          booking_horizon_days: schedule.booking_horizon_days,
        }
      : null,
    windows: windows.map((w) => ({
      weekday: w.weekday,
      start_time: w.start_time,
      end_time: w.end_time,
    })),
    blockedDates: blockedDates.map((b) => ({
      date: b.date,
      fulfillment_method: b.fulfillment_method ?? null,
    })),
    bookingsPerDate,
    // no settings row yet → nothing can be booked
    dailyCapacity: settings[0]?.daily_capacity ?? 0,
  }
}
