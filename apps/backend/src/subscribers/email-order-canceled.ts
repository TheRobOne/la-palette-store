import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadOrderEmailData } from "../lib/emails/data"
import { sendEmail } from "../lib/emails/send"

/** Tells the customer that staff cancelled their order (spec 006 US4). */
export default async function emailOrderCanceledHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  try {
    const data = await loadOrderEmailData(container, orderId)
    await sendEmail(container, {
      template: "order-canceled",
      to: data.contact.email,
      data,
      resource: { type: "order", id: orderId },
      trigger: "order.canceled",
      key: `order-canceled:${orderId}`,
    })
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Cancellation e-mail for ${orderId} skipped: ${(error as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
  context: { subscriberId: "email-order-canceled" },
}
