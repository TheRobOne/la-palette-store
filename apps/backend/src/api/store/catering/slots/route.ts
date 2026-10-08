import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { computeAvailability } from "../../../../modules/catering/scheduling/availability"
import { loadSchedulingContext } from "../../../../modules/catering/scheduling/load"
import { TIME_ZONE, warsawToday } from "../../../../modules/catering/scheduling/time"
import type { StoreSlotsQueryType } from "../../../validators/catering-scheduling"

/**
 * Available pickup terms (specs/004-pickup-scheduling/contracts/store-api.md §1).
 *
 * `GET /store/catering/slots?from=YYYY-MM-DD&to=YYYY-MM-DD[&method=pickup]`
 *
 * Every date of the range is returned; dates before today are reported as
 * `past`. Blocked-date reasons are staff-only and never returned.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreSlotsQueryType>,
  res: MedusaResponse
) {
  const { from, to, method } = req.validatedQuery as StoreSlotsQueryType
  const now = new Date()
  const loadFrom = from < warsawToday(now) ? warsawToday(now) : from

  const context = await loadSchedulingContext(req.scope, {
    method,
    from: loadFrom,
    to: to < loadFrom ? loadFrom : to,
    now,
  })
  const days = computeAvailability({ ...context, from, to })

  res.status(200).json({
    slots: { method, timezone: TIME_ZONE, from, to, days },
  })
}
