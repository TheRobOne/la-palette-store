import { z } from "@medusajs/framework/zod"

/** Minimum cart value of a discount code (apps/backend/AGENTS.md "Discount codes"). */
export const AdminPromotionMinOrderValueBody = z.object({
  min_order_value: z
    .number()
    .positive()
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: "Expected an amount with at most two decimals",
    })
    .nullable(),
})
export type AdminPromotionMinOrderValueBodyType = z.infer<typeof AdminPromotionMinOrderValueBody>
