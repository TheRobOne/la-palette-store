import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadScheduleDto } from "../../../../lib/schedule-dto"
import { updatePickupScheduleWorkflow } from "../../../../workflows/update-pickup-schedule"
import type {
  AdminScheduleBodyType,
  MethodQueryType,
} from "../../../validators/catering-scheduling"

/** `GET /admin/catering/schedule?method=pickup` (contracts/admin-api.md). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, MethodQueryType>,
  res: MedusaResponse
) {
  const { method } = req.validatedQuery as MethodQueryType
  res.json({ schedule: await loadScheduleDto(req.scope, method) })
}

/** `POST /admin/catering/schedule?method=pickup` — replaces the schedule as a whole. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminScheduleBodyType, MethodQueryType>,
  res: MedusaResponse
) {
  const { method } = req.validatedQuery as MethodQueryType
  await updatePickupScheduleWorkflow(req.scope).run({
    input: { ...req.validatedBody, method },
  })
  res.json({ schedule: await loadScheduleDto(req.scope, method) })
}
