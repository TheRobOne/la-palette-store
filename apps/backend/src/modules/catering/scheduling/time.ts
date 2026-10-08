/**
 * Wall-clock helpers for Europe/Warsaw (specs/004-pickup-scheduling research
 * R-05). Dates are `YYYY-MM-DD` strings, times `HH:mm`; instants are `Date`.
 * Uses Intl only — no time zone dependency.
 */
export const TIME_ZONE = "Europe/Warsaw"

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function warsawParts(instant: Date) {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((p) => [p.type, p.value])
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Warsaw's UTC offset in minutes at the given instant (+60 winter, +120 summer). */
function offsetMinutes(instant: Date): number {
  const p = warsawParts(instant)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000)
}

export function isValidDate(date: unknown): date is string {
  if (typeof date !== "string") {
    return false
  }
  const m = DATE_RE.exec(date)
  if (!m) {
    return false
  }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === date
}

export function isValidTime(time: unknown): time is string {
  return typeof time === "string" && TIME_RE.test(time)
}

/** Today's date in Warsaw. */
export function warsawToday(now: Date): string {
  const p = warsawParts(now)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/**
 * The instant at which the Warsaw wall clock shows `date time`. The offset
 * is computed for a first guess and corrected once, which handles both DST
 * transitions; a non-existent local time (spring forward) resolves to the
 * instant one hour later, a repeated one (fall back) to the first occurrence.
 */
export function warsawWallClockToInstant(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)

  let instant = guess - offsetMinutes(new Date(guess)) * 60_000
  const corrected = guess - offsetMinutes(new Date(instant)) * 60_000
  if (corrected !== instant) {
    instant = corrected
  }
  return new Date(instant)
}

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 ? 7 : day
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number)
  const [y2, m2, d2] = to.split("-").map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** "20.10.2026" */
export function formatPlDate(date: string): string {
  const [y, m, d] = date.split("-")
  return `${d}.${m}.${y}`
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
