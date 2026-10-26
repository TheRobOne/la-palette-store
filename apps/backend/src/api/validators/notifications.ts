import { z } from "@medusajs/framework/zod"

/** `resource_id`: one or more comma-separated order / request (booking) ids. */
export const AdminNotificationsQuery = z.object({
  resource_id: z
    .string()
    .min(1)
    .transform((v) => [...new Set(v.split(",").map((id) => id.trim()).filter(Boolean))])
    .refine((ids) => ids.length > 0 && ids.length <= 100, {
      message: "Pass 1–100 comma-separated ids",
    }),
})
export type AdminNotificationsQueryType = z.infer<typeof AdminNotificationsQuery>
