import type { Logger } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { Resend } from "resend"
import { renderTemplate } from "../../lib/emails/templates"
import type { EmailDeliveryOptions } from "./options"

export type { EmailDeliveryOptions } from "./options"
export { emailOptionsFromEnv, parseAllowlist } from "./options"

/**
 * Delivery of one e-mail through Resend (specs/006-transactional-emails
 * research R-02/R-03). Shared by the notification provider's `send()` and the
 * retry job, which re-delivers a failed notification and updates its row
 * itself (research R-11).
 */
export type EmailToDeliver = {
  to: string
  template: string
  data: unknown
  idempotency_key?: string | null
}

/** `logged` / `suppressed` = not sent on purpose (no API key / not allowed here). */
export type DeliveryResult = { id: string }

export function isAllowedRecipient(to: string, options: EmailDeliveryOptions): boolean {
  if (options.app_env === "production") {
    return true
  }
  const address = to.trim().toLowerCase()
  return options.allowlist.some((entry) =>
    entry.startsWith("@") ? address.endsWith(entry) : address === entry
  )
}

/** Throws on a Resend error, so the Notification Module marks the e-mail `failure`. */
export async function deliverEmail(
  options: EmailDeliveryOptions,
  email: EmailToDeliver,
  logger: Pick<Logger, "info">,
  client: Pick<Resend, "emails"> | null = options.api_key ? new Resend(options.api_key) : null
): Promise<DeliveryResult> {
  const rendered = renderTemplate(email.template, email.data)

  if (!client) {
    logger.info(`[e-mail logged] ${email.template} → ${email.to}: ${rendered.subject}`)
    return { id: "logged" }
  }
  if (!isAllowedRecipient(email.to, options)) {
    logger.info(
      `[e-mail suppressed] ${email.template} → ${email.to} (not on NOTIFICATION_ALLOWLIST outside production)`
    )
    return { id: "suppressed" }
  }

  const { data, error } = await client.emails.send(
    {
      from: options.from,
      to: email.to,
      ...(options.reply_to ? { replyTo: options.reply_to } : {}),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    },
    // Resend keeps the key for 24 h: a retry never sends the same e-mail twice
    email.idempotency_key ? { idempotencyKey: email.idempotency_key } : undefined
  )
  if (error || !data) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Resend: ${error?.message ?? "no response"}`)
  }
  return { id: data.id }
}
