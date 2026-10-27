import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadOrderEmailData, loadRequestEmailData } from "../lib/emails/data"
import { sendEmail } from "../lib/emails/send"
import { PICKUP_RESCHEDULED_EVENT, type PickupRescheduledData } from "../lib/request-events"

/**
 * Tells the customer that staff moved the pickup of their order or request
 * (spec 006 US4). Each move is one e-mail: the key includes `rescheduled_at`.
 */
export default async function emailPickupRescheduledHandler({
  event,
  container,
}: SubscriberArgs<PickupRescheduledData>) {
  const { id, order_id, previous, rescheduled_at } = event.data
  try {
    const data = order_id
      ? await loadOrderEmailData(container, order_id)
      : await loadRequestEmailData(container, id)
    await sendEmail(container, {
      template: "pickup-rescheduled",
      to: data.contact.email,
      data: { ...data, previous_term: previous },
      resource: order_id ? { type: "order", id: order_id } : { type: "pickup_request", id },
      trigger: PICKUP_RESCHEDULED_EVENT,
      key: `pickup-rescheduled:${id}:${rescheduled_at}`,
    })
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Reschedule e-mail for booking ${id} skipped: ${(error as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: PICKUP_RESCHEDULED_EVENT,
  context: { subscriberId: "email-pickup-rescheduled" },
}
