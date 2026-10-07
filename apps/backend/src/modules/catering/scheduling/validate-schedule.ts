import { MedusaError } from "@medusajs/framework/utils"
import { isValidTime } from "./time"

export type ScheduleInput = {
  is_enabled: boolean
  lead_time_hours: number
  booking_horizon_days: number
  daily_capacity: number
  windows: { weekday: number; start: string; end: string }[]
}

const WEEKDAY_NAMES = ["", "pon.", "wt.", "śr.", "czw.", "pt.", "sob.", "niedz."]

/**
 * Validates a staff schedule update (data-model.md): numeric ranges, valid
 * `HH:mm` windows with start < end, ISO weekdays, and no overlapping or
 * duplicate windows on the same weekday. Throws `invalid_data` with a
 * Polish message shown in the Admin.
 */
export function assertValidSchedule(input: ScheduleInput): void {
  const fail = (message: string): never => {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }

  if (!Number.isInteger(input.daily_capacity) || input.daily_capacity < 0) {
    fail("Limit zamówień na dzień musi być liczbą całkowitą ≥ 0.")
  }
  if (!Number.isInteger(input.lead_time_hours) || input.lead_time_hours < 0) {
    fail("Minimalne wyprzedzenie musi być liczbą całkowitą godzin ≥ 0.")
  }
  if (
    !Number.isInteger(input.booking_horizon_days) ||
    input.booking_horizon_days < 1 ||
    input.booking_horizon_days > 365
  ) {
    fail("Zakres rezerwacji musi wynosić od 1 do 365 dni.")
  }

  for (const w of input.windows) {
    if (!Number.isInteger(w.weekday) || w.weekday < 1 || w.weekday > 7) {
      fail("Dzień tygodnia musi być liczbą od 1 (poniedziałek) do 7 (niedziela).")
    }
    if (!isValidTime(w.start) || !isValidTime(w.end) || w.start >= w.end) {
      fail(
        `Nieprawidłowe okno ${w.start}–${w.end} (${WEEKDAY_NAMES[w.weekday] ?? w.weekday}): ` +
          "godzina rozpoczęcia musi być wcześniejsza niż zakończenia."
      )
    }
  }

  for (let weekday = 1; weekday <= 7; weekday++) {
    const day = input.windows
      .filter((w) => w.weekday === weekday)
      .sort((a, b) => a.start.localeCompare(b.start))
    for (let i = 1; i < day.length; i++) {
      if (day[i].start < day[i - 1].end) {
        fail(
          `Okna ${day[i - 1].start}–${day[i - 1].end} i ${day[i].start}–${day[i].end} ` +
            `(${WEEKDAY_NAMES[weekday]}) nachodzą na siebie.`
        )
      }
    }
  }
}
