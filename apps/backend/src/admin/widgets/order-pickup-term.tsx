import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Label, Select, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import {
  adminFetch,
  AdminApiError,
  formatPlDate,
  REASON_LABELS,
  type Schedule,
} from "../lib/catering-api"

type Booking = {
  id: string
  date: string
  start_time: string
  end_time: string
  status: "active" | "canceled"
  previous_date: string | null
  previous_start_time: string | null
  previous_end_time: string | null
  rescheduled_at: string | null
}

const isoWeekday = (date: string) => {
  const [y, m, d] = date.split("-").map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 ? 7 : day
}

/**
 * Order sidebar: the pickup term, its previous value after a reschedule and
 * the "Zmień termin" form; rule breaks are shown as warnings staff can
 * override (specs/004-pickup-scheduling US4, US5).
 */
const OrderPickupTermWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [missing, setMissing] = useState(false)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ date: "", window: "" })
  const [warnings, setWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const { booking } = await adminFetch<{ booking: Booking }>(
        `/admin/catering/orders/${order.id}/pickup-term`
      )
      setBooking(booking)
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 404) {
        setMissing(true)
      } else {
        toast.error("Nie udało się wczytać terminu odbioru", { description: String(e) })
      }
    }
  }, [order.id])

  useEffect(() => {
    load()
  }, [load])

  const startEditing = async () => {
    setEditing(true)
    setWarnings([])
    if (!schedule) {
      const { schedule } = await adminFetch<{ schedule: Schedule }>(
        "/admin/catering/schedule?method=pickup"
      )
      setSchedule(schedule)
    }
  }

  const windowsForDate = schedule && form.date
    ? schedule.windows
        .filter((w) => w.weekday === isoWeekday(form.date))
        .sort((a, b) => a.start.localeCompare(b.start))
    : []

  const submit = async (confirm: boolean) => {
    const [start, end] = form.window.split("-")
    setSaving(true)
    try {
      const result = await adminFetch<{ booking: Booking }>(
        `/admin/catering/orders/${order.id}/pickup-term`,
        { method: "POST", body: { date: form.date, start, end, confirm } }
      )
      setBooking(result.booking)
      setEditing(false)
      setWarnings([])
      toast.success("Zmieniono termin odbioru")
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 409) {
        setWarnings(e.body.warnings ?? [])
      } else {
        toast.error("Nie udało się zmienić terminu", {
          description: e instanceof AdminApiError ? e.message : String(e),
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (missing) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Termin odbioru</Heading>
        {booking?.status === "active" && !editing && (
          <Button size="small" variant="secondary" onClick={startEditing}>
            Zmień termin
          </Button>
        )}
      </div>

      {booking && (
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <Text size="small" weight="plus">
            {formatPlDate(booking.date)}, {booking.start_time}–{booking.end_time}
            {booking.status === "canceled" ? " (anulowane)" : ""}
          </Text>
          {booking.previous_date && (
            <Text size="small" className="text-ui-fg-subtle">
              Wcześniej: {formatPlDate(booking.previous_date)}, {booking.previous_start_time}–
              {booking.previous_end_time}
              {booking.rescheduled_at
                ? ` (zmieniono ${new Date(booking.rescheduled_at).toLocaleString("pl-PL")})`
                : ""}
            </Text>
          )}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="reschedule-date" size="small">
              Nowa data
            </Label>
            <Input
              id="reschedule-date"
              type="date"
              size="small"
              value={form.date}
              onChange={(e) => {
                setForm({ date: e.target.value, window: "" })
                setWarnings([])
              }}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small">Godzina</Label>
            <Select
              size="small"
              value={form.window}
              onValueChange={(window) => {
                setForm({ ...form, window })
                setWarnings([])
              }}
              disabled={!windowsForDate.length}
            >
              <Select.Trigger>
                <Select.Value
                  placeholder={form.date ? "Brak okien w tym dniu" : "Najpierw wybierz datę"}
                />
              </Select.Trigger>
              <Select.Content>
                {windowsForDate.map((w) => (
                  <Select.Item key={w.start} value={`${w.start}-${w.end}`}>
                    {w.start}–{w.end}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {warnings.length > 0 && (
            <Text size="small" className="text-ui-fg-error">
              Uwaga: {warnings.map((w) => REASON_LABELS[w] ?? w).join(", ")}.
            </Text>
          )}

          <div className="flex justify-end gap-x-2">
            <Button size="small" variant="transparent" onClick={() => setEditing(false)}>
              Anuluj
            </Button>
            {warnings.length > 0 ? (
              <Button size="small" variant="danger" isLoading={saving} onClick={() => submit(true)}>
                Zmień mimo to
              </Button>
            ) : (
              <Button
                size="small"
                disabled={!form.date || !form.window}
                isLoading={saving}
                onClick={() => submit(false)}
              >
                Zapisz
              </Button>
            )}
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderPickupTermWidget
