/**
 * Tiny fetch wrapper for the /admin/catering/* routes
 * (specs/004-pickup-scheduling/contracts/admin-api.md). Uses the Admin
 * session cookie, like the other widgets in this repo.
 */
export class AdminApiError extends Error {
  constructor(
    public status: number,
    public body: { type?: string; message?: string; warnings?: string[] }
  ) {
    super(body.message ?? `HTTP ${status}`)
  }
}

export async function adminFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "include",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new AdminApiError(response.status, body)
  }
  return body as T
}

export const WEEKDAYS = [
  { value: 1, label: "Poniedziałek" },
  { value: 2, label: "Wtorek" },
  { value: 3, label: "Środa" },
  { value: 4, label: "Czwartek" },
  { value: 5, label: "Piątek" },
  { value: 6, label: "Sobota" },
  { value: 7, label: "Niedziela" },
]

/** Polish labels for the availability reasons used as reschedule warnings. */
export const REASON_LABELS: Record<string, string> = {
  full: "dzień pełny",
  blocked: "dzień zablokowany",
  closed: "poza godzinami odbioru",
  lead_time: "za krótki czas wyprzedzenia",
  beyond_horizon: "poza zakresem rezerwacji",
  past: "termin w przeszłości",
  disabled: "odbiory wyłączone",
}

export type Schedule = {
  method: "pickup"
  is_enabled: boolean
  lead_time_hours: number
  booking_horizon_days: number
  daily_capacity: number
  windows: { weekday: number; start: string; end: string }[]
}

export type BlockedDateDto = {
  id: string
  date: string
  method: "pickup" | null
  reason: string | null
}

/** "2026-10-20" in local time — fine for the Admin, which runs in Poland. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function formatPlDate(date: string): string {
  const [y, m, d] = date.split("-")
  return `${d}.${m}.${y}`
}
