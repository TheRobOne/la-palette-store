import { MedusaService } from "@medusajs/framework/utils"
import { MedusaError } from "@medusajs/framework/utils"
import CateringProductInfo from "./models/catering-product-info"

type CateringProductInfoInput = {
  min_quantity?: number
  quantity_step?: number
  [key: string]: unknown
}

/**
 * `min_quantity` MUST be a multiple of `quantity_step`
 * (specs/001-project-skeleton/data-model.md, Validation).
 * Exported (rather than DB-backed) so it has a plain Jest unit test
 * (research R-10 / constitution: minimal CI, no database).
 */
export function assertQuantityRule(data: CateringProductInfoInput) {
  const minQuantity = data.min_quantity ?? 1
  const quantityStep = data.quantity_step ?? 1

  if (quantityStep < 1 || minQuantity < 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "min_quantity and quantity_step must be at least 1"
    )
  }

  if (minQuantity % quantityStep !== 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `min_quantity (${minQuantity}) must be a multiple of quantity_step (${quantityStep})`
    )
  }
}

class CateringModuleService extends MedusaService({
  CateringProductInfo,
}) {
  async createCateringProductInfos(data: CateringProductInfoInput) {
    assertQuantityRule(data)
    // @ts-expect-error - delegating to the generated base implementation
    return await super.createCateringProductInfos(data)
  }

  async updateCateringProductInfos(data: CateringProductInfoInput) {
    if (data.min_quantity !== undefined || data.quantity_step !== undefined) {
      assertQuantityRule(data)
    }
    // @ts-expect-error - delegating to the generated base implementation
    return await super.updateCateringProductInfos(data)
  }
}

export default CateringModuleService
