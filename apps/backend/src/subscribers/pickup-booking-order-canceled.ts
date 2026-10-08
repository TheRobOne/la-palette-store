import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

/**
 * A cancelled order frees its place in the daily capacity
 * (specs/004-pickup-scheduling US2 scenario 3). Falls back to the order ↔
 * cart link when the order.placed subscriber has not linked the booking yet.
 */
export default async function pickupBookingOrderCanceledHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  let bookings = await catering.listBookings({ order_id: event.data.id, status: "active" })
  if (!bookings.length) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: links } = await query.graph({
      entity: "order_cart",
      fields: ["cart_id"],
      filters: { order_id: event.data.id },
    })
    const cartId = links[0]?.cart_id
    bookings = cartId
      ? await catering.listBookings({ cart_id: cartId, status: "active" })
      : []
  }

  if (bookings.length) {
    await catering.updateBookings(
      bookings.map((b) => ({ id: b.id, order_id: event.data.id, status: "canceled" as const }))
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
  context: { subscriberId: "pickup-booking-order-canceled" },
}
