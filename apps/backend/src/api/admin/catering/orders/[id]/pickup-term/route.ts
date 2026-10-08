import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { findOrderBooking } from "../../../../../../lib/order-booking"
import { checkTerm } from "../../../../../../modules/catering/scheduling/availability"
import { loadSchedulingContext } from "../../../../../../modules/catering/scheduling/load"
import { rescheduleOrderPickupWorkflow } from "../../../../../../workflows/reschedule-order-pickup"
import type { AdminRescheduleBodyType } from "../../../../../validators/catering-scheduling"

/** `GET /admin/catering/orders/:id/pickup-term` → `{ booking }` or 404. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const booking = await findOrderBooking(req.scope, req.params.id)
  if (!booking) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order has no pickup booking")
  }
  res.json({ booking })
}

/**
 * `POST /admin/catering/orders/:id/pickup-term` `{ date, start, end, confirm? }`
 * (contracts/admin-api.md Reschedule). Rule breaks answer 409 with
 * `warnings` until staff confirm; the order's own booking is not counted.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminRescheduleBodyType>,
  res: MedusaResponse
) {
  const { date, start, end, confirm } = req.validatedBody
  const booking = await findOrderBooking(req.scope, req.params.id)
  if (!booking || booking.status !== "active") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order has no active pickup booking")
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

  const { result } = await rescheduleOrderPickupWorkflow(req.scope).run({
    input: { order_id: req.params.id, date, start, end },
  })
  res.json({ booking: result })
}
