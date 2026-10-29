import type { IPromotionModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  PROMOTION_MIN_ORDER_ATTRIBUTE,
  promotionMinOrderValue,
} from "../lib/promotion-min-order-value"

export type SetPromotionMinOrderValueInput = {
  promotion_id: string
  /** gross PLN; null removes the minimum */
  min_order_value: number | null
}

const loadMinimumRules = async (promotions: IPromotionModuleService, promotionId: string) => {
  const [promotion] = await promotions.listPromotions(
    { id: promotionId },
    { relations: ["rules", "rules.values"] }
  )
  if (!promotion) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Promotion ${promotionId} not found`)
  }
  return (promotion.rules ?? []).filter((r) => r.attribute === PROMOTION_MIN_ORDER_ATTRIBUTE)
}

const replaceMinimum = async (
  promotions: IPromotionModuleService,
  promotionId: string,
  ruleIds: string[],
  value: number | null
) => {
  if (ruleIds.length) {
    await promotions.removePromotionRules(promotionId, ruleIds)
  }
  if (value === null) {
    return []
  }
  const created = await promotions.addPromotionRules(promotionId, [
    { attribute: PROMOTION_MIN_ORDER_ATTRIBUTE, operator: "gte", values: [String(value)] },
  ])
  return created.map((r) => r.id)
}

/**
 * Replaces the promotion's minimum cart value rule (src/lib/promotion-min-order-value.ts).
 * Compensation puts the previous minimum back.
 */
const setPromotionMinOrderValueStep = createStep(
  "set-promotion-min-order-value",
  async (input: SetPromotionMinOrderValueInput, { container }) => {
    const promotions: IPromotionModuleService = container.resolve(Modules.PROMOTION)
    const current = await loadMinimumRules(promotions, input.promotion_id)
    const previous = promotionMinOrderValue(current)
    const ruleIds = await replaceMinimum(
      promotions,
      input.promotion_id,
      current.map((r) => r.id),
      input.min_order_value
    )
    return new StepResponse(
      { min_order_value: input.min_order_value },
      { promotion_id: input.promotion_id, rule_ids: ruleIds, previous }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const promotions: IPromotionModuleService = container.resolve(Modules.PROMOTION)
    await replaceMinimum(promotions, undo.promotion_id, undo.rule_ids, undo.previous)
  }
)

export const setPromotionMinOrderValueWorkflow = createWorkflow(
  "set-promotion-min-order-value",
  (input: SetPromotionMinOrderValueInput) => {
    return new WorkflowResponse(setPromotionMinOrderValueStep(input))
  }
)
