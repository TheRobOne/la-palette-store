import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_METHODS } from "./fulfillment-schedule"

/**
 * active/canceled — placed orders (004); requested → confirmed → active, or
 * declined/expired/canceled — on-request terms (specs/005-on-request-terms).
 */
export const BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "active",
  "declined",
  "expired",
  "canceled",
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** Bookings in these states take a place in the daily capacity. */
export const CAPACITY_STATUSES: BookingStatus[] = ["requested", "confirmed", "active"]

export type RequestSnapshot = {
  items: { variant_id: string; quantity: number }[]
  term: { method: string; date: string; start: string; end: string }
  /** delivery requests (spec 007): payment requires the same postal code */
  delivery?: { postal_code: string }
}

/**
 * The capacity record and term history of one order. Created inside the
 * completeCart `validate` hook under a per-date lock (research R-03);
 * `order_id` is filled by the order.placed subscriber.
 */
const Booking = model
  .define("booking", {
    id: model.id({ prefix: "bkg" }).primaryKey(),
    cart_id: model.text(),
    order_id: model.text().nullable(),
    fulfillment_method: model.enum([...FULFILLMENT_METHODS]),
    // YYYY-MM-DD and HH:mm, Europe/Warsaw
    date: model.text(),
    start_time: model.text(),
    end_time: model.text(),
    status: model.enum([...BOOKING_STATUSES]).default("active"),
    // last term before a staff reschedule
    previous_date: model.text().nullable(),
    previous_start_time: model.text().nullable(),
    previous_end_time: model.text().nullable(),
    rescheduled_at: model.dateTime().nullable(),
    // on-request terms (specs/005-on-request-terms)
    requires_confirmation: model.boolean().default(false),
    response_deadline: model.dateTime().nullable(),
    payment_deadline: model.dateTime().nullable(),
    decided_at: model.dateTime().nullable(),
    decided_by: model.text().nullable(),
    // { items: [{ variant_id, quantity }], term } as sent; payment requires a match
    request_snapshot: model.json().nullable(),
    // delivery (specs/007-delivery-zones); null for pickup
    // XX-XXX
    delivery_postal_code: model.text().nullable(),
    // matched zone at booking time; null = out of zone
    delivery_zone_id: model.text().nullable(),
    // name at booking time, so history survives renames and deletes
    delivery_zone_name: model.text().nullable(),
    // gross PLN; in zone: price paid; out of zone: set by staff on confirm
    delivery_cost: model.bigNumber().nullable(),
  })
  .indexes([
    { name: "IDX_booking_date", on: ["date"], where: "deleted_at IS NULL" },
    { name: "IDX_booking_cart_id", on: ["cart_id"], where: "deleted_at IS NULL" },
    { name: "IDX_booking_order_id", on: ["order_id"], where: "deleted_at IS NULL" },
  ])

export default Booking
