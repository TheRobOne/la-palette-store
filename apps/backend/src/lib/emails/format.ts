import { TIME_ZONE } from "../../modules/catering/scheduling/time"

/**
 * Polish formatting for e-mails (specs/006-transactional-emails
 * contracts/emails.md): dates `pt 24.10.2026`, windows `10:00–11:00`,
 * deadlines in Warsaw time `pt 24.10, 14:30`, amounts `144,00 zł`.
 */

const WEEKDAYS = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt", "sob."]

/** "pt 24.10.2026" for a YYYY-MM-DD calendar date (no time zone shift). */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`
}

/** "10:00–11:00" */
export function formatWindow(start: string, end: string): string {
  return `${start}–${end}`
}

/** "pt 24.10, 14:30" — an instant shown in Warsaw time. */
export function formatDeadline(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const date = `${get("year")}-${get("month")}-${get("day")}`
  return `${formatDate(date).slice(0, -5)}, ${get("hour")}:${get("minute")}`
}

/** "144,00 zł" (amounts are gross PLN in major units). */
export function formatAmount(amount: number): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${amount < 0 ? "-" : ""}${grouped},${cents} zł`
}

/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
