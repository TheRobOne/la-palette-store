import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadRequestEmailData } from "../lib/emails/data"
import { sendEmail, sendStaffEmail } from "../lib/emails/send"
import type { TemplateName } from "../lib/emails/templates"
import { REQUEST_EVENTS } from "../lib/request-events"

/** Customer template per request event (spec 006 US2). */
const CUSTOMER_TEMPLATE: Record<string, TemplateName> = {
  [REQUEST_EVENTS.created]: "request-created",
  [REQUEST_EVENTS.confirmed]: "request-confirmed",
  [REQUEST_EVENTS.declined]: "request-declined",
  [REQUEST_EVENTS.expired]: "request-expired",
  [REQUEST_EVENTS.canceled]: "request-canceled",
}

/**
 * One customer e-mail per request state change (spec 006 FR-002) and, for a
 * new request, the staff alert (FR-003). Events come from
 * specs/005-on-request-terms (`src/lib/request-events.ts`). A paid request
 * gets the order confirmation instead (`order.placed`).
 */
export default async function emailRequestEventsHandler({
  event,
  container,
}: SubscriberArgs<{ id: string; cart_id: string }>) {
  const template = CUSTOMER_TEMPLATE[event.name]
  if (!template) {
    return
  }
  const bookingId = event.data.id
  let data: Awaited<ReturnType<typeof loadRequestEmailData>>
  try {
    data = await loadRequestEmailData(container, bookingId)
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Request e-mail ${template} for ${bookingId} skipped: ${(error as Error).message}`)
    return
  }

  const resource = { type: "pickup_request" as const, id: bookingId }
  await sendEmail(container, {
    template,
    to: data.contact.email,
    data,
    resource,
    trigger: event.name,
    key: `${template}:${bookingId}`,
  })
  if (event.name === REQUEST_EVENTS.created) {
    await sendStaffEmail(container, {
      template: "staff-new-request",
      data,
      resource,
      trigger: event.name,
      key: `staff-new-request:${bookingId}`,
    })
  }
}

export const config: SubscriberConfig = {
  event: Object.values(REQUEST_EVENTS),
  context: { subscriberId: "email-request-events" },
}
