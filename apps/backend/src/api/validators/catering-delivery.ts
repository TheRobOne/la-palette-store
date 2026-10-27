import { z } from "@medusajs/framework/zod"

/**
 * Delivery zones and quotes (specs/007-delivery-zones contracts). Postal code
 * formats are checked by the quote / save logic, not here, so the response
 * can name every invalid entry (contracts/admin-api.md).
 */

export const StoreDeliveryQuoteQuery = z.object({
  postal_code: z.string(),
  cart_id: z.string().optional(),
})
export type StoreDeliveryQuoteQueryType = z.infer<typeof StoreDeliveryQuoteQuery>

/** Gross PLN with at most two decimals. */
const amount = z
  .number()
  .min(0)
  .refine((value) => Math.round(value * 100) === value * 100, {
    message: "Expected an amount with at most two decimals",
  })

export const AdminDeliveryZoneBody = z.object({
  name: z.string().trim().min(1),
  price: amount,
  min_order_value: amount.nullish(),
  postal_codes: z.array(z.string()),
})
export type AdminDeliveryZoneBodyType = z.infer<typeof AdminDeliveryZoneBody>

export const AdminDeliveryZoneMatchQuery = z.object({
  postal_code: z.string(),
})
export type AdminDeliveryZoneMatchQueryType = z.infer<typeof AdminDeliveryZoneMatchQuery>
