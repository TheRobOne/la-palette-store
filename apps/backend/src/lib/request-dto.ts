import type { RequestSnapshot } from "../modules/catering/models/booking"

type BookingLike = {
  id: string
  cart_id: string
  order_id?: string | null
  status: string
  fulfillment_method: string
  date: string
  start_time: string
  end_time: string
  response_deadline?: Date | string | null
  payment_deadline?: Date | string | null
  decided_at?: Date | string | null
  request_snapshot?: unknown
}

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

/** The customer-facing request shape (specs/005-on-request-terms/contracts/store-api.md §2). */
export function toStoreRequest(booking: BookingLike) {
  const snapshot = booking.request_snapshot as RequestSnapshot | null | undefined
  return {
    cart_id: booking.cart_id,
    status: booking.status,
    term: {
      method: booking.fulfillment_method,
      date: booking.date,
      start: booking.start_time,
      end: booking.end_time,
    },
    response_deadline: iso(booking.response_deadline),
    payment_deadline: iso(booking.payment_deadline),
    items: snapshot?.items ?? [],
    ...(booking.status === "active" && booking.order_id ? { order_id: booking.order_id } : {}),
  }
}
