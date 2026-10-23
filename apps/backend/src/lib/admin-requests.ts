import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

/**
 * Requests for the Admin (contracts/admin-api.md "Requests"): booking state
 * plus contact e-mail, items and total from the cart, sorted by the nearest
 * deadline.
 */
export async function listAdminRequests(
  container: MedusaContainer,
  filter: { status?: string[]; from?: string; to?: string; ids?: string[] }
) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const bookings = await catering.listBookings({
    requires_confirmation: true,
    ...(filter.ids ? { id: filter.ids } : {}),
    ...(filter.status?.length ? { status: filter.status as never } : {}),
    ...(filter.from || filter.to
      ? {
          date: {
            ...(filter.from ? { $gte: filter.from } : {}),
            ...(filter.to ? { $lte: filter.to } : {}),
          },
        }
      : {}),
  })

  const cartIds = [...new Set(bookings.map((b) => b.cart_id))]
  const { data: carts } = cartIds.length
    ? await query.graph({
        entity: "cart",
        fields: ["id", "email", "item_total", "items.title", "items.quantity"],
        filters: { id: cartIds },
      })
    : { data: [] }
  const cartById = new Map(carts.map((c) => [c.id as string, c]))

  const deadlineOf = (b: (typeof bookings)[number]) =>
    new Date(
      (b.status === "confirmed" ? b.payment_deadline : b.response_deadline) ?? `${b.date}T23:59:59Z`
    ).getTime()

  return [...bookings]
    .sort((a, b) => deadlineOf(a) - deadlineOf(b))
    .map((b) => {
      const cart = cartById.get(b.cart_id) as
        | { email?: string | null; item_total?: unknown; items?: { title?: string | null; quantity: number }[] }
        | undefined
      return {
        id: b.id,
        cart_id: b.cart_id,
        status: b.status,
        term: { method: b.fulfillment_method, date: b.date, start: b.start_time, end: b.end_time },
        response_deadline: iso(b.response_deadline),
        payment_deadline: iso(b.payment_deadline),
        email: cart?.email ?? null,
        item_total: cart?.item_total != null ? Number(cart.item_total) : null,
        items: (cart?.items ?? []).map((i) => ({ title: i.title ?? null, quantity: Number(i.quantity) })),
        decided_at: iso(b.decided_at),
        order_id: b.order_id ?? null,
      }
    })
}
