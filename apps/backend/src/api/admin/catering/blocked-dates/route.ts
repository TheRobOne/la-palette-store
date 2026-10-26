import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATERING_MODULE } from "../../../../modules/catering"
import type CateringModuleService from "../../../../modules/catering/service"
import { blockDateWorkflow } from "../../../../workflows/block-date"
import type {
  AdminBlockDateBodyType,
  DateRangeQueryType,
} from "../../../validators/catering-scheduling"

const toDto = (b: {
  id: string
  date: string
  fulfillment_method: string | null
  reason: string | null
  period_id: string | null
}) => ({
  id: b.id,
  date: b.date,
  method: b.fulfillment_method,
  reason: b.reason,
  period_id: b.period_id,
})

/** `GET /admin/catering/blocked-dates?from&to` */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, DateRangeQueryType>,
  res: MedusaResponse
) {
  const { from, to } = req.validatedQuery as DateRangeQueryType
  const catering: CateringModuleService = req.scope.resolve(CATERING_MODULE)
  const blocked = await catering.listBlockedDates(
    { date: { $gte: from, $lte: to } },
    { order: { date: "ASC" } }
  )
  res.json({ blocked_dates: blocked.map(toDto) })
}

/**
 * `POST /admin/catering/blocked-dates` `{ date }` or `{ from, to }` →
 * `{ blocked_date, blocked_dates, period_id, skipped_dates, existing_orders }`
 * (`blocked_date` = the first created day, kept for 004 clients).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminBlockDateBodyType>,
  res: MedusaResponse
) {
  const { date, from, to, method, reason } = req.validatedBody
  const { result } = await blockDateWorkflow(req.scope).run({
    input: {
      from: (date ?? from)!,
      to: (date ?? to)!,
      method: method ?? null,
      reason: reason ?? null,
    },
  })
  const blocked = result.blocked_dates.map(toDto)
  res.json({
    blocked_date: blocked[0],
    blocked_dates: blocked,
    period_id: result.period_id,
    skipped_dates: result.skipped_dates,
    existing_orders: result.existing_orders,
  })
}
