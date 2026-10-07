import { model } from "@medusajs/framework/utils"

/**
 * Fulfillment methods that have their own windows, lead time, horizon and
 * blocked dates. Only pickup at launch; delivery is added here later
 * (spec FR-011).
 */
export const FULFILLMENT_METHODS = ["pickup"] as const

export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number]

/** Per-method scheduling rules (data-model.md). */
const FulfillmentSchedule = model.define("fulfillment_schedule", {
  id: model.id({ prefix: "fsched" }).primaryKey(),
  fulfillment_method: model.enum([...FULFILLMENT_METHODS]).unique(),
  // disabled → no terms offered for the method
  is_enabled: model.boolean().default(true),
  // ≥ 0; default 48; measured to the window start
  lead_time_hours: model.number().default(48),
  // 1–365; default 60; last offered date = today + horizon
  booking_horizon_days: model.number().default(60),
})

export default FulfillmentSchedule
