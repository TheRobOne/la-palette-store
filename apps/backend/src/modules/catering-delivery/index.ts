import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { CateringDeliveryFulfillmentService } from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [CateringDeliveryFulfillmentService],
})
