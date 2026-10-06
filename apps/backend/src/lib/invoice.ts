import { MedusaError } from "@medusajs/framework/utils"
import {
  INVOICE_NIP_METADATA_KEY,
  isInvoiceRequested,
} from "./invoice-metadata"
import { isValidNip } from "./nip"

/**
 * Optional company invoice (constitution II). Storage — copied to the order
 * by completeCartWorkflow (verified in Medusa 2.21.1 core-flows):
 *
 * - cart.metadata.invoice_requested (boolean) and cart.metadata.invoice_nip
 *   → order.metadata
 * - company name and address in cart.billing_address (company, address_1,
 *   postal_code, city, country_code) → order.billing_address
 *
 * Contract: apps/backend/AGENTS.md → "Kontrakty dla storefrontu".
 */
export {
  INVOICE_NIP_METADATA_KEY,
  INVOICE_REQUESTED_METADATA_KEY,
  isInvoiceRequested,
} from "./invoice-metadata"

type InvoiceAddress = {
  company?: string | null
  address_1?: string | null
  postal_code?: string | null
  city?: string | null
  country_code?: string | null
} | null

const isBlank = (value: string | null | undefined) => !value?.trim()

/**
 * Throws an `invalid_data` error with a customer-readable Polish message
 * when an invoice is requested but the NIP or company data is missing or
 * invalid. Does nothing when no invoice is requested.
 */
export function assertInvoiceData(cart: {
  metadata?: Record<string, unknown> | null
  billing_address?: InvoiceAddress
}): void {
  if (!isInvoiceRequested(cart.metadata)) {
    return
  }

  const nip = cart.metadata?.[INVOICE_NIP_METADATA_KEY]
  if (typeof nip !== "string" || !isValidNip(nip)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Podany NIP jest nieprawidłowy. Sprawdź numer i spróbuj ponownie."
    )
  }

  const address = cart.billing_address
  const missing = [
    isBlank(address?.company) && "nazwa firmy",
    isBlank(address?.address_1) && "ulica i numer",
    isBlank(address?.postal_code) && "kod pocztowy",
    isBlank(address?.city) && "miejscowość",
  ].filter(Boolean)

  if (missing.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Uzupełnij dane do faktury: ${missing.join(", ")}.`
    )
  }
}
