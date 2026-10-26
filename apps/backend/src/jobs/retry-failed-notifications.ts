import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { deliverEmail, emailOptionsFromEnv } from "../modules/resend/deliver"

export const MAX_ATTEMPTS = 5
const WINDOW_MS = 24 * 3_600_000

type FailedNotification = {
  id: string
  to: string
  channel: string
  template?: string | null
  data?: Record<string, unknown> | null
  idempotency_key?: string | null
}

/**
 * The parts of the Notification Module this job uses. `status` filtering and
 * `updateNotifications` exist on the module (MedusaService) but not on its
 * public interface type.
 */
type NotificationStore = {
  listNotifications(
    filters: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<FailedNotification[]>
  updateNotifications(data: Record<string, unknown>): Promise<unknown>
}

/**
 * Re-delivers failed e-mails (spec 006 FR-008): `failure` notifications of the
 * last 24 h with fewer than 5 attempts. It updates the existing row itself —
 * the module's own resend through the idempotency key would not (research
 * R-11) — and Resend's idempotency key prevents a double send if a "failed"
 * attempt had in fact gone out.
 */
export async function retryFailedNotifications(container: MedusaContainer, now = new Date()) {
  const notifications = container.resolve(Modules.NOTIFICATION) as unknown as NotificationStore
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const options = emailOptionsFromEnv()

  const failed = await notifications.listNotifications(
    {
      channel: "email",
      status: "failure",
      created_at: { $gte: new Date(now.getTime() - WINDOW_MS).toISOString() },
    },
    { take: 100 }
  )

  const result = { sent: [] as string[], failed: [] as string[] }
  for (const notification of failed) {
    const attempts = Number(notification.data?._attempts ?? 1)
    if (attempts >= MAX_ATTEMPTS || !notification.template) {
      continue
    }
    const data = { ...(notification.data ?? {}), _attempts: attempts + 1 }
    try {
      const { id } = await deliverEmail(
        options,
        {
          to: notification.to,
          template: notification.template,
          data: notification.data,
          idempotency_key: notification.idempotency_key,
        },
        logger
      )
      await notifications.updateNotifications({ id: notification.id, status: "success", external_id: id, data })
      result.sent.push(notification.id)
    } catch (error) {
      await notifications.updateNotifications({ id: notification.id, data })
      logger.warn(
        `E-mail ${notification.template} → ${notification.to} failed again (attempt ${attempts + 1}/${MAX_ATTEMPTS}): ${(error as Error).message}`
      )
      result.failed.push(notification.id)
    }
  }
  if (result.sent.length || result.failed.length) {
    logger.info(`E-mail retries: ${result.sent.length} sent, ${result.failed.length} still failing.`)
  }
  return result
}

export default async function retryFailedNotificationsJob(container: MedusaContainer) {
  await retryFailedNotifications(container)
}

export const config = {
  name: "retry-failed-notifications",
  schedule: "*/15 * * * *",
}
