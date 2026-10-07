import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  adminFetch,
  addDaysIso,
  formatPlDate,
  todayIso,
  WEEKDAYS,
} from "../../lib/catering-api"

type CalendarDay = {
  date: string
  blocked: { id: string; reason: string | null; method: string | null } | null
  used: number
  windows: {
    start: string
    end: string
    orders: {
      order_id: string | null
      display_id: number | null
      email: string | null
      status: string | null
    }[]
  }[]
}

type Calendar = { daily_capacity: number; days: CalendarDay[] }

const DAYS_PER_PAGE = 14

const weekdayLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return WEEKDAYS[(day + 6) % 7].label
}

/**
 * "Odbiory": upcoming pickups grouped by day and window, with used/total
 * capacity and blocked days (specs/004-pickup-scheduling US4).
 */
const PickupsPage = () => {
  const [from, setFrom] = useState(todayIso())
  const [calendar, setCalendar] = useState<Calendar | null>(null)

  const load = useCallback(async () => {
    try {
      const { calendar } = await adminFetch<{ calendar: Calendar }>(
        `/admin/catering/calendar?from=${from}&to=${addDaysIso(from, DAYS_PER_PAGE - 1)}`
      )
      setCalendar(calendar)
    } catch (e) {
      toast.error("Nie udało się wczytać kalendarza", { description: String(e) })
    }
  }, [from])

  useEffect(() => {
    load()
  }, [load])

  const block = async (date: string) => {
    const reason = window.prompt(`Powód blokady ${formatPlDate(date)} (opcjonalnie):`) ?? ""
    try {
      const { existing_orders } = await adminFetch<{ existing_orders: number }>(
        "/admin/catering/blocked-dates",
        { method: "POST", body: { date, method: null, reason: reason || null } }
      )
      if (existing_orders > 0) {
        toast.warning(`Zablokowano ${formatPlDate(date)}`, {
          description: `Na ten dzień są już ${existing_orders} zamówienia — pozostają bez zmian.`,
        })
      }
      load()
    } catch (e) {
      toast.error("Nie udało się zablokować dnia", { description: String(e) })
    }
  }

  const unblock = async (id: string) => {
    try {
      await adminFetch(`/admin/catering/blocked-dates/${id}`, { method: "DELETE" })
      load()
    } catch (e) {
      toast.error("Nie udało się odblokować dnia", { description: String(e) })
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Odbiory</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Zamówienia według dnia i godziny odbioru.
          </Text>
        </div>
        <div className="flex gap-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => setFrom(addDaysIso(from, -DAYS_PER_PAGE))}
          >
            ← Wcześniej
          </Button>
          <Button size="small" variant="secondary" onClick={() => setFrom(todayIso())}>
            Dziś
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setFrom(addDaysIso(from, DAYS_PER_PAGE))}
          >
            Później →
          </Button>
        </div>
      </div>

      {!calendar ? (
        <div className="px-6 py-4">
          <Text>Wczytywanie…</Text>
        </div>
      ) : (
        calendar.days.map((day) => (
          <div key={day.date} className="flex flex-col gap-y-2 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <Text weight="plus">
                  {weekdayLabel(day.date)}, {formatPlDate(day.date)}
                </Text>
                <Badge
                  size="2xsmall"
                  color={day.used >= calendar.daily_capacity ? "red" : day.used ? "blue" : "grey"}
                >
                  {day.used}/{calendar.daily_capacity}
                </Badge>
                {day.blocked && (
                  <Badge size="2xsmall" color="orange">
                    Zablokowany{day.blocked.reason ? `: ${day.blocked.reason}` : ""}
                  </Badge>
                )}
              </div>
              {day.blocked ? (
                <Button size="small" variant="transparent" onClick={() => unblock(day.blocked!.id)}>
                  Odblokuj
                </Button>
              ) : (
                <Button size="small" variant="transparent" onClick={() => block(day.date)}>
                  Zablokuj dzień
                </Button>
              )}
            </div>
            {day.windows
              .filter((w) => w.orders.length)
              .map((w) => (
                <div key={w.start} className="flex gap-x-4 pl-4">
                  <Text size="small" className="w-28 text-ui-fg-subtle">
                    {w.start}–{w.end}
                  </Text>
                  <div className="flex flex-wrap gap-x-3">
                    {w.orders.map((o, i) =>
                      o.order_id ? (
                        <Link
                          key={o.order_id}
                          to={`/orders/${o.order_id}`}
                          className="txt-small text-ui-fg-interactive"
                        >
                          #{o.display_id} {o.email}
                          {o.status === "canceled" ? " (anulowane)" : ""}
                        </Link>
                      ) : (
                        <Text key={i} size="small" className="text-ui-fg-muted">
                          zamówienie w trakcie
                        </Text>
                      )
                    )}
                  </div>
                </div>
              ))}
          </div>
        ))
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Odbiory",
})

export default PickupsPage
