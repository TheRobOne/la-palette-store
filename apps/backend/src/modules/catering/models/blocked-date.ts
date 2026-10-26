import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_METHODS } from "./fulfillment-schedule"

/**
 * A date on which no orders can be placed. A blocked period is stored as one
 * row per day (availability keeps checking single days). `fulfillment_method` null blocks
 * every method (e.g. a wedding); the reason is staff-only. Uniqueness of
 * (date, null) is also checked in the block-date workflow because Postgres
 * treats NULLs as distinct in unique indexes.
 */
const BlockedDate = model
  .define("blocked_date", {
    id: model.id({ prefix: "blkd" }).primaryKey(),
    // YYYY-MM-DD, Europe/Warsaw
    date: model.text(),
    fulfillment_method: model.enum([...FULFILLMENT_METHODS]).nullable(),
    reason: model.text().nullable(),
    // days blocked together as one period (e.g. all of May) share an id
    // `blkp_…`, so staff list and unblock them as one; null = a single day
    period_id: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_blocked_date_period_id",
      on: ["period_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_blocked_date_date_method_unique",
      on: ["date", "fulfillment_method"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default BlockedDate
