/**
 * Store-metadata keys of the notification settings. Dependency-free on
 * purpose: shared by the server (src/lib/notification-settings.ts) and the
 * Admin widget bundle (src/admin/widgets/notification-settings.tsx).
 */
export const STAFF_EMAIL_METADATA_KEY = "catering_staff_email"
export const STAFF_REMINDER_HOURS_METADATA_KEY = "catering_staff_reminder_hours"

export const DEFAULT_STAFF_REMINDER_HOURS = 4
export const MIN_STAFF_REMINDER_HOURS = 1
export const MAX_STAFF_REMINDER_HOURS = 24

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}

/**
 * Staff address (null = staff e-mails off) and reminder hours (default 4,
 * clamped to 1–24); invalid values fall back so a typo never breaks sending.
 */
export function notificationSettingsFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): { staffEmail: string | null; staffReminderHours: number } {
  const rawEmail = metadata?.[STAFF_EMAIL_METADATA_KEY]
  const staffEmail =
    typeof rawEmail === "string" && isValidEmail(rawEmail) ? rawEmail.trim() : null

  const rawHours = metadata?.[STAFF_REMINDER_HOURS_METADATA_KEY]
  const hours = typeof rawHours === "number" ? rawHours : Number(rawHours)
  const staffReminderHours = Number.isFinite(hours) && rawHours !== "" && rawHours != null
    ? Math.min(MAX_STAFF_REMINDER_HOURS, Math.max(MIN_STAFF_REMINDER_HOURS, Math.round(hours)))
    : DEFAULT_STAFF_REMINDER_HOURS

  return { staffEmail, staffReminderHours }
}
