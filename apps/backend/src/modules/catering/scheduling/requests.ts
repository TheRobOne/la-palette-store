import { MedusaError } from "@medusajs/framework/utils"
import type { BookingStatus, RequestSnapshot } from "../models/booking"
import type { CateringTerm } from "./term"

/**
 * Pure rules of on-request terms (specs/005-on-request-terms data-model.md
 * state machine). No I/O: used by the request routes, the completion hook,
 * the confirm/decline workflows and the expiry job.
 */

type RequestState = {
  status: BookingStatus
  response_deadline?: Date | string | null
  payment_deadline?: Date | string | null
}

const HOUR_MS = 3_600_000

const toTime = (value: Date | string | null | undefined) =>
  value ? new Date(value).getTime() : null

/** min(now + hours, window start) — a deadline never runs past the pickup itself. */
function cappedDeadline(now: Date, hours: number, windowStart: Date): Date {
  return new Date(Math.min(now.getTime() + hours * HOUR_MS, windowStart.getTime()))
}

export const responseDeadline = cappedDeadline
export const paymentDeadline = cappedDeadline

/** A deadline has passed only strictly after it (exactly at it is still in time). */
const isPast = (deadline: Date | string | null | undefined, now: Date) => {
  const t = toTime(deadline)
  return t !== null && now.getTime() > t
}

export function canConfirm(request: RequestState, now: Date): boolean {
  return request.status === "requested" && !isPast(request.response_deadline, now)
}

export function canDecline(request: RequestState): boolean {
  return request.status === "requested" || request.status === "confirmed"
}

export function canPay(request: RequestState, now: Date): boolean {
  return request.status === "confirmed" && !isPast(request.payment_deadline, now)
}

/** Ids the expiry job must move: requested → expired, confirmed → canceled. */
export function selectExpired(
  requests: (RequestState & { id: string })[],
  now: Date
): { expire: string[]; cancel: string[] } {
  return {
    expire: requests
      .filter((r) => r.status === "requested" && isPast(r.response_deadline, now))
      .map((r) => r.id),
    cancel: requests
      .filter((r) => r.status === "confirmed" && isPast(r.payment_deadline, now))
      .map((r) => r.id),
  }
}

type CartLike = { items?: { variant_id?: string | null; quantity: number | string }[] | null }

/** The delivery part of a request (spec 007); null for pickup. */
type DeliveryLike = { postal_code: string | null } | null | undefined

function itemsOf(cart: CartLike) {
  const totals = new Map<string, number>()
  for (const item of cart.items ?? []) {
    if (item.variant_id) {
      totals.set(item.variant_id, (totals.get(item.variant_id) ?? 0) + Number(item.quantity))
    }
  }
  return [...totals.entries()]
    .map(([variant_id, quantity]) => ({ variant_id, quantity }))
    .sort((a, b) => a.variant_id.localeCompare(b.variant_id))
}

/**
 * What the customer sent: variant quantities (order-insensitive), the term
 * and, for delivery, the postal code (spec 007 — it decides the price).
 */
export function buildSnapshot(
  cart: CartLike,
  term: CateringTerm,
  delivery: DeliveryLike = null
): RequestSnapshot {
  return {
    items: itemsOf(cart),
    term: { method: term.method, date: term.date, start: term.start, end: term.end },
    ...(delivery?.postal_code ? { delivery: { postal_code: delivery.postal_code } } : {}),
  }
}

/**
 * FR-009a: the cart being paid must be exactly what was requested. Compared
 * field by field: the stored snapshot comes back from Postgres jsonb, which
 * does not keep key order.
 */
export function snapshotMatches(
  snapshot: RequestSnapshot | null | undefined,
  cart: CartLike,
  term: CateringTerm,
  delivery: DeliveryLike = null
): boolean {
  if (!snapshot) {
    return false
  }
  const current = buildSnapshot(cart, term, delivery)
  const stored = [...(snapshot.items ?? [])]
    .map((i) => ({ variant_id: String(i.variant_id), quantity: Number(i.quantity) }))
    .sort((a, b) => a.variant_id.localeCompare(b.variant_id))

  const sameItems =
    stored.length === current.items.length &&
    stored.every(
      (item, i) =>
        item.variant_id === current.items[i].variant_id &&
        item.quantity === current.items[i].quantity
    )
  const t = snapshot.term
  const sameTerm =
    !!t &&
    t.method === term.method &&
    t.date === term.date &&
    t.start === term.start &&
    t.end === term.end

  const samePostalCode =
    (snapshot.delivery?.postal_code ?? null) === (current.delivery?.postal_code ?? null)

  return sameItems && sameTerm && samePostalCode
}

// Customer-facing messages (contracts/store-api.md §2, §4), `invalid_data` → 400.

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

export const notOnRequestError = () =>
  invalid("Ten termin nie wymaga potwierdzenia — złóż zwykłe zamówienie.")

export const requiresConfirmationError = () =>
  invalid("Ten termin wymaga potwierdzenia kuchni — wyślij zapytanie.")

export const paymentTimeOverError = () =>
  invalid("Czas na płatność za to zamówienie minął.")

export const snapshotMismatchError = () =>
  invalid("Zamówienie różni się od wysłanego zapytania — skontaktuj się z nami.")
