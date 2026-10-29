import { parsePostalCode } from "./postal-code"

/**
 * Pure delivery pricing (specs/007-delivery-zones data-model.md "Derived:
 * delivery quote"). No I/O: the quote route, the pricing hook and the
 * completion check all feed it the same inputs (src/lib/delivery.ts).
 */

export type ZoneForQuote = {
  id: string
  name: string
  price: number
  min_order_value: number | null
  codes: string[]
}

export type QuoteInputs = {
  postalCode: unknown
  /** gross item total after discounts, without shipping */
  itemTotal: number
  zones: ZoneForQuote[]
  /** null = no free delivery */
  freeThreshold: number | null
  globalMinimum: number
  /**
   * The cart's confirmed out-of-zone request, if any: its postal code and the
   * staff-set cost. For that same code the agreed cost and the request path
   * stay, even if the code was added to a zone later (spec 007 FR-010).
   */
  confirmed?: { postal_code: string; cost: number } | null
}

export type DeliveryQuote =
  | {
      status: "invalid"
      postal_code: string | null
      zone: null
      amount: null
      min_order_value: number
      requires_confirmation: false
    }
  | {
      status: "in_zone"
      postal_code: string
      zone: { id: string; name: string }
      amount: number
      min_order_value: number
      requires_confirmation: false
    }
  | {
      status: "out_of_zone"
      postal_code: string
      zone: null
      amount: number | null
      min_order_value: number
      requires_confirmation: true
    }

/** The zone whose list contains the code, if any (one code, one zone). */
export function matchZone<Z extends { codes: string[] }>(postalCode: string, zones: Z[]): Z | null {
  return zones.find((zone) => zone.codes.includes(postalCode)) ?? null
}

export function quoteDelivery(inputs: QuoteInputs): DeliveryQuote {
  const postalCode = parsePostalCode(inputs.postalCode)
  if (!postalCode) {
    return {
      status: "invalid",
      postal_code: typeof inputs.postalCode === "string" ? inputs.postalCode.trim() : null,
      zone: null,
      amount: null,
      min_order_value: inputs.globalMinimum,
      requires_confirmation: false,
    }
  }

  const confirmed = inputs.confirmed?.postal_code === postalCode ? inputs.confirmed : null
  const zone = confirmed ? null : matchZone(postalCode, inputs.zones)
  if (!zone) {
    return {
      status: "out_of_zone",
      postal_code: postalCode,
      zone: null,
      amount: confirmed?.cost ?? null,
      min_order_value: inputs.globalMinimum,
      requires_confirmation: true,
    }
  }

  const free = inputs.freeThreshold !== null && inputs.itemTotal >= inputs.freeThreshold
  return {
    status: "in_zone",
    postal_code: postalCode,
    zone: { id: zone.id, name: zone.name },
    amount: free ? 0 : zone.price,
    // the global minimum always applies; a zone can only raise it
    min_order_value: Math.max(inputs.globalMinimum, zone.min_order_value ?? 0),
    requires_confirmation: false,
  }
}
