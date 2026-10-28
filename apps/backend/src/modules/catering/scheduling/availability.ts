import type { FulfillmentMethod } from "../models/fulfillment-schedule"
import {
  addDays,
  daysBetween,
  isoWeekday,
  warsawToday,
  warsawWallClockToInstant,
} from "./time"

/**
 * Pure availability rules (specs/004-pickup-scheduling data-model.md
 * "Derived: availability"). No I/O: the Store slots route, the completion
 * hook and the Admin reschedule warnings all feed it the same inputs.
 */

export type UnavailableReason =
  | "past"
  | "beyond_horizon"
  | "disabled"
  | "blocked"
  | "closed"
  | "full"
  | "window_full"
  | "lead_time"

export type ScheduleInputs = {
  now: Date
  method: FulfillmentMethod
  /** null when the method has no schedule row → treated as disabled */
  schedule: {
    is_enabled: boolean
    lead_time_hours: number
    booking_horizon_days: number
    /** lead time for on-request windows (spec 005); defaults to lead_time_hours */
    request_lead_time_hours?: number
  } | null
  /** window rules of `method` */
  windows: {
    weekday: number
    start_time: string
    end_time: string
    requires_confirmation?: boolean
  }[]
  /** blocked dates for `method` or for all methods (`fulfillment_method: null`) */
  blockedDates: { date: string; fulfillment_method: string | null }[]
  /** active bookings per date, all methods */
  bookingsPerDate: Record<string, number>
  dailyCapacity: number
  /** most bookings of `method` in one window (spec 007, the driver); null/absent = no limit */
  maxOrdersPerWindow?: number | null
  /** active bookings of `method` per window, keyed by windowKey() */
  bookingsPerWindow?: Record<string, number>
}

/** Why a single window is not offered (spec 007 contracts/store-api.md §5). */
export type WindowReason = "full" | "window_full" | "lead_time"

export type WindowAvailability = {
  start: string
  end: string
  available: boolean
  /** true = on-request window: request without payment, staff confirm (spec 005) */
  requires_confirmation: boolean
  /** null when available */
  reason: WindowReason | null
}

export type DayAvailability = {
  date: string
  available: boolean
  reason: UnavailableReason | null
  windows: WindowAvailability[]
}

export type Term = { date: string; start: string; end: string }

function windowsFor(date: string, inputs: ScheduleInputs) {
  const weekday = isoWeekday(date)
  return inputs.windows
    .filter((w) => w.weekday === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
}

function isBlocked(date: string, inputs: ScheduleInputs) {
  return inputs.blockedDates.some(
    (b) =>
      b.date === date &&
      (b.fulfillment_method === null || b.fulfillment_method === inputs.method)
  )
}

function isFull(date: string, inputs: ScheduleInputs) {
  return (inputs.bookingsPerDate[date] ?? 0) >= inputs.dailyCapacity
}

/** Key of bookingsPerWindow. */
export function windowKey(date: string, start: string, end: string) {
  return `${date}|${start}|${end}`
}

function isWindowFull(date: string, start: string, end: string, inputs: ScheduleInputs) {
  const max = inputs.maxOrdersPerWindow
  if (max === null || max === undefined) {
    return false
  }
  return (inputs.bookingsPerWindow?.[windowKey(date, start, end)] ?? 0) >= max
}

function leadTimeHours(inputs: ScheduleInputs, requiresConfirmation: boolean) {
  const schedule = inputs.schedule
  if (!schedule) {
    return 0
  }
  return requiresConfirmation
    ? (schedule.request_lead_time_hours ?? schedule.lead_time_hours)
    : schedule.lead_time_hours
}

function meetsLeadTime(
  date: string,
  start: string,
  inputs: ScheduleInputs,
  requiresConfirmation = false
) {
  const leadMs = leadTimeHours(inputs, requiresConfirmation) * 3_600_000
  return (
    warsawWallClockToInstant(date, start).getTime() - inputs.now.getTime() >= leadMs
  )
}

/** Date-level reasons that hide every window (checked in this order). */
function dateReason(date: string, inputs: ScheduleInputs): UnavailableReason | null {
  const today = warsawToday(inputs.now)
  if (date < today) {
    return "past"
  }
  if (!inputs.schedule || !inputs.schedule.is_enabled) {
    return "disabled"
  }
  if (daysBetween(today, date) > inputs.schedule.booking_horizon_days) {
    return "beyond_horizon"
  }
  if (isBlocked(date, inputs)) {
    return "blocked"
  }
  if (windowsFor(date, inputs).length === 0) {
    return "closed"
  }
  return null
}

const REASON_ORDER: UnavailableReason[] = [
  "past",
  "disabled",
  "beyond_horizon",
  "blocked",
  "closed",
  "full",
  "window_full",
  "lead_time",
]

/** Availability of every date in [from, to] (inclusive), in order. */
export function computeAvailability(
  inputs: ScheduleInputs & { from: string; to: string }
): DayAvailability[] {
  const days: DayAvailability[] = []

  for (let date = inputs.from; date <= inputs.to; date = addDays(date, 1)) {
    const reason = dateReason(date, inputs)
    if (reason) {
      days.push({ date, available: false, reason, windows: [] })
      continue
    }

    const full = isFull(date, inputs)
    const windows = windowsFor(date, inputs).map((w): WindowAvailability => {
      const requiresConfirmation = !!w.requires_confirmation
      const reason: WindowReason | null = full
        ? "full"
        : isWindowFull(date, w.start_time, w.end_time, inputs)
          ? "window_full"
          : !meetsLeadTime(date, w.start_time, inputs, requiresConfirmation)
            ? "lead_time"
            : null
      return {
        start: w.start_time,
        end: w.end_time,
        available: reason === null,
        requires_confirmation: requiresConfirmation,
        reason,
      }
    })
    const available = windows.some((w) => w.available)

    days.push({
      date,
      available,
      // windows taken by the per-window limit make the day read as full
      reason: available
        ? null
        : windows.some((w) => w.reason === "lead_time")
          ? "lead_time"
          : "full",
      windows,
    })
  }

  return days
}

/** The window rule matching a term exactly (date's weekday, start and end), if any. */
export function findWindow(term: Term, inputs: ScheduleInputs) {
  return windowsFor(term.date, inputs).find(
    (w) => w.start_time === term.start && w.end_time === term.end
  )
}

/** Whether the term's window is "on request" (spec 005 FR-003a); false if no rule matches. */
export function termRequiresConfirmation(term: Term, inputs: ScheduleInputs): boolean {
  return !!findWindow(term, inputs)?.requires_confirmation
}

/**
 * Every rule a single term breaks, in REASON_ORDER (empty = available). A
 * term must match a window rule of its weekday exactly, otherwise "closed".
 */
export function checkTerm(term: Term, inputs: ScheduleInputs): UnavailableReason[] {
  const reasons = new Set<UnavailableReason>()
  const today = warsawToday(inputs.now)

  if (term.date < today) {
    reasons.add("past")
  }
  if (!inputs.schedule || !inputs.schedule.is_enabled) {
    reasons.add("disabled")
  } else if (daysBetween(today, term.date) > inputs.schedule.booking_horizon_days) {
    reasons.add("beyond_horizon")
  }
  if (isBlocked(term.date, inputs)) {
    reasons.add("blocked")
  }
  const matched = findWindow(term, inputs)
  if (!matched) {
    reasons.add("closed")
  }
  if (isFull(term.date, inputs)) {
    reasons.add("full")
  }
  if (isWindowFull(term.date, term.start, term.end, inputs)) {
    reasons.add("window_full")
  }
  if (!meetsLeadTime(term.date, term.start, inputs, !!matched?.requires_confirmation)) {
    reasons.add("lead_time")
  }

  return REASON_ORDER.filter((r) => reasons.has(r))
}
