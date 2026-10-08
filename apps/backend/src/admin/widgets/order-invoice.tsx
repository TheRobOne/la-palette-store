import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import {
  INVOICE_NIP_METADATA_KEY,
  isInvoiceRequested,
} from "../../lib/invoice-metadata"
import { formatNip } from "../../lib/nip"

/**
 * Order details sidebar: whether the customer asked for a company invoice
 * and the data to issue it (order.metadata + order.billing_address, see
 * src/lib/invoice.ts).
 */
const OrderInvoiceWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const requested = isInvoiceRequested(order.metadata)
  const nip = order.metadata?.[INVOICE_NIP_METADATA_KEY]
  const address = order.billing_address

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Faktura</Heading>
        <Badge size="2xsmall" color={requested ? "green" : "grey"}>
          {requested ? "Tak" : "Nie"}
        </Badge>
      </div>
      {requested && (
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <Text size="small" weight="plus">
            {address?.company || "—"}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            NIP: {typeof nip === "string" ? formatNip(nip) : "—"}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            {address?.address_1 || "—"}
            {address?.address_2 ? `, ${address.address_2}` : ""}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            {[address?.postal_code, address?.city].filter(Boolean).join(" ") || "—"}
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderInvoiceWidget
