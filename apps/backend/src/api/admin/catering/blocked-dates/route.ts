import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATERING_MODULE } from "../../../../modules/catering"
import type CateringModuleService from "../../../../modules/catering/service"
import { blockDateWorkflow } from "../../../../workflows/block-date"
import type {
  AdminBlockDateBodyType,
  DateRangeQueryType,
} from "../../../validators/catering-scheduling"

const toDto = (b: { id: string; date: string; fulfillment_method: string | null; reason: string | null }) => ({
  id: b.id,
  date: b.date,
  method: b.fulfillment_method,
  reason: b.reason,
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

/** `POST /admin/catering/blocked-dates` → `{ blocked_date, existing_orders }` */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminBlockDateBodyType>,
  res: MedusaResponse
) {
  const { result } = await blockDateWorkflow(req.scope).run({
    input: {
      date: req.validatedBody.date,
      method: req.validatedBody.method ?? null,
      reason: req.validatedBody.reason ?? null,
    },
  })
  res.json({ blocked_date: toDto(result.blocked_date), existing_orders: result.existing_orders })
}
