import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { BigNumberInput } from "@medusajs/framework/types"
import { assertInvoiceData } from "./invoice"
import { assertMinOrderValue, loadMinOrderValue } from "./order-rules"
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
  shipping_methods?: { id: string }[] | null
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

/**
 * Order rules shared by standard completion and sending a request, in the
 * contract order: minimum order value → invoice data → term present.
 * Returns the parsed term; term availability is checked by the caller under
 * the capacity lock.
 */
export async function assertCartOrderRules(
  container: MedusaContainer,
  cart: Pick<CartForChecks, "item_total" | "metadata" | "billing_address">
): Promise<CateringTerm> {
  const minOrderValue = await loadMinOrderValue(container)
  assertMinOrderValue(cart.item_total, minOrderValue)
  assertInvoiceData(cart)

  const term = parseTerm(cart.metadata)
  if (!term) {
    throw missingTermError()
  }
  return term
}
