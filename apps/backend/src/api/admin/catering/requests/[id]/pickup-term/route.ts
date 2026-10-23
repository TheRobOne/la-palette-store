import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { listAdminRequests } from "../../../../../../lib/admin-requests"
import { CATERING_MODULE } from "../../../../../../modules/catering"
import type CateringModuleService from "../../../../../../modules/catering/service"
import { checkTerm } from "../../../../../../modules/catering/scheduling/availability"
import { loadSchedulingContext } from "../../../../../../modules/catering/scheduling/load"
import { rescheduleOrderPickupWorkflow } from "../../../../../../workflows/reschedule-order-pickup"
import type { AdminRescheduleBodyType } from "../../../../../validators/catering-scheduling"

/**
 * `POST /admin/catering/requests/:id/pickup-term` `{ date, start, end, confirm? }` —
 * move a not-yet-paid request (spec 005 edge case); same 409 warnings as the
 * order reschedule (004 contracts/admin-api.md). State and deadlines stay.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminRescheduleBodyType>,
  res: MedusaResponse
) {
  const { date, start, end, confirm } = req.validatedBody
  const catering: CateringModuleService = req.scope.resolve(CATERING_MODULE)
  const [booking] = await catering.listBookings({
    id: req.params.id,
    requires_confirmation: true,
    status: ["requested", "confirmed"],
  })
  if (!booking) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No open request with this id")
  }

  if (!confirm) {
    const context = await loadSchedulingContext(req.scope, {
      method: booking.fulfillment_method,
      from: date,
      to: date,
      excludeBookingIds: [booking.id],
    })
    const warnings = checkTerm({ date, start, end }, context)
    if (warnings.length) {
      res.status(409).json({
        type: "conflict",
        message: "Nowy termin łamie reguły odbioru. Potwierdź, aby zapisać mimo to.",
        warnings,
      })
      return
    }
  }

  await rescheduleOrderPickupWorkflow(req.scope).run({
    input: { booking_id: booking.id, date, start, end },
  })
  const [request] = await listAdminRequests(req.scope, { ids: [booking.id] })
  res.json({ request })
}
