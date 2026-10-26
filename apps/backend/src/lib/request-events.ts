import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Request events (specs/005 research R-09), payload `{ id, cart_id }`
 * (booking id). The transactional e-mails subscribe to them
 * (src/subscribers/email-request-events.ts, spec 006).
 */
export const REQUEST_EVENTS = {
  created: "catering.request.created",
  confirmed: "catering.request.confirmed",
  declined: "catering.request.declined",
  expired: "catering.request.expired",
  canceled: "catering.request.canceled",
} as const

export async function emitRequestEvent(
  container: MedusaContainer,
  name: (typeof REQUEST_EVENTS)[keyof typeof REQUEST_EVENTS],
  booking: { id: string; cart_id: string }
) {
  const eventBus = container.resolve(Modules.EVENT_BUS)
  await eventBus.emit({ name, data: { id: booking.id, cart_id: booking.cart_id } })
}

/**
 * Staff moved the pickup term of an order or a request (spec 006 US4).
 * `order_id` is null for a request that is not paid yet.
 */
export const PICKUP_RESCHEDULED_EVENT = "catering.pickup.rescheduled"

export type PickupRescheduledData = {
  id: string
  cart_id: string
  order_id: string | null
  previous: { date: string; start: string; end: string }
  rescheduled_at: string
}

export async function emitPickupRescheduled(container: MedusaContainer, data: PickupRescheduledData) {
  const eventBus = container.resolve(Modules.EVENT_BUS)
  await eventBus.emit({ name: PICKUP_RESCHEDULED_EVENT, data })
}
