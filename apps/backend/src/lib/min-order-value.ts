/**
 * Minimum order value stored in the store's metadata. Dependency-free on
 * purpose: shared by the server (src/lib/order-rules.ts) and the Admin
 * widget bundle (src/admin/widgets/min-order-value.tsx).
 */
export const MIN_ORDER_VALUE_METADATA_KEY = "catering_min_order_value"

/** Gross PLN, used when the store has no (valid) value configured. */
export const DEFAULT_MIN_ORDER_VALUE = 100

/**
 * Reads the minimum order value from store metadata. Accepts a number or a
 * numeric string (the Admin metadata editor stores strings); anything else
 * falls back to the default so a typo never disables the rule.
 */
export function minOrderValueFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): number {
  const raw = metadata?.[MIN_ORDER_VALUE_METADATA_KEY]
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw.replace(",", "."))
        : NaN

  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MIN_ORDER_VALUE
}
