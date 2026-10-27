import type { BigNumberInput } from "@medusajs/framework/types"
import { MathBN, MedusaError } from "@medusajs/framework/utils"
import type { DeliveryQuote } from "../modules/catering/delivery/quote"
import type { FulfillmentMethod } from "../modules/catering/models/fulfillment-schedule"
import { formatPln } from "./order-rules"

/**
 * Delivery rules checked when a request is sent or a cart is completed
 * (specs/007-delivery-zones research R-06). Pure — the loading happens in
 * cart-order-checks.ts. Messages are the contract's (contracts/store-api.md
 * §7): `invalid_data` with customer-readable Polish text.
 */

export type DeliveryAddress = {
  address_1?: string | null
  postal_code?: string | null
  city?: string | null
  phone?: string | null
} | null | undefined

const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)

const ADDRESS_FIELDS: [keyof NonNullable<DeliveryAddress>, string][] = [
  ["address_1", "ulica i numer"],
  ["postal_code", "kod pocztowy"],
  ["city", "miejscowość"],
  ["phone", "telefon"],
]

/** `catering_term.method` must match the cart's shipping option (`type.code`). */
export function assertMethodMatchesOption(
  method: FulfillmentMethod,
  optionTypeCode: string | null | undefined
): void {
  if (optionTypeCode !== method) {
    throw invalid("Wybierz ponownie sposób odbioru lub dostawy.")
  }
}

export function assertDeliveryAddress(address: DeliveryAddress): void {
  const missing = ADDRESS_FIELDS.filter(([field]) => !address?.[field]?.trim()).map(
    ([, label]) => label
  )
  if (missing.length) {
    throw invalid(`Uzupełnij adres dostawy: ${missing.join(", ")}.`)
  }
}

/** Invalid code; the zone minimum (only above the global one, which is checked first). */
export function assertDeliveryQuote(
  quote: DeliveryQuote,
  itemTotal: BigNumberInput | null | undefined
): void {
  if (quote.status === "invalid") {
    throw invalid("Podaj poprawny kod pocztowy (XX-XXX).")
  }
  const total = MathBN.convert(itemTotal ?? 0)
  if (MathBN.lt(total, quote.min_order_value)) {
    const missing = MathBN.sub(quote.min_order_value, total).toNumber()
    throw invalid(
      `Minimalna wartość zamówienia z dostawą pod ten adres to ${formatPln(quote.min_order_value)}. ` +
        `Dodaj produkty za co najmniej ${formatPln(missing)}.`
    )
  }
}

/**
 * The delivery shipping method must carry exactly the quoted amount (zone
 * price, 0 above the threshold, or the staff-confirmed cost). Skipped while
 * the amount is unknown (out of zone before confirmation — refused later by
 * the request rules).
 */
export function assertDeliveryAmount(
  methodAmount: BigNumberInput | null | undefined,
  quote: DeliveryQuote
): void {
  if (quote.amount === null) {
    return
  }
  if (methodAmount === null || methodAmount === undefined) {
    throw invalid("Wybierz ponownie sposób odbioru lub dostawy.")
  }
  if (!MathBN.eq(MathBN.convert(methodAmount), quote.amount)) {
    throw invalid("Koszt dostawy się zmienił — sprawdź koszyk i spróbuj ponownie.")
  }
}

export function outOfZoneRequestError(): MedusaError {
  return invalid("Dostawa pod ten adres wymaga potwierdzenia kuchni — wyślij zapytanie.")
}
