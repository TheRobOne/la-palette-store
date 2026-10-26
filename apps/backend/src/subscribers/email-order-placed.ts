import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadOrderEmailData } from "../lib/emails/data"
import { sendEmail, sendStaffEmail } from "../lib/emails/send"

/**
 * Order confirmation to the customer (the contract confirmation on a durable
 * medium, spec 006 FR-001) and the staff alert (FR-003). Shop orders, paid
 * on-request requests and Admin draft orders all emit `order.placed`.
 */
export default async function emailOrderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  let data: Awaited<ReturnType<typeof loadOrderEmailData>>
  try {
    data = await loadOrderEmailData(container, orderId)
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Order e-mails for ${orderId} skipped: ${(error as Error).message}`)
    return
  }

  const resource = { type: "order" as const, id: orderId }
  await sendEmail(container, {
    template: "order-confirmation",
    to: data.contact.email,
    data,
    resource,
    trigger: "order.placed",
    key: `order-confirmation:${orderId}`,
  })
  await sendStaffEmail(container, {
    template: "staff-new-order",
    data,
    resource,
    trigger: "order.placed",
    key: `staff-new-order:${orderId}`,
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "email-order-placed" },
}
