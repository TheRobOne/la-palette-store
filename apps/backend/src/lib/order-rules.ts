import {
  ContainerRegistrationKeys,
  MathBN,
  MedusaError,
} from "@medusajs/framework/utils"
import type { BigNumberInput, MedusaContainer } from "@medusajs/framework/types"
import { minOrderValueFromMetadata } from "./min-order-value"

/**
 * Store-wide order rules that the storefront shows in the cart and the
 * backend enforces when the cart is completed (constitution: the backend is
 * the source of truth for order rules).
 *
 * The minimum order value lives in the store's metadata so staff can change
 * it in the Admin (widget on Settings → Store) without a deploy.
 */
export {
  DEFAULT_MIN_ORDER_VALUE,
  MIN_ORDER_VALUE_METADATA_KEY,
  minOrderValueFromMetadata,
} from "./min-order-value"

/** Reads the minimum order value configured on the (single) store. */
export async function loadMinOrderValue(
  container: MedusaContainer
): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "metadata"],
  })
  return minOrderValueFromMetadata(stores[0]?.metadata)
}

/** "100,00 zł" — Polish formatting used in customer-facing messages. */
export function formatPln(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} zł`
}

/**
 * Throws an `invalid_data` error with a customer-readable Polish message
 * when the gross item total (after discounts, without shipping) is below
 * the minimum.
 */
export function assertMinOrderValue(
  itemTotal: BigNumberInput | null | undefined,
  minOrderValue: number
): void {
  const total = MathBN.convert(itemTotal ?? 0)
  if (!MathBN.lt(total, minOrderValue)) {
    return
  }

  const missing = MathBN.sub(minOrderValue, total).toNumber()
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Minimalna wartość zamówienia to ${formatPln(minOrderValue)}. ` +
      `Dodaj produkty za co najmniej ${formatPln(missing)}.`
  )
}
