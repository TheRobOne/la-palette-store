import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../../../../modules/catering"
import type CateringModuleService from "../../../../modules/catering/service"
import type { AdminNotificationsQueryType } from "../../../validators/notifications"

type NotificationRow = {
  id: string
  template?: string | null
  to: string
  status?: string
  resource_id?: string | null
  created_at: Date | string
  data?: Record<string, unknown> | null
}

/**
 * `GET /admin/catering/notifications?resource_id=<ids>` — e-mail history
 * (specs/006-transactional-emails/contracts/admin-api.md). For an order the
 * e-mails of the request it was paid from are included, reported under the
 * order id; newest first.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminNotificationsQueryType>,
  res: MedusaResponse
) {
  const ids = (req.validatedQuery as AdminNotificationsQueryType).resource_id
  const catering: CateringModuleService = req.scope.resolve(CATERING_MODULE)

  // request (booking) id → order id, for orders that were paid requests
  const bookings = await catering.listBookings(
    { order_id: ids, requires_confirmation: true },
    { select: ["id", "order_id"] }
  )
  const orderOfRequest = new Map(bookings.map((b) => [b.id, b.order_id as string]))

  const notifications = (await req.scope.resolve(Modules.NOTIFICATION).listNotifications(
    { channel: "email", resource_id: [...ids, ...orderOfRequest.keys()] },
    { order: { created_at: "DESC" }, take: 500 }
  )) as unknown as NotificationRow[]

  res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      resource_id: orderOfRequest.get(n.resource_id ?? "") ?? n.resource_id,
      template: n.template,
      to: n.to,
      status: n.status,
      created_at: new Date(n.created_at).toISOString(),
      attempts: Number(n.data?._attempts ?? 1),
    })),
  })
}
