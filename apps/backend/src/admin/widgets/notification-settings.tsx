import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminStore, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import {
  MAX_STAFF_REMINDER_HOURS,
  MIN_STAFF_REMINDER_HOURS,
  STAFF_EMAIL_METADATA_KEY,
  STAFF_REMINDER_HOURS_METADATA_KEY,
  isValidEmail,
  notificationSettingsFromMetadata,
} from "../../lib/notification-settings-metadata"

/**
 * Settings → Store: where staff e-mails go (new orders, new requests,
 * reminders) and how early the reminder about an undecided request comes
 * (specs/006-transactional-emails FR-004, FR-010). Stored in store metadata.
 */
const NotificationSettingsWidget = ({ data: store }: DetailWidgetProps<AdminStore>) => {
  const initial = notificationSettingsFromMetadata(store.metadata)
  const [saved, setSaved] = useState(initial)
  const [email, setEmail] = useState(initial.staffEmail ?? "")
  const [hours, setHours] = useState(String(initial.staffReminderHours))
  const [isSaving, setIsSaving] = useState(false)

  const parsedHours = Number(hours)
  const emailValid = email.trim() === "" || isValidEmail(email)
  const hoursValid =
    Number.isInteger(parsedHours) &&
    parsedHours >= MIN_STAFF_REMINDER_HOURS &&
    parsedHours <= MAX_STAFF_REMINDER_HOURS
  const changed =
    email.trim() !== (saved.staffEmail ?? "") || parsedHours !== saved.staffReminderHours

  const save = async () => {
    setIsSaving(true)
    try {
      // fresh metadata: another widget on this page may have saved meanwhile
      const current = await fetch(`/admin/stores/${store.id}`, { credentials: "include" })
      const { store: fresh } = (await current.json()) as { store: AdminStore }
      const response = await fetch(`/admin/stores/${store.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            ...fresh.metadata,
            [STAFF_EMAIL_METADATA_KEY]: email.trim(),
            [STAFF_REMINDER_HOURS_METADATA_KEY]: parsedHours,
          },
        }),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      setSaved({ staffEmail: email.trim() || null, staffReminderHours: parsedHours })
      toast.success("Zapisano ustawienia powiadomień")
    } catch (e) {
      toast.error("Nie udało się zapisać", { description: String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Powiadomienia e-mail dla obsługi</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Na ten adres przychodzą maile o nowych zamówieniach i zapytaniach oraz przypomnienie o
          zapytaniu bez decyzji przed jego wygaśnięciem. Puste pole wyłącza maile do obsługi —
          klienci nadal dostają swoje.
        </Text>
      </div>
      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="staff-email" size="small">
            Adres obsługi
          </Label>
          <Input
            id="staff-email"
            type="email"
            placeholder="kuchnia@lapalettegarden.pl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!emailValid}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="staff-reminder-hours" size="small">
            Przypomnienie przed wygaśnięciem (godz.)
          </Label>
          <Input
            id="staff-reminder-hours"
            type="number"
            min={MIN_STAFF_REMINDER_HOURS}
            max={MAX_STAFF_REMINDER_HOURS}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            aria-invalid={!hoursValid}
          />
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={save}
          isLoading={isSaving}
          disabled={!emailValid || !hoursValid || !changed}
        >
          Zapisz
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "store.details.after",
})

export default NotificationSettingsWidget
