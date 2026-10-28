import type { BigNumberInput } from "@medusajs/framework/types"
import { MathBN } from "@medusajs/framework/utils"
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
  delivery_postal_code?: string | null
  delivery_zone_id?: string | null
  delivery_zone_name?: string | null
  delivery_cost?: unknown
}

export type AddressLike = {
  address_1?: string | null
  postal_code?: string | null
  city?: string | null
  phone?: string | null
} | null | undefined

/** "ul. Przykładowa 5/2, 31-870 Kraków", or null without a street. */
export const formatDeliveryAddress = (a: AddressLike) =>
  a?.address_1 ? [a.address_1, [a.postal_code, a.city].filter(Boolean).join(" ")].join(", ") : null

const amountOrNull = (value: unknown) =>
  value === null || value === undefined ? null : MathBN.convert(value as BigNumberInput).toNumber()

/**
 * Fulfillment details of a booking (specs/007-delivery-zones contracts
 * store-api §6, admin-api "Requests"): the zone and cost are the booking's
 * (snapshot when sent / staff-set when confirmed), address and phone the cart's.
 */
export function bookingFulfillment(booking: BookingLike, address?: AddressLike) {
  const isDelivery = booking.fulfillment_method === "delivery"
  return {
    method: booking.fulfillment_method,
    address: isDelivery ? formatDeliveryAddress(address) : null,
    phone: isDelivery ? (address?.phone ?? null) : null,
    postal_code: isDelivery ? (booking.delivery_postal_code ?? null) : null,
    zone_name: isDelivery ? (booking.delivery_zone_name ?? null) : null,
    out_of_zone: isDelivery && !booking.delivery_zone_id,
    delivery_cost: isDelivery ? amountOrNull(booking.delivery_cost) : null,
  }
}

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

/** The customer-facing request shape (specs/005-on-request-terms/contracts/store-api.md §2). */
export function toStoreRequest(booking: BookingLike) {
  const snapshot = booking.request_snapshot as RequestSnapshot | null | undefined
  // the customer already knows their address; no phone or zone name here
  const { method, postal_code, out_of_zone, delivery_cost } = bookingFulfillment(booking)
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
    fulfillment: { method, postal_code, out_of_zone, delivery_cost },
    ...(booking.status === "active" && booking.order_id ? { order_id: booking.order_id } : {}),
  }
}
