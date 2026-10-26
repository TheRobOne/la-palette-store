import { generateEntityId, MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CATERING_MODULE } from "../modules/catering"
import { CAPACITY_STATUSES } from "../modules/catering/models/booking"
import type { FulfillmentMethod } from "../modules/catering/models/fulfillment-schedule"
import type CateringModuleService from "../modules/catering/service"
import { addDays, daysBetween, formatPlDate, isValidDate } from "../modules/catering/scheduling/time"

/** Longest period staff may block at once (one year, leap years included). */
export const MAX_BLOCKED_PERIOD_DAYS = 366

/** `from` = `to` blocks one day; a longer range blocks a period (e.g. all of May). */
export type BlockDateInput = {
  from: string
  to: string
  method: FulfillmentMethod | null
  reason?: string | null
}

const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)

/**
 * Blocks a day or a period for one method or (method null) for the whole
 * kitchen. A period is one row per day sharing a `period_id`, so the
 * availability rules keep checking single days. Days already blocked for the
 * same method are skipped (a single already-blocked day is an error, as in
 * 004). Returns how many bookings already exist in the range — they are not
 * changed (spec FR-008).
 */
const blockDateStep = createStep(
  "block-date",
  async (input: BlockDateInput, { container }) => {
    const { from, to } = input
    if (!isValidDate(from) || !isValidDate(to)) {
      throw invalid("Nieprawidłowa data.")
    }
    if (to < from) {
      throw invalid("Koniec okresu nie może być przed jego początkiem.")
    }
    if (daysBetween(from, to) + 1 > MAX_BLOCKED_PERIOD_DAYS) {
      throw invalid(`Okres może obejmować najwyżej ${MAX_BLOCKED_PERIOD_DAYS} dni.`)
    }
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)

    // Postgres treats NULLs as distinct in the unique index, so check here.
    const already = await catering.listBlockedDates({
      date: { $gte: from, $lte: to },
      fulfillment_method: input.method,
    })
    const skipped = new Set(already.map((b) => b.date))
    const dates: string[] = []
    for (let date = from; date <= to; date = addDays(date, 1)) {
      if (!skipped.has(date)) {
        dates.push(date)
      }
    }
    if (!dates.length) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        from === to
          ? `Dzień ${formatPlDate(from)} jest już zablokowany.`
          : `Cały okres ${formatPlDate(from)}–${formatPlDate(to)} jest już zablokowany.`
      )
    }

    const period_id = from === to ? null : generateEntityId(undefined, "blkp")
    const reason = input.reason?.trim() || null
    const blocked = await catering.createBlockedDates(
      dates.map((date) => ({ date, fulfillment_method: input.method, reason, period_id }))
    )
    const bookings = await catering.listBookings(
      { date: { $gte: from, $lte: to }, status: CAPACITY_STATUSES },
      { select: ["id"] }
    )

    return new StepResponse(
      {
        blocked_dates: blocked,
        period_id,
        skipped_dates: [...skipped].sort(),
        existing_orders: bookings.length,
      },
      blocked.map((b) => b.id)
    )
  },
  async (ids, { container }) => {
    if (ids?.length) {
      const catering: CateringModuleService = container.resolve(CATERING_MODULE)
      await catering.deleteBlockedDates(ids)
    }
  }
)

export const blockDateWorkflow = createWorkflow("block-date", (input: BlockDateInput) => {
  const result = blockDateStep(input)
  return new WorkflowResponse(result)
})
