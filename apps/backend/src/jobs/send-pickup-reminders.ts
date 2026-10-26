import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadOrderEmailData } from "../lib/emails/data"
import { reminderDate, selectPickupReminders } from "../lib/emails/pickup-reminders"
import { sendEmail } from "../lib/emails/send"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

/**
 * Pickup reminder the day before (spec 006 US5). Hourly instead of a single
 * 08:00 run: survives restarts and DST without cron time zones; the key per
 * order and date sends each reminder once, and a reschedule to another day
 * gets a reminder for the new date only.
 */
export async function sendPickupReminders(container: MedusaContainer, now = new Date()) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const bookings = await catering.listBookings({ status: "active", date: reminderDate(now) })
  const orderIds = bookings.map((b) => b.order_id).filter((id): id is string => !!id)
  if (!orderIds.length) {
    return { reminded: [] as string[] }
  }
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "created_at", "status"],
    filters: { id: orderIds },
  })
  const placedAt = new Map(
    orders
      .filter((o) => o.status !== "canceled")
      .map((o) => [o.id as string, o.created_at as Date | string])
  )

  const selected = selectPickupReminders(bookings, placedAt, now)
  for (const { order_id, date } of selected) {
    try {
      const data = await loadOrderEmailData(container, order_id)
      await sendEmail(container, {
        template: "pickup-reminder",
        to: data.contact.email,
        data,
        resource: { type: "order", id: order_id },
        trigger: "send-pickup-reminders",
        key: `pickup-reminder:${order_id}:${date}`,
      })
    } catch (error) {
      logger.error(`Pickup reminder for ${order_id} failed: ${(error as Error).message}`)
    }
  }
  return { reminded: selected.map((s) => s.order_id) }
}

export default async function sendPickupRemindersJob(container: MedusaContainer) {
  await sendPickupReminders(container)
}

export const config = {
  name: "send-pickup-reminders",
  schedule: "5 * * * *",
}
