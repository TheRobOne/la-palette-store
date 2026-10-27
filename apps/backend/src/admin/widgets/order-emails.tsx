import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import {
  type AdminEmailDto,
  EMAIL_STATUS_LABELS,
  emailTemplateLabel,
} from "../../lib/emails/template-labels"
import { adminFetch, formatDateTime } from "../lib/catering-api"

const STATUS_COLOR = { success: "green", pending: "orange", failure: "red" } as const

/**
 * Order details sidebar: e-mails sent for this order, including those of the
 * request it was paid from (specs/006-transactional-emails FR-009).
 */
const OrderEmailsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [emails, setEmails] = useState<AdminEmailDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch<{ notifications: AdminEmailDto[] }>(
      `/admin/catering/notifications?resource_id=${order.id}`
    )
      .then(({ notifications }) => setEmails(notifications))
      .catch((e) => setError(String(e)))
  }, [order.id])

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">E-maile</Heading>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {error ? (
          <Text size="small" className="text-ui-fg-error">
            Nie udało się wczytać maili: {error}
          </Text>
        ) : !emails ? (
          <Text size="small">Wczytywanie…</Text>
        ) : emails.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Brak wysłanych maili.
          </Text>
        ) : (
          emails.map((e) => (
            <div key={e.id} className="flex flex-col gap-y-0.5">
              <div className="flex items-center justify-between gap-x-2">
                <Text size="small" weight="plus">
                  {emailTemplateLabel(e.template)}
                </Text>
                <Badge size="2xsmall" color={STATUS_COLOR[e.status] ?? "grey"}>
                  {EMAIL_STATUS_LABELS[e.status] ?? e.status}
                </Badge>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {e.to} · {formatDateTime(e.created_at)}
                {e.attempts > 1 ? ` · próby: ${e.attempts}` : ""}
              </Text>
            </div>
          ))
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderEmailsWidget
