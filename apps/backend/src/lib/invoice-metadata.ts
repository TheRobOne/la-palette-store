/**
 * Cart/order metadata keys for the optional company invoice. Dependency-free
 * on purpose: shared by the server (src/lib/invoice.ts) and the Admin widget
 * bundle (src/admin/widgets/order-invoice.tsx).
 */
export const INVOICE_REQUESTED_METADATA_KEY = "invoice_requested"
export const INVOICE_NIP_METADATA_KEY = "invoice_nip"

/** Only a literal `true` counts — "false", "0" or a missing key mean no invoice. */
export function isInvoiceRequested(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  return metadata?.[INVOICE_REQUESTED_METADATA_KEY] === true
}
