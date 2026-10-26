/**
 * Options of the Resend provider (spec 006 research R-03). Dependency-free:
 * read by medusa-config.ts and by the retry job.
 */
export type EmailDeliveryOptions = {
  /** empty → e-mails are only logged (local, CI, tests) */
  api_key?: string
  from: string
  reply_to?: string
  /** `production` sends to anyone; any other value only to the allow-list */
  app_env: string
  /** addresses or `@domain` suffixes allowed outside production */
  allowlist: string[]
}

export function parseAllowlist(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

/** Provider options from the environment (medusa-config.ts and the retry job). */
export function emailOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): EmailDeliveryOptions {
  return {
    api_key: env.RESEND_API_KEY || undefined,
    from: env.EMAIL_FROM || "La Palette Garden – Catering <catering@lapalettegarden.pl>",
    reply_to: env.EMAIL_REPLY_TO || undefined,
    app_env: env.APP_ENV ?? "local",
    allowlist: parseAllowlist(env.NOTIFICATION_ALLOWLIST),
  }
}
