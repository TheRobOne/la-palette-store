import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

/** Removes a blocked date (soft delete, restored on compensation). */
const unblockDateStep = createStep(
  "unblock-date",
  async (id: string, { container }) => {
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const [existing] = await catering.listBlockedDates({ id })
    if (!existing) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Blocked date ${id} not found`)
    }
    await catering.softDeleteBlockedDates(id)
    return new StepResponse({ id, deleted: true }, id)
  },
  async (id, { container }) => {
    if (id) {
      const catering: CateringModuleService = container.resolve(CATERING_MODULE)
      await catering.restoreBlockedDates(id)
    }
  }
)

export const unblockDateWorkflow = createWorkflow("unblock-date", (id: string) => {
  const result = unblockDateStep(id)
  return new WorkflowResponse(result)
})
