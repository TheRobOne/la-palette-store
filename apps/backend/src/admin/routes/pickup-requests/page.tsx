import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Label, Tabs, Text, toast } from "@medusajs/ui"
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
import {
  type AdminEmailDto,
  EMAIL_STATUS_LABELS,
  emailTemplateLabel,
} from "../../../lib/emails/template-labels"

const TABS = [
  { value: "pending", label: "Oczekujące", statuses: "requested" },
  { value: "confirmed", label: "Potwierdzone", statuses: "confirmed" },
  { value: "done", label: "Zakończone", statuses: "active,declined,expired,canceled" },
] as const

const formatPln = (amount: number | null) =>
  amount === null ? "—" : `${amount.toFixed(2).replace(".", ",")} zł`

const parseCost = (value: string) => {
  const cost = Number(value.replace(",", "."))
  return value.trim() !== "" && Number.isFinite(cost) && cost >= 0 ? cost : null
}

/**
 * "Zapytania": requests for on-request terms — confirm or decline
 * (specs/005-on-request-terms US2). A delivery outside every zone is
 * confirmed with its delivery cost (specs/007-delivery-zones US3). A request
 * becomes an order only once paid.
 */
const PickupRequestsPage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("pending")
  const [requests, setRequests] = useState<PickupRequest[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // delivery cost typed per out-of-zone request
  const [costs, setCosts] = useState<Record<string, string>>({})
  // customer e-mails per request (spec 006), newest first
  const [emails, setEmails] = useState<Record<string, AdminEmailDto[]>>({})

  const load = useCallback(async () => {
    const statuses = TABS.find((t) => t.value === tab)!.statuses
    try {
      const { requests } = await adminFetch<{ requests: PickupRequest[] }>(
        `/admin/catering/requests?status=${statuses}`
      )
      setRequests(requests)
      if (requests.length) {
        const { notifications } = await adminFetch<{ notifications: AdminEmailDto[] }>(
          `/admin/catering/notifications?resource_id=${requests.map((r) => r.id).join(",")}`
        )
        const byRequest: Record<string, AdminEmailDto[]> = {}
        for (const n of notifications.filter((n) => !n.template.startsWith("staff-"))) {
          ;(byRequest[n.resource_id] ??= []).push(n)
        }
        setEmails(byRequest)
      }
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
      const cost = parseCost(costs[request.id] ?? "")
      await adminFetch(`/admin/catering/requests/${request.id}/${action}`, {
        method: "POST",
        ...(action === "confirm" && request.fulfillment.out_of_zone
          ? { body: { delivery_cost: cost } }
          : {}),
      })
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
              {r.fulfillment.method === "delivery" ? (
                <Text size="small">
                  Dostawa: {r.fulfillment.address ?? r.fulfillment.postal_code ?? "—"}
                  {r.fulfillment.phone ? ` · tel. ${r.fulfillment.phone}` : ""} ·{" "}
                  {r.fulfillment.out_of_zone ? (
                    <Badge size="2xsmall" color="orange">
                      poza strefą
                    </Badge>
                  ) : (
                    r.fulfillment.zone_name
                  )}
                  {r.fulfillment.delivery_cost !== null
                    ? ` · koszt dostawy ${formatPln(r.fulfillment.delivery_cost)}`
                    : ""}
                </Text>
              ) : (
                <Text size="small">Odbiór osobisty</Text>
              )}
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
              {emails[r.id]?.[0] && (
                <div className="flex items-center gap-x-2">
                  <Text size="small" className="text-ui-fg-subtle">
                    Ostatni mail do klienta: {emailTemplateLabel(emails[r.id][0].template)} ·{" "}
                    {formatDateTime(emails[r.id][0].created_at)}
                  </Text>
                  {emails[r.id].some((e) => e.status === "failure") && (
                    <Badge size="2xsmall" color="red">
                      {EMAIL_STATUS_LABELS.failure}
                    </Badge>
                  )}
                </div>
              )}
              {r.order_id && (
                <Link to={`/orders/${r.order_id}`} className="txt-small text-ui-fg-interactive">
                  Przejdź do zamówienia
                </Link>
              )}
            </div>
            {(r.status === "requested" || r.status === "confirmed") && (
              <div className="flex items-end gap-x-2">
                {r.status === "requested" && r.fulfillment.out_of_zone && (
                  <div className="flex flex-col gap-y-1">
                    <Label htmlFor={`cost-${r.id}`} size="small">
                      Koszt dostawy (zł)
                    </Label>
                    <Input
                      id={`cost-${r.id}`}
                      size="small"
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      value={costs[r.id] ?? ""}
                      onChange={(e) => setCosts({ ...costs, [r.id]: e.target.value })}
                    />
                  </div>
                )}
                {r.status === "requested" && (
                  <Button
                    size="small"
                    isLoading={busy === r.id}
                    disabled={r.fulfillment.out_of_zone && parseCost(costs[r.id] ?? "") === null}
                    onClick={() => decide(r, "confirm")}
                  >
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
