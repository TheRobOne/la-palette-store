/**
 * Free-delivery threshold stored in the store's metadata
 * (specs/007-delivery-zones research R-07). Dependency-free on purpose, like
 * min-order-value.ts: shared by the server and the Admin widget bundle.
 */
export const FREE_DELIVERY_THRESHOLD_METADATA_KEY = "catering_free_delivery_threshold"

/**
 * Reads the threshold (gross PLN) from store metadata: a number or numeric
 * string > 0; anything else (absent, empty, 0, a typo) means no free
 * delivery — the launch value — so a typo never makes delivery free.
 */
export function freeDeliveryThresholdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  const raw = metadata?.[FREE_DELIVERY_THRESHOLD_METADATA_KEY]
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw.replace(",", "."))
        : NaN

  return Number.isFinite(value) && value > 0 ? value : null
}
