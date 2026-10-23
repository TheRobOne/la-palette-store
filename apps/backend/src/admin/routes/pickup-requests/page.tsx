import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Tabs, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  adminFetch,
  AdminApiError,
  formatDateTime,
  formatPlDate,
  type PickupRequest,
  REQUEST_STATUS_LABELS,
  timeLeft,
} from "../../lib/catering-api"

const TABS = [
  { value: "pending", label: "Oczekujące", statuses: "requested" },
  { value: "confirmed", label: "Potwierdzone", statuses: "confirmed" },
  { value: "done", label: "Zakończone", statuses: "active,declined,expired,canceled" },
] as const

const formatPln = (amount: number | null) =>
  amount === null ? "—" : `${amount.toFixed(2).replace(".", ",")} zł`

/**
 * "Zapytania": requests for on-request pickup terms — confirm or decline
 * (specs/005-on-request-terms US2). A request becomes an order only once paid.
 */
const PickupRequestsPage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("pending")
  const [requests, setRequests] = useState<PickupRequest[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const statuses = TABS.find((t) => t.value === tab)!.statuses
    try {
      const { requests } = await adminFetch<{ requests: PickupRequest[] }>(
        `/admin/catering/requests?status=${statuses}`
      )
      setRequests(requests)
    } catch (e) {
      toast.error("Nie udało się wczytać zapytań", { description: String(e) })
    }
  }, [tab])

  useEffect(() => {
    setRequests(null)
    load()
  }, [load])

  const decide = async (request: PickupRequest, action: "confirm" | "decline") => {
    if (
      action === "decline" &&
      !window.confirm(
        `Odrzucić zapytanie na ${formatPlDate(request.term.date)}, ${request.term.start}–${request.term.end}?`
      )
    ) {
      return
    }
    setBusy(request.id)
    try {
      await adminFetch(`/admin/catering/requests/${request.id}/${action}`, { method: "POST" })
      toast.success(action === "confirm" ? "Zapytanie potwierdzone" : "Zapytanie odrzucone")
      load()
    } catch (e) {
      toast.error("Nie udało się zapisać decyzji", {
        description: e instanceof AdminApiError ? e.message : String(e),
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">Zapytania</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Zamówienia na terminy wymagające potwierdzenia kuchni. Klient płaci dopiero po
          potwierdzeniu; bez odpowiedzi lub bez płatności w ustalonym czasie zapytanie wygasa.
        </Text>
      </div>
      <div className="px-6 py-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <Tabs.List>
            {TABS.map((t) => (
              <Tabs.Trigger key={t.value} value={t.value}>
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
      </div>

      {!requests ? (
        <div className="px-6 py-4">
          <Text>Wczytywanie…</Text>
        </div>
      ) : requests.length === 0 ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Brak zapytań.
          </Text>
        </div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="flex flex-col gap-y-2 px-6 py-4 md:flex-row md:justify-between">
            <div className="flex flex-col gap-y-1">
              <div className="flex items-center gap-x-2">
                <Text weight="plus">
                  {formatPlDate(r.term.date)}, {r.term.start}–{r.term.end}
                </Text>
                <Badge size="2xsmall" color={r.status === "requested" ? "orange" : r.status === "confirmed" ? "blue" : "grey"}>
                  {REQUEST_STATUS_LABELS[r.status]}
                </Badge>
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                {r.email ?? "—"} · {formatPln(r.item_total)}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {r.items.map((i) => `${i.quantity} × ${i.title ?? "?"}`).join(", ")}
              </Text>
              {r.status === "requested" && (
                <Text size="small">
                  Odpowiedz do {formatDateTime(r.response_deadline)} ({timeLeft(r.response_deadline)})
                </Text>
              )}
              {r.status === "confirmed" && (
                <Text size="small">
                  Płatność do {formatDateTime(r.payment_deadline)} ({timeLeft(r.payment_deadline)})
                </Text>
              )}
              {r.order_id && (
                <Link to={`/orders/${r.order_id}`} className="txt-small text-ui-fg-interactive">
                  Przejdź do zamówienia
                </Link>
              )}
            </div>
            {(r.status === "requested" || r.status === "confirmed") && (
              <div className="flex items-start gap-x-2">
                {r.status === "requested" && (
                  <Button size="small" isLoading={busy === r.id} onClick={() => decide(r, "confirm")}>
                    Potwierdź
                  </Button>
                )}
                <Button
                  size="small"
                  variant="secondary"
                  disabled={busy === r.id}
                  onClick={() => decide(r, "decline")}
                >
                  Odrzuć
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Zapytania",
})

export default PickupRequestsPage
