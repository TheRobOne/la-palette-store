import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Checkbox,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import {
  adminFetch,
  AdminApiError,
  addDaysIso,
  type BlockedDateDto,
  formatPlDate,
  type Schedule,
  todayIso,
  WEEKDAYS,
} from "../../../lib/catering-api"

/**
 * Settings → "Harmonogram odbiorów": weekly pickup windows, lead time,
 * booking horizon, daily capacity and blocked dates
 * (specs/004-pickup-scheduling US3).
 */
const PickupSchedulePage = () => {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [blocked, setBlocked] = useState<BlockedDateDto[]>([])
  const [saving, setSaving] = useState(false)
  const [newBlock, setNewBlock] = useState({ date: "", reason: "", scope: "all" })

  const load = useCallback(async () => {
    try {
      const [{ schedule }, { blocked_dates }] = await Promise.all([
        adminFetch<{ schedule: Schedule }>("/admin/catering/schedule?method=pickup"),
        adminFetch<{ blocked_dates: BlockedDateDto[] }>(
          `/admin/catering/blocked-dates?from=${todayIso()}&to=${addDaysIso(todayIso(), 365)}`
        ),
      ])
      setSchedule(schedule)
      setBlocked(blocked_dates)
    } catch (e) {
      toast.error("Nie udało się wczytać harmonogramu", { description: String(e) })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!schedule) {
    return (
      <Container>
        <Text>Wczytywanie…</Text>
      </Container>
    )
  }

  const update = (patch: Partial<Schedule>) => setSchedule({ ...schedule, ...patch })

  const setWindow = (index: number, patch: Partial<Schedule["windows"][number]>) =>
    update({
      windows: schedule.windows.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    })

  const save = async () => {
    setSaving(true)
    try {
      const { method: _method, ...body } = schedule
      const result = await adminFetch<{ schedule: Schedule }>(
        "/admin/catering/schedule?method=pickup",
        { method: "POST", body }
      )
      setSchedule(result.schedule)
      toast.success("Zapisano harmonogram odbiorów")
    } catch (e) {
      toast.error("Nie udało się zapisać", {
        description: e instanceof AdminApiError ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  const addBlock = async () => {
    try {
      const { existing_orders } = await adminFetch<{
        blocked_date: BlockedDateDto
        existing_orders: number
      }>("/admin/catering/blocked-dates", {
        method: "POST",
        body: {
          date: newBlock.date,
          method: newBlock.scope === "pickup" ? "pickup" : null,
          reason: newBlock.reason || null,
        },
      })
      if (existing_orders > 0) {
        toast.warning(`Zablokowano ${formatPlDate(newBlock.date)}`, {
          description: `Na ten dzień są już ${existing_orders} zamówienia — pozostają bez zmian.`,
        })
      } else {
        toast.success(`Zablokowano ${formatPlDate(newBlock.date)}`)
      }
      setNewBlock({ date: "", reason: "", scope: "all" })
      load()
    } catch (e) {
      toast.error("Nie udało się zablokować dnia", {
        description: e instanceof AdminApiError ? e.message : String(e),
      })
    }
  }

  const removeBlock = async (id: string) => {
    try {
      await adminFetch(`/admin/catering/blocked-dates/${id}`, { method: "DELETE" })
      setBlocked(blocked.filter((b) => b.id !== id))
    } catch (e) {
      toast.error("Nie udało się odblokować dnia", { description: String(e) })
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Harmonogram odbiorów</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Godziny, w których klienci mogą odebrać zamówienie, i dzienny limit kuchni.
            </Text>
          </div>
          <Button size="small" onClick={save} isLoading={saving}>
            Zapisz
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-4">
          <div className="flex items-center gap-x-2">
            <Switch
              id="pickup-enabled"
              checked={schedule.is_enabled}
              onCheckedChange={(checked) => update({ is_enabled: checked })}
            />
            <Label htmlFor="pickup-enabled">Odbiory włączone</Label>
          </div>
          <NumberField
            id="daily-capacity"
            label="Limit zamówień na dzień"
            value={schedule.daily_capacity}
            onChange={(daily_capacity) => update({ daily_capacity })}
          />
          <NumberField
            id="lead-time"
            label="Minimalne wyprzedzenie (godz.)"
            value={schedule.lead_time_hours}
            onChange={(lead_time_hours) => update({ lead_time_hours })}
          />
          <NumberField
            id="horizon"
            label="Rezerwacje do (dni naprzód)"
            value={schedule.booking_horizon_days}
            onChange={(booking_horizon_days) => update({ booking_horizon_days })}
          />
        </div>

        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Heading level="h2">Terminy na zapytanie</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Okna oznaczone „na zapytanie” klient może wybrać tylko wysyłając zapytanie; płaci po
            potwierdzeniu przez kuchnię. Bez odpowiedzi albo bez płatności w poniższym czasie
            zapytanie wygasa i zwalnia miejsce.
          </Text>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <NumberField
              id="request-lead-time"
              label="Wyprzedzenie zapytań (godz.)"
              value={schedule.request_lead_time_hours}
              onChange={(request_lead_time_hours) => update({ request_lead_time_hours })}
            />
            <NumberField
              id="request-response"
              label="Czas na odpowiedź (godz.)"
              value={schedule.request_response_hours}
              onChange={(request_response_hours) => update({ request_response_hours })}
            />
            <NumberField
              id="request-payment"
              label="Czas na płatność (godz.)"
              value={schedule.request_payment_hours}
              onChange={(request_payment_hours) => update({ request_payment_hours })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-y-4 px-6 py-4">
          <Heading level="h2">Okna odbioru</Heading>
          {WEEKDAYS.map((weekday) => (
            <div key={weekday.value} className="flex flex-col gap-y-2">
              <div className="flex items-center gap-x-3">
                <Text size="small" weight="plus">
                  {weekday.label}
                </Text>
                {schedule.windows.some((w) => w.weekday === weekday.value) && (
                  <div className="flex items-center gap-x-1">
                    <Checkbox
                      id={`day-on-request-${weekday.value}`}
                      checked={schedule.windows
                        .filter((w) => w.weekday === weekday.value)
                        .every((w) => w.requires_confirmation)}
                      onCheckedChange={(checked) =>
                        update({
                          windows: schedule.windows.map((w) =>
                            w.weekday === weekday.value
                              ? { ...w, requires_confirmation: checked === true }
                              : w
                          ),
                        })
                      }
                    />
                    <Label htmlFor={`day-on-request-${weekday.value}`} size="small">
                      cały dzień na zapytanie
                    </Label>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {schedule.windows.map((w, index) =>
                  w.weekday !== weekday.value ? null : (
                    <div key={index} className="flex items-center gap-x-1">
                      <Input
                        type="time"
                        size="small"
                        value={w.start}
                        onChange={(e) => setWindow(index, { start: e.target.value })}
                        aria-label={`${weekday.label} od`}
                      />
                      <Text size="small">–</Text>
                      <Input
                        type="time"
                        size="small"
                        value={w.end}
                        onChange={(e) => setWindow(index, { end: e.target.value })}
                        aria-label={`${weekday.label} do`}
                      />
                      <Checkbox
                        checked={!!w.requires_confirmation}
                        onCheckedChange={(checked) =>
                          setWindow(index, { requires_confirmation: checked === true })
                        }
                        aria-label={`${weekday.label} ${w.start}–${w.end} na zapytanie`}
                        title="Na zapytanie"
                      />
                      <IconButton
                        size="small"
                        variant="transparent"
                        aria-label="Usuń okno"
                        onClick={() =>
                          update({ windows: schedule.windows.filter((_, i) => i !== index) })
                        }
                      >
                        ×
                      </IconButton>
                    </div>
                  )
                )}
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() =>
                    update({
                      windows: [
                        ...schedule.windows,
                        { weekday: weekday.value, start: "10:00", end: "11:00" },
                      ],
                    })
                  }
                >
                  Dodaj okno
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Zablokowane dni</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            W te dni klienci nie złożą zamówienia (np. wesela, święta, urlop). Powód widzi
            tylko obsługa.
          </Text>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-6 py-4">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="block-date" size="small">
              Data
            </Label>
            <Input
              id="block-date"
              type="date"
              size="small"
              min={todayIso()}
              value={newBlock.date}
              onChange={(e) => setNewBlock({ ...newBlock, date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="block-reason" size="small">
              Powód
            </Label>
            <Input
              id="block-reason"
              size="small"
              placeholder="np. Wesele"
              value={newBlock.reason}
              onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
            />
          </div>
          <div className="flex w-48 flex-col gap-y-1">
            <Label size="small">Zakres</Label>
            <Select
              size="small"
              value={newBlock.scope}
              onValueChange={(scope) => setNewBlock({ ...newBlock, scope })}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Cała kuchnia</Select.Item>
                <Select.Item value="pickup">Tylko odbiory</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <Button size="small" variant="secondary" disabled={!newBlock.date} onClick={addBlock}>
            Zablokuj dzień
          </Button>
        </div>
        <div className="flex flex-col px-6 py-4">
          {blocked.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              Brak zablokowanych dni.
            </Text>
          ) : (
            blocked.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-1">
                <Text size="small">
                  {formatPlDate(b.date)}
                  {b.reason ? ` — ${b.reason}` : ""}
                  {b.method ? " (tylko odbiory)" : ""}
                </Text>
                <Button size="small" variant="transparent" onClick={() => removeBlock(b.id)}>
                  Odblokuj
                </Button>
              </div>
            ))
          )}
        </div>
      </Container>
    </div>
  )
}

const NumberField = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) => (
  <div className="flex flex-col gap-y-1">
    <Label htmlFor={id} size="small">
      {label}
    </Label>
    <Input
      id={id}
      type="number"
      size="small"
      min={0}
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </div>
)

export const config = defineRouteConfig({
  label: "Harmonogram odbiorów",
})

export default PickupSchedulePage
