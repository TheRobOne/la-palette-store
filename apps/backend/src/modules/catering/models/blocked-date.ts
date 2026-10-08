import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_METHODS } from "./fulfillment-schedule"

/**
 * A date on which no orders can be placed. `fulfillment_method` null blocks
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
  })
  .indexes([
    {
      name: "IDX_blocked_date_date_method_unique",
      on: ["date", "fulfillment_method"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default BlockedDate
