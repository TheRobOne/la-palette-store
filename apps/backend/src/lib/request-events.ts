import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Events for the future transactional e-mail feature (specs/005 research
 * R-09). Nothing subscribes yet; payload `{ id, cart_id }` (booking id).
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
