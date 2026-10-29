/**
 * Minimum cart value of a discount code (apps/backend/AGENTS.md "Discount codes"). The
 * Admin of Medusa 2.21 offers no "cart total" condition, so the minimum is a
 * promotion rule on `original_item_total` — the gross item total before
 * discounts, a field of the cart Medusa evaluates promotion rules against.
 * Below it the code does not apply, and it drops off when the cart falls
 * below. Dependency-free: shared by the server and the Admin widget bundle.
 */
export const PROMOTION_MIN_ORDER_ATTRIBUTE = "original_item_total"

type RuleLike = {
  attribute?: string | null
  operator?: string | null
  values?: ({ value?: string | null } | string)[] | null
}

/** The minimum (gross PLN) set on a promotion's rules, or null. */
export function promotionMinOrderValue(rules: RuleLike[] | null | undefined): number | null {
  const rule = (rules ?? []).find(
    (r) => r.attribute === PROMOTION_MIN_ORDER_ATTRIBUTE && r.operator === "gte"
  )
  const raw = rule?.values?.[0]
  const value = Number(typeof raw === "string" ? raw : raw?.value)
  return rule && Number.isFinite(value) ? value : null
}
