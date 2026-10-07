import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../../../../modules/catering"
import type CateringModuleService from "../../../../modules/catering/service"
import { addDays, isoWeekday } from "../../../../modules/catering/scheduling/time"
import type { DateRangeQueryType } from "../../../validators/catering-scheduling"

type OrderSummary = {
  order_id: string | null
  display_id: number | null
  email: string | null
  status: string | null
}

/**
 * `GET /admin/catering/calendar?from&to` — active bookings grouped by day and
 * window, with used/total capacity and blocked days (contracts/admin-api.md).
 * Windows come from the current pickup rules plus any booked window that is
 * no longer in the rules.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, DateRangeQueryType>,
  res: MedusaResponse
) {
  const { from, to } = req.validatedQuery as DateRangeQueryType
  const catering: CateringModuleService = req.scope.resolve(CATERING_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [[settings], windows, blocked, bookings] = await Promise.all([
    catering.listSchedulingSettings({}, { take: 1 }),
    catering.listWindowRules({ fulfillment_method: "pickup" }),
    catering.listBlockedDates({ date: { $gte: from, $lte: to } }),
    catering.listBookings({ status: "active", date: { $gte: from, $lte: to } }),
  ])

  const orderIds = bookings.map((b) => b.order_id).filter((id): id is string => !!id)
  const { data: orders } = orderIds.length
    ? await query.graph({
        entity: "order",
        fields: ["id", "display_id", "email", "status"],
        filters: { id: orderIds },
      })
    : { data: [] }
  const orderById = new Map(orders.map((o) => [o.id as string, o]))

  const days = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const dayBookings = bookings.filter((b) => b.date === date)
    const slots = new Map<string, { start: string; end: string; orders: OrderSummary[] }>()
    const slot = (start: string, end: string) => {
      const key = `${start}-${end}`
      if (!slots.has(key)) {
        slots.set(key, { start, end, orders: [] })
      }
      return slots.get(key)!
    }

    windows
      .filter((w) => w.weekday === isoWeekday(date))
      .forEach((w) => slot(w.start_time, w.end_time))
    for (const b of dayBookings) {
      const order = b.order_id ? orderById.get(b.order_id) : undefined
      slot(b.start_time, b.end_time).orders.push({
        order_id: b.order_id ?? null,
        display_id: (order?.display_id as number | undefined) ?? null,
        email: (order?.email as string | undefined) ?? null,
        status: (order?.status as string | undefined) ?? null,
      })
    }

    const block =
      blocked.find((b) => b.date === date && b.fulfillment_method === null) ??
      blocked.find((b) => b.date === date)

    days.push({
      date,
      blocked: block
        ? { id: block.id, reason: block.reason, method: block.fulfillment_method }
        : null,
      used: dayBookings.length,
      windows: [...slots.values()].sort((a, b) => a.start.localeCompare(b.start)),
    })
  }

  res.json({ calendar: { daily_capacity: settings?.daily_capacity ?? 0, days } })
}
