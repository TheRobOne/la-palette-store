import type { MedusaContainer } from "@medusajs/framework/types"
import { CATERING_MODULE } from ".."
import { CAPACITY_STATUSES } from "../models/booking"
import type { FulfillmentMethod } from "../models/fulfillment-schedule"
import type CateringModuleService from "../service"
import { windowKey, type ScheduleInputs } from "./availability"

/**
 * Loads everything computeAvailability/checkTerm need for `method` and the
 * dates [from, to] in five small queries. Bookings are counted per date
 * across all methods (kitchen-wide capacity) and per window for `method`
 * only (the delivery limit, spec 007); `excludeBookingIds` lets a reschedule
 * ignore the order's own booking.
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
      { status: CAPACITY_STATUSES, date: { $gte: from, $lte: to } },
      { select: ["id", "date", "start_time", "end_time", "fulfillment_method"] }
    ),
  ])

  const bookingsPerDate: Record<string, number> = {}
  const bookingsPerWindow: Record<string, number> = {}
  for (const booking of bookings) {
    if (excludeBookingIds.includes(booking.id)) {
      continue
    }
    bookingsPerDate[booking.date] = (bookingsPerDate[booking.date] ?? 0) + 1
    if (booking.fulfillment_method === method) {
      const key = windowKey(booking.date, booking.start_time, booking.end_time)
      bookingsPerWindow[key] = (bookingsPerWindow[key] ?? 0) + 1
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
          request_lead_time_hours: schedule.request_lead_time_hours,
        }
      : null,
    windows: windows.map((w) => ({
      weekday: w.weekday,
      start_time: w.start_time,
      end_time: w.end_time,
      requires_confirmation: w.requires_confirmation,
    })),
    blockedDates: blockedDates.map((b) => ({
      date: b.date,
      fulfillment_method: b.fulfillment_method ?? null,
    })),
    bookingsPerDate,
    bookingsPerWindow,
    maxOrdersPerWindow: schedule?.max_orders_per_window ?? null,
    // no settings row yet → nothing can be booked
    dailyCapacity: settings[0]?.daily_capacity ?? 0,
  }
}
