import { model } from "@medusajs/framework/utils"

/**
 * Kitchen-wide scheduling settings — a single row created by
 * src/scripts/setup-pickup-schedule.ts (specs/004-pickup-scheduling/data-model.md).
 */
const SchedulingSettings = model.define("scheduling_settings", {
  id: model.id({ prefix: "schset" }).primaryKey(),
  // ≥ 0; 0 = no orders accepted; default 10. Counts active bookings of
  // every fulfillment method on a date.
  daily_capacity: model.number().default(10),
})

export default SchedulingSettings
