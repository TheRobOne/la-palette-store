import { model } from "@medusajs/framework/utils"
import DeliveryZone from "./delivery-zone"

/**
 * One full postal code (XX-XXX) of a delivery zone. The unique index makes
 * "one code, one zone" a database guarantee; the save workflow checks it
 * first to name the other zone in its error.
 */
const DeliveryZoneCode = model
  .define("delivery_zone_code", {
    id: model.id({ prefix: "dzcode" }).primaryKey(),
    // full postal code ^\d{2}-\d{3}$
    code: model.text(),
    zone: model.belongsTo(() => DeliveryZone, { mappedBy: "codes" }),
  })
  .indexes([
    {
      name: "IDX_delivery_zone_code_code_unique",
      on: ["code"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default DeliveryZoneCode
