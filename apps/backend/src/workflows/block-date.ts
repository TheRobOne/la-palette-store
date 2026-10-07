import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CATERING_MODULE } from "../modules/catering"
import type { FulfillmentMethod } from "../modules/catering/models/fulfillment-schedule"
import type CateringModuleService from "../modules/catering/service"
import { formatPlDate, isValidDate } from "../modules/catering/scheduling/time"

export type BlockDateInput = {
  date: string
  method: FulfillmentMethod | null
  reason?: string | null
}

/**
 * Blocks a date for one method or (method null) for the whole kitchen.
 * Returns how many active bookings already exist on that date — they are
 * not changed (spec FR-008).
 */
const blockDateStep = createStep(
  "block-date",
  async (input: BlockDateInput, { container }) => {
    if (!isValidDate(input.date)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Nieprawidłowa data.")
    }
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)

    // Postgres treats NULLs as distinct in the unique index, so check here.
    const duplicate = await catering.listBlockedDates({
      date: input.date,
      fulfillment_method: input.method,
    })
    if (duplicate.length) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `Dzień ${formatPlDate(input.date)} jest już zablokowany.`
      )
    }

    const blocked = await catering.createBlockedDates({
      date: input.date,
      fulfillment_method: input.method,
      reason: input.reason?.trim() || null,
    })
    const bookings = await catering.listBookings(
      { date: input.date, status: "active" },
      { select: ["id"] }
    )

    return new StepResponse(
      { blocked_date: blocked, existing_orders: bookings.length },
      blocked.id
    )
  },
  async (id, { container }) => {
    if (id) {
      const catering: CateringModuleService = container.resolve(CATERING_MODULE)
      await catering.deleteBlockedDates(id)
    }
  }
)

export const blockDateWorkflow = createWorkflow("block-date", (input: BlockDateInput) => {
  const result = blockDateStep(input)
  return new WorkflowResponse(result)
})
