import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { BigNumberInput } from "@medusajs/framework/types"
import { assertInvoiceData } from "./invoice"
import { quoteForCart } from "./delivery"
import {
  assertDeliveryAddress,
  assertDeliveryQuote,
  assertMethodMatchesOption,
} from "./delivery-checks"
import { assertMinOrderValue, loadMinOrderValue } from "./order-rules"
import type { DeliveryQuote } from "../modules/catering/delivery/quote"
import type { FulfillmentMethod } from "../modules/catering/models/fulfillment-schedule"
import {
  type CateringTerm,
  missingTermError,
  parseTerm,
} from "../modules/catering/scheduling/term"

/**
 * The cart fields the order rules need — the same computed fields
 * completeCartWorkflow reads (`completeCartFields`), so the request route
 * (spec 005) and the completion hook check exactly the same data.
 */
export const CART_CHECK_FIELDS = [
  "id",
  "email",
  "item_total",
  "metadata",
  "completed_at",
  "billing_address.*",
  "items.id",
  "items.variant_id",
  "items.quantity",
  "items.title",
  "shipping_methods.id",
  "shipping_methods.amount",
  "shipping_methods.shipping_option_id",
  "shipping_address.*",
]

export type CartForChecks = {
  id: string
  email?: string | null
  item_total?: BigNumberInput | null
  metadata?: Record<string, unknown> | null
  completed_at?: Date | string | null
  billing_address?: {
    company?: string | null
    address_1?: string | null
    postal_code?: string | null
    city?: string | null
    country_code?: string | null
  } | null
  items?: { id?: string; variant_id?: string | null; quantity: number; title?: string | null }[] | null
  shipping_methods?: {
    id: string
    amount?: BigNumberInput | null
    shipping_option_id?: string | null
  }[] | null
  shipping_address?: {
    address_1?: string | null
    postal_code?: string | null
    city?: string | null
    phone?: string | null
  } | null
}

export async function loadCartForChecks(
  container: MedusaContainer,
  cartId: string
): Promise<CartForChecks> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: CART_CHECK_FIELDS,
    filters: { id: cartId },
  })
  const cart = data[0] as CartForChecks | undefined
  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Cart ${cartId} not found`)
  }
  return cart
}

/** `type.code` of the cart's shipping option (pickup / delivery), if any. */
async function loadShippingOptionMethod(
  container: MedusaContainer,
  cart: Pick<CartForChecks, "shipping_methods">
): Promise<string | null> {
  const optionId = cart.shipping_methods?.[0]?.shipping_option_id
  if (!optionId) {
    return null
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "type.code"],
    filters: { id: optionId },
  })
  return (data[0] as { type?: { code?: string } } | undefined)?.type?.code ?? null
}

export type CartOrderCheck = {
  term: CateringTerm
  /** null for pickup */
  delivery: DeliveryQuote | null
}

/**
 * Order rules shared by standard completion and sending a request, in the
 * contract order: minimum order value → invoice data → term present →
 * method matches the shipping option → (delivery) address, postal code,
 * zone minimum (specs/007-delivery-zones contracts §7). Returns the parsed
 * term and the delivery quote; term availability is checked by the caller
 * under the capacity lock, the delivery amount by the completion hook.
 */
export async function assertCartOrderRules(
  container: MedusaContainer,
  cart: Pick<
    CartForChecks,
    "id" | "item_total" | "metadata" | "billing_address" | "shipping_methods" | "shipping_address"
  >
): Promise<CartOrderCheck> {
  const minOrderValue = await loadMinOrderValue(container)
  assertMinOrderValue(cart.item_total, minOrderValue)
  assertInvoiceData(cart)

  const optionMethod = await loadShippingOptionMethod(container, cart)
  const term = parseTerm(cart.metadata)
  if (!term) {
    throw missingTermError(optionMethod === "delivery" ? "delivery" : "pickup")
  }
  assertMethodMatchesOption(term.method, optionMethod as FulfillmentMethod | null)

  if (term.method !== "delivery") {
    return { term, delivery: null }
  }
  assertDeliveryAddress(cart.shipping_address)
  const delivery = await quoteForCart(container, cart)
  assertDeliveryQuote(delivery, cart.item_total)
  return { term, delivery }
}
