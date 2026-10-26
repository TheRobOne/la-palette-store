import {
  addDays,
  TIME_ZONE,
  warsawToday,
  warsawWallClockToInstant,
} from "../../modules/catering/scheduling/time"

/** Reminders go out from this Warsaw hour on, the day before the pickup. */
export const REMINDER_FROM_HOUR = 8
const DAY_MS = 24 * 3_600_000

type BookingLike = {
  order_id?: string | null
  status: string
  date: string
  start_time: string
}

export function warsawHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now)
  )
}

/** The Warsaw date the reminders are for: tomorrow. */
export const reminderDate = (now: Date) => addDays(warsawToday(now), 1)

/**
 * Orders to remind (spec 006 FR-006): after 08:00 Warsaw time, active
 * bookings with an order for tomorrow, unless the order was placed less than
 * 24 h before its window starts (the confirmation is fresh enough).
 */
export function selectPickupReminders(
  bookings: BookingLike[],
  orderPlacedAt: Map<string, Date | string>,
  now: Date
): { order_id: string; date: string }[] {
  if (warsawHour(now) < REMINDER_FROM_HOUR) {
    return []
  }
  const date = reminderDate(now)
  return bookings
    .filter((b) => b.status === "active" && b.order_id && b.date === date)
    .filter((b) => {
      const placed = orderPlacedAt.get(b.order_id!)
      if (!placed) {
        return false
      }
      const windowStart = warsawWallClockToInstant(b.date, b.start_time).getTime()
      return windowStart - new Date(placed).getTime() >= DAY_MS
    })
    .map((b) => ({ order_id: b.order_id!, date: b.date }))
}
