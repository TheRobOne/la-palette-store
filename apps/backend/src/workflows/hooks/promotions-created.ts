import type { IPromotionModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Discount codes are gross amounts (apps/backend/AGENTS.md "Discount codes"): shop prices
 * include VAT, but Medusa treats a promotion's fixed amount as net unless
 * `is_tax_inclusive` — so "20 zł" would take 21,60 zł off at 8% VAT. The
 * Admin's create form leaves that switch off; this turns it on for every new
 * promotion. The promotion page widget warns when it is switched off later.
 */
createPromotionsWorkflow.hooks.promotionsCreated(
  async ({ promotions }, { container }) => {
    const net = promotions.filter((p) => !p.is_tax_inclusive).map((p) => p.id)
    if (net.length) {
      const service: IPromotionModuleService = container.resolve(Modules.PROMOTION)
      await service.updatePromotions(net.map((id) => ({ id, is_tax_inclusive: true })))
    }
    return new StepResponse(undefined, net)
  },
  async (net, { container }) => {
    if (!net?.length) {
      return
    }
    const service: IPromotionModuleService = container.resolve(Modules.PROMOTION)
    await service.updatePromotions(net.map((id) => ({ id, is_tax_inclusive: false })))
  }
)
