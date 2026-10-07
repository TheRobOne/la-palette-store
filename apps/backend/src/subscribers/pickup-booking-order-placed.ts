import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

/**
 * Links the pickup booking created at cart completion to its order
 * (specs/004-pickup-scheduling research R-04). The cart is found through the
 * core order ↔ cart link, the same one completeCartWorkflow queries.
 */
export default async function pickupBookingOrderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  const { data: links } = await query.graph({
    entity: "order_cart",
    fields: ["cart_id"],
    filters: { order_id: event.data.id },
  })
  const cartId = links[0]?.cart_id
  if (!cartId) {
    return
  }

  const bookings = await catering.listBookings({ cart_id: cartId, status: "active" })
  if (bookings.length) {
    await catering.updateBookings(
      bookings.map((b) => ({ id: b.id, order_id: event.data.id }))
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "pickup-booking-order-placed" },
}
