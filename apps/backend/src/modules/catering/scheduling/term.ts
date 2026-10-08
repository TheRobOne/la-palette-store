import { MedusaError } from "@medusajs/framework/utils"
import { FULFILLMENT_METHODS, type FulfillmentMethod } from "../models/fulfillment-schedule"
import { formatPlDate, isValidDate, isValidTime } from "./time"

/**
 * The pickup term the storefront stores on the cart and Medusa copies to the
 * order (contracts/store-api.md §2, §4).
 */
export const CATERING_TERM_METADATA_KEY = "catering_term"

export type CateringTerm = {
  method: FulfillmentMethod
  date: string
  start: string
  end: string
}

/** The term from cart/order metadata, or null when missing or malformed. */
export function parseTerm(
  metadata: Record<string, unknown> | null | undefined
): CateringTerm | null {
  const raw = metadata?.[CATERING_TERM_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }

  const { method, date, start, end } = raw as Record<string, unknown>
  if (
    !FULFILLMENT_METHODS.includes(method as FulfillmentMethod) ||
    !isValidDate(date) ||
    !isValidTime(start) ||
    !isValidTime(end) ||
    start >= end
  ) {
    return null
  }

  return { method: method as FulfillmentMethod, date, start, end }
}

/** "20.10.2026, 11:00–12:00" */
export function formatTerm(term: Pick<CateringTerm, "date" | "start" | "end">): string {
  return `${formatPlDate(term.date)}, ${term.start}–${term.end}`
}

// Customer-facing messages (contracts/store-api.md §3) — `invalid_data` so
// the complete route answers 400 with the message as is.

export function missingTermError(): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_DATA, "Wybierz termin odbioru.")
}

export function unavailableTermError(term: CateringTerm): MedusaError {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Wybrany termin odbioru (${formatTerm(term)}) nie jest już dostępny. Wybierz inny termin.`
  )
}

export function lockBusyError(): MedusaError {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Nie udało się zarezerwować terminu. Spróbuj ponownie za chwilę."
  )
}
