import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { loadNotificationSettings } from "../notification-settings"
import type { TemplateData, TemplateName } from "./templates"

/**
 * Sends one e-mail through the Notification Module (spec 006 research R-01).
 *
 * - `key` is the notification's idempotency key: the same key never sends
 *   twice (FR-007); a failed one is retried by the retry job.
 * - Errors are logged and swallowed — an e-mail never blocks or rolls back an
 *   order or a request (FR-008); the module has already recorded `failure`.
 */
export type EmailResource = { type: "order" | "pickup_request"; id: string }

export type SendEmailInput<T extends TemplateName> = {
  template: T
  to: string | null | undefined
  data: TemplateData<T>
  resource: EmailResource
  /** event or job that triggered it, e.g. `order.placed` */
  trigger: string
  key: string
}

export async function sendEmail<T extends TemplateName>(
  container: MedusaContainer,
  input: SendEmailInput<T>
): Promise<boolean> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!input.to) {
    logger.warn(`E-mail ${input.template} (${input.key}) skipped: no recipient address`)
    return false
  }
  try {
    const notifications = container.resolve(Modules.NOTIFICATION)
    await notifications.createNotifications({
      to: input.to,
      channel: "email",
      template: input.template,
      data: { ...input.data, _attempts: 1 } as Record<string, unknown>,
      resource_type: input.resource.type,
      resource_id: input.resource.id,
      trigger_type: input.trigger,
      idempotency_key: input.key,
    })
    return true
  } catch (error) {
    logger.error(
      `E-mail ${input.template} → ${input.to} (${input.key}) failed: ${(error as Error).message}`
    )
    return false
  }
}

/** Staff e-mail to the address set in the Admin; skipped (logged) when none is set. */
export async function sendStaffEmail<T extends TemplateName>(
  container: MedusaContainer,
  input: Omit<SendEmailInput<T>, "to">
): Promise<boolean> {
  const { staffEmail } = await loadNotificationSettings(container)
  if (!staffEmail) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(`Staff e-mail ${input.template} skipped: no staff address set (Settings → Store)`)
    return false
  }
  return sendEmail(container, { ...input, to: staffEmail })
}
