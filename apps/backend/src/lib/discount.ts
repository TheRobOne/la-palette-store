/**
 * Discount codes applied to a cart or an order (apps/backend/AGENTS.md "Discount codes"),
 * for e-mails and the Admin requests list. The amounts are the differences
 * between Medusa's totals before and after discounts — fields both the cart
 * and the order compute — so no promotion data is read.
 */

/** query.graph fields `discountOf` needs, on a cart or an order. */
export const DISCOUNT_FIELDS = [
  "item_total",
  "original_item_total",
  "shipping_total",
  "original_shipping_total",
  "items.adjustments.code",
  "shipping_methods.adjustments.code",
]

export type Discount = {
  /** promotion codes, sorted */
  codes: string[]
  /** gross PLN off the products */
  items_amount: number
  /** gross PLN off the delivery */
  shipping_amount: number
}

type Adjusted = { adjustments?: { code?: string | null }[] | null }

export type DiscountSource = {
  item_total?: unknown
  original_item_total?: unknown
  shipping_total?: unknown
  original_shipping_total?: unknown
  items?: Adjusted[] | null
  shipping_methods?: Adjusted[] | null
}

const cents = (value: number) => Math.round(value * 100) / 100

const difference = (original: unknown, current: unknown) =>
  original === null || original === undefined || current === null || current === undefined
    ? 0
    : Math.max(0, cents(Number(original) - Number(current)))

export function discountOf(source: DiscountSource | null | undefined): Discount | null {
  if (!source) {
    return null
  }
  const items_amount = difference(source.original_item_total, source.item_total)
  const shipping_amount = difference(source.original_shipping_total, source.shipping_total)
  if (items_amount === 0 && shipping_amount === 0) {
    return null
  }
  const codes = new Set(
    [...(source.items ?? []), ...(source.shipping_methods ?? [])].flatMap((line) =>
      (line.adjustments ?? []).flatMap((a) => (a.code ? [a.code] : []))
    )
  )
  return { codes: [...codes].sort(), items_amount, shipping_amount }
}
