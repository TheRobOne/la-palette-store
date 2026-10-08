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
  | "lead_time"

export type ScheduleInputs = {
  now: Date
  method: FulfillmentMethod
  /** null when the method has no schedule row → treated as disabled */
  schedule: {
    is_enabled: boolean
    lead_time_hours: number
    booking_horizon_days: number
  } | null
  /** window rules of `method` */
  windows: { weekday: number; start_time: string; end_time: string }[]
  /** blocked dates for `method` or for all methods (`fulfillment_method: null`) */
  blockedDates: { date: string; fulfillment_method: string | null }[]
  /** active bookings per date, all methods */
  bookingsPerDate: Record<string, number>
  dailyCapacity: number
}

export type WindowAvailability = { start: string; end: string; available: boolean }

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

function meetsLeadTime(date: string, start: string, inputs: ScheduleInputs) {
  const leadMs = (inputs.schedule?.lead_time_hours ?? 0) * 3_600_000
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
    const windows = windowsFor(date, inputs).map((w) => ({
      start: w.start_time,
      end: w.end_time,
      available: !full && meetsLeadTime(date, w.start_time, inputs),
    }))
    const available = windows.some((w) => w.available)

    days.push({
      date,
      available,
      reason: available ? null : full ? "full" : "lead_time",
      windows,
    })
  }

  return days
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
  const matchesWindow = windowsFor(term.date, inputs).some(
    (w) => w.start_time === term.start && w.end_time === term.end
  )
  if (!matchesWindow) {
    reasons.add("closed")
  }
  if (isFull(term.date, inputs)) {
    reasons.add("full")
  }
  if (!meetsLeadTime(term.date, term.start, inputs)) {
    reasons.add("lead_time")
  }

  return REASON_ORDER.filter((r) => reasons.has(r))
}
