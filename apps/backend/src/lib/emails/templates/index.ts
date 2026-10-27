import { MedusaError } from "@medusajs/framework/utils"
import type { OrderEmailData, RenderedEmail, RequestEmailData } from "../types"
import { orderConfirmation, staffNewOrder } from "./order"
import { orderCanceled, pickupReminder, pickupRescheduled } from "./pickup"
import {
  requestCanceled,
  requestConfirmed,
  requestCreated,
  requestDeclined,
  requestExpired,
  staffNewRequest,
  staffRequestReminder,
} from "./request"

/**
 * Template registry: `notification.template` → renderer
 * (catalogue: specs/006-transactional-emails/contracts/emails.md).
 */
export const TEMPLATES = {
  "order-confirmation": orderConfirmation,
  "staff-new-order": staffNewOrder,
  "request-created": requestCreated,
  "request-confirmed": requestConfirmed,
  "request-declined": requestDeclined,
  "request-expired": requestExpired,
  "request-canceled": requestCanceled,
  "staff-new-request": staffNewRequest,
  "staff-request-reminder": staffRequestReminder,
  "pickup-rescheduled": pickupRescheduled,
  "order-canceled": orderCanceled,
  "pickup-reminder": pickupReminder,
} as const satisfies Record<string, (data: never) => RenderedEmail>

export type TemplateName = keyof typeof TEMPLATES

/** Data each template expects. */
export type TemplateData<T extends TemplateName> = Parameters<(typeof TEMPLATES)[T]>[0]

export type AnyEmailData = OrderEmailData | RequestEmailData

export function isTemplateName(name: unknown): name is TemplateName {
  return typeof name === "string" && name in TEMPLATES
}

export function renderTemplate(name: string, data: unknown): RenderedEmail {
  if (!isTemplateName(name)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown e-mail template "${name}"`)
  }
  return (TEMPLATES[name] as (d: unknown) => RenderedEmail)(data)
}
