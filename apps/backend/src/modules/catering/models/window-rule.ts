import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_METHODS } from "./fulfillment-schedule"

/**
 * A recurring pickup/delivery window on a day of the week, wall-clock time in
 * Europe/Warsaw. Windows of the same method and weekday MUST NOT overlap
 * (validated by the update-pickup-schedule workflow).
 */
const WindowRule = model
  .define("window_rule", {
    id: model.id({ prefix: "wrule" }).primaryKey(),
    fulfillment_method: model.enum([...FULFILLMENT_METHODS]),
    // ISO 1 = Monday … 7 = Sunday
    weekday: model.number(),
    // HH:mm, start_time < end_time
    start_time: model.text(),
    end_time: model.text(),
  })
  .indexes([
    {
      name: "IDX_window_rule_method_weekday",
      on: ["fulfillment_method", "weekday"],
      where: "deleted_at IS NULL",
    },
  ])

export default WindowRule
