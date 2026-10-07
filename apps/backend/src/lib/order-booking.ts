import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

/**
 * The booking of an order: by `order_id`, or — when the order.placed
 * subscriber has not linked it yet — through the core order ↔ cart link.
 * Prefers an active booking.
 */
export async function findOrderBooking(container: MedusaContainer, orderId: string) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  let bookings = await catering.listBookings({ order_id: orderId })
  if (!bookings.length) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: links } = await query.graph({
      entity: "order_cart",
      fields: ["cart_id"],
      filters: { order_id: orderId },
    })
    const cartId = links[0]?.cart_id
    bookings = cartId ? await catering.listBookings({ cart_id: cartId }) : []
  }

  return bookings.find((b) => b.status === "active") ?? bookings[0] ?? null
}
