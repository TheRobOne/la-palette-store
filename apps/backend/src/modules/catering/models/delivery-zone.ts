import { model } from "@medusajs/framework/utils"
import DeliveryZoneCode from "./delivery-zone-code"

/**
 * A delivery zone: a list of full postal codes with one gross delivery price
 * (specs/007-delivery-zones data-model.md). Zones are Admin data, edited by
 * staff without a deploy; name uniqueness is checked by the save workflow.
 */
const DeliveryZone = model.define("delivery_zone", {
  id: model.id({ prefix: "dzone" }).primaryKey(),
  name: model.text(),
  // ≥ 0, gross PLN
  price: model.bigNumber(),
  // ≥ 0; null = only the global minimum applies
  min_order_value: model.bigNumber().nullable(),
  codes: model.hasMany(() => DeliveryZoneCode, { mappedBy: "zone" }),
})
  .cascades({ delete: ["codes"] })

export default DeliveryZone
