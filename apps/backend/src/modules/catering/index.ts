import { Module } from "@medusajs/framework/utils"
import CateringModuleService from "./service"

export const CATERING_MODULE = "catering"

export default Module(CATERING_MODULE, {
  service: CateringModuleService,
})
