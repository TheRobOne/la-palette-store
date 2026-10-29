import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

export type DeleteDeliveryZoneInput = { id: string }

/**
 * Deletes a delivery zone with its codes (cascade). Its codes become
 * out-of-zone; placed orders keep the zone name and price on their booking
 * (specs/007-delivery-zones data-model.md). Compensation restores it.
 */
const deleteDeliveryZoneStep = createStep(
  "delete-delivery-zone",
  async (input: DeleteDeliveryZoneInput, { container }) => {
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)
    const [zone] = await catering.listDeliveryZones({ id: input.id })
    if (!zone) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Delivery zone ${input.id} not found`)
    }
    await catering.softDeleteDeliveryZones(input.id)
    return new StepResponse({ id: input.id, deleted: true }, input.id)
  },
  async (id, { container }) => {
    if (id) {
      const catering: CateringModuleService = container.resolve(CATERING_MODULE)
      await catering.restoreDeliveryZones(id)
    }
  }
)

export const deleteDeliveryZoneWorkflow = createWorkflow(
  "delete-delivery-zone",
  (input: DeleteDeliveryZoneInput) => {
    const result = deleteDeliveryZoneStep(input)
    return new WorkflowResponse(result)
  }
)
