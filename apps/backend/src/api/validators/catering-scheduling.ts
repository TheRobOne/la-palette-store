import { z } from "@medusajs/framework/zod"
import { FULFILLMENT_METHODS } from "../../modules/catering/models/fulfillment-schedule"
import { daysBetween, isValidDate } from "../../modules/catering/scheduling/time"

/** Longest range a slots/calendar request may ask for (contracts). */
export const MAX_RANGE_DAYS = 62

const dateString = z
  .string()
  .refine(isValidDate, { message: "Expected a date in YYYY-MM-DD format" })

/** `from`/`to` (inclusive) with to ≥ from and at most MAX_RANGE_DAYS apart. */
export const DateRangeQuery = z
  .object({ from: dateString, to: dateString })
  .refine(({ from, to }) => to >= from, { message: "`to` must not be before `from`" })
  .refine(({ from, to }) => daysBetween(from, to) <= MAX_RANGE_DAYS, {
    message: `The range may span at most ${MAX_RANGE_DAYS} days`,
  })

export const StoreSlotsQuery = z
  .object({
    from: dateString,
    to: dateString,
    method: z.enum(FULFILLMENT_METHODS).optional().default("pickup"),
  })
  .refine(({ from, to }) => to >= from, { message: "`to` must not be before `from`" })
  .refine(({ from, to }) => daysBetween(from, to) <= MAX_RANGE_DAYS, {
    message: `The range may span at most ${MAX_RANGE_DAYS} days`,
  })

export type StoreSlotsQueryType = z.infer<typeof StoreSlotsQuery>

export const MethodQuery = z.object({
  method: z.enum(FULFILLMENT_METHODS).optional().default("pickup"),
})
export type MethodQueryType = z.infer<typeof MethodQuery>

export type DateRangeQueryType = z.infer<typeof DateRangeQuery>

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm")

export const AdminScheduleBody = z.object({
  is_enabled: z.boolean(),
  lead_time_hours: z.number().int(),
  booking_horizon_days: z.number().int(),
  daily_capacity: z.number().int(),
  windows: z.array(
    z.object({ weekday: z.number().int(), start: time, end: time })
  ),
})
export type AdminScheduleBodyType = z.infer<typeof AdminScheduleBody>

export const AdminBlockDateBody = z.object({
  date: dateString,
  method: z.enum(FULFILLMENT_METHODS).nullish(),
  reason: z.string().max(200).nullish(),
})
export type AdminBlockDateBodyType = z.infer<typeof AdminBlockDateBody>

export const AdminRescheduleBody = z.object({
  date: dateString,
  start: time,
  end: time,
  confirm: z.boolean().optional().default(false),
})
export type AdminRescheduleBodyType = z.infer<typeof AdminRescheduleBody>
