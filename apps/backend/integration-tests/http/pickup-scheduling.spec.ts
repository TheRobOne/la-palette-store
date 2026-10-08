import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import seed from "../../src/scripts/seed"
import { CATERING_MODULE } from "../../src/modules/catering"
import type CateringModuleService from "../../src/modules/catering/service"
import {
  addDays,
  isoWeekday,
  warsawToday,
} from "../../src/modules/catering/scheduling/time"

// specs/004-pickup-scheduling — contracts/store-api.md. Carts hold 12 ×
// "test-mini-tarta-cytrynowa" (12 zł) = 144 zł, above the 100 zł minimum.

type Day = {
  date: string
  available: boolean
  reason: string | null
  windows: { start: string; end: string; available: boolean }[]
}

type ErrorResponse = { response: { status: number; data: Record<string, unknown> } }

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: { "x-publishable-api-key": string }
    let regionId: string
    let variantId: string
    let container: MedusaContainer
    let catering: CateringModuleService

    beforeEach(async () => {
      container = getContainer()
      process.env.APP_ENV = "local"
      await seed({ container } as never)
      catering = container.resolve(CATERING_MODULE)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: apiKeys } = await query.graph({
        entity: "api_key",
        fields: ["token"],
        filters: { title: "Storefront" },
      })
      headers = { "x-publishable-api-key": apiKeys[0].token }

      const { data: regions } = await query.graph({
        entity: "region",
        fields: ["id"],
        filters: { name: "Polska" },
      })
      regionId = regions[0].id

      const { data: products } = await query.graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "test-mini-tarta-cytrynowa" },
      })
      variantId = products[0].variants[0].id
    })

    const today = () => warsawToday(new Date())

    const getSlots = async (from: string, to: string): Promise<Day[]> => {
      const { data } = await api.get(
        `/store/catering/slots?from=${from}&to=${to}`,
        { headers }
      )
      return data.slots.days
    }

    /** First available window from today on (the default schedule always has one). */
    const firstAvailableTerm = async (skipDates: string[] = []) => {
      const days = await getSlots(today(), addDays(today(), 14))
      const day = days.find((d) => d.available && !skipDates.includes(d.date))!
      const window = day.windows.find((w) => w.available)!
      return { method: "pickup", date: day.date, start: window.start, end: window.end }
    }

    const prepareCart = async (term?: Record<string, unknown>) => {
      const {
        data: { cart },
      } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "klient@example.com" },
        { headers }
      )
      await api.post(
        `/store/carts/${cart.id}/line-items`,
        { variant_id: variantId, quantity: 12 },
        { headers }
      )
      const {
        data: { shipping_options },
      } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, { headers })
      await api.post(
        `/store/carts/${cart.id}/shipping-methods`,
        { option_id: shipping_options[0].id },
        { headers }
      )
      if (term) {
        await api.post(
          `/store/carts/${cart.id}`,
          { metadata: { catering_term: term } },
          { headers }
        )
      }
      const {
        data: { payment_collection },
      } = await api.post("/store/payment-collections", { cart_id: cart.id }, { headers })
      await api.post(
        `/store/payment-collections/${payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        { headers }
      )
      return cart.id as string
    }

    const complete = (cartId: string) =>
      api
        .post(`/store/carts/${cartId}/complete`, {}, { headers })
        .catch((e: ErrorResponse) => e.response)

    describe("US1 — GET /store/catering/slots", () => {
      it("lists every date with Mondays closed and the first 48 h unavailable", async () => {
        const from = today()
        const days = await getSlots(from, addDays(from, 13))

        expect(days).toHaveLength(14)
        expect(days.map((d) => d.date)).toEqual(
          Array.from({ length: 14 }, (_, i) => addDays(from, i))
        )
        for (const day of days) {
          if (isoWeekday(day.date) === 1) {
            expect(day).toEqual(
              expect.objectContaining({ available: false, reason: "closed", windows: [] })
            )
          }
        }
        // today and tomorrow are always inside a 48 h lead time
        for (const day of days.slice(0, 2)) {
          expect(day.available).toBe(false)
          expect(["lead_time", "closed"]).toContain(day.reason)
        }
        expect(days.some((d) => d.available)).toBe(true)
      })

      it("rejects a range longer than 62 days", async () => {
        const response = await api
          .get(`/store/catering/slots?from=${today()}&to=${addDays(today(), 63)}`, {
            headers,
          })
          .catch((e: ErrorResponse) => e.response)
        expect(response.status).toEqual(400)
      })

      it("rejects an invalid date", async () => {
        const response = await api
          .get(`/store/catering/slots?from=2026-02-30&to=2026-03-02`, { headers })
          .catch((e: ErrorResponse) => e.response)
        expect(response.status).toEqual(400)
      })
    })

    describe("US1 — completing a cart with a pickup term", () => {
      it("rejects a cart without a term", async () => {
        const response = await complete(await prepareCart())
        expect(response.status).toEqual(400)
        expect(response.data).toEqual(
          expect.objectContaining({
            type: "invalid_data",
            message: "Wybierz termin odbioru.",
          })
        )
      })

      it("rejects a term on a blocked date", async () => {
        const term = await firstAvailableTerm()
        const cartId = await prepareCart(term)
        await catering.createBlockedDates({
          date: term.date,
          fulfillment_method: null,
          reason: "Wesele",
        })

        const response = await complete(cartId)
        expect(response.status).toEqual(400)
        expect(String(response.data.message)).toMatch(/nie jest już dostępny/)
      })

      it("places the order and copies the term to it", async () => {
        const term = await firstAvailableTerm()
        const response = await complete(await prepareCart(term))

        expect(response.status).toEqual(200)
        expect(response.data.type).toEqual("order")

        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["metadata"],
          filters: { id: response.data.order.id },
        })
        expect(orders[0].metadata?.catering_term).toEqual(term)
      })
    })

    describe("US2 — the kitchen is never overbooked", () => {
      const setCapacity = async (daily_capacity: number) => {
        const [settings] = await catering.listSchedulingSettings({}, { take: 1 })
        await catering.updateSchedulingSettings({ id: settings.id, daily_capacity })
      }

      it("lets exactly one of two concurrent carts take the last place", async () => {
        await setCapacity(1)
        const term = await firstAvailableTerm()
        const [cartA, cartB] = [await prepareCart(term), await prepareCart(term)]

        const responses = await Promise.all([complete(cartA), complete(cartB)])
        const orders = responses.filter((r) => r.status === 200 && r.data.type === "order")
        const rejected = responses.filter((r) => r.status === 400)

        expect(orders).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect(String(rejected[0].data.message)).toMatch(/nie jest już dostępny/)

        const days = await getSlots(term.date, term.date)
        expect(days[0].reason).toEqual("full")

        const bookings = await catering.listBookings({ date: term.date, status: "active" })
        expect(bookings).toHaveLength(1)
      })

      it("frees the place when the order is cancelled", async () => {
        await setCapacity(1)
        const term = await firstAvailableTerm()
        const response = await complete(await prepareCart(term))
        expect(response.data.type).toEqual("order")
        expect((await getSlots(term.date, term.date))[0].reason).toEqual("full")

        await cancelOrderWorkflow(container).run({
          input: { order_id: response.data.order.id },
        })
        // subscribers run asynchronously after the event
        await new Promise((resolve) => setTimeout(resolve, 2000))

        expect((await getSlots(term.date, term.date))[0].available).toBe(true)
        const [booking] = await catering.listBookings({ date: term.date })
        expect(booking).toEqual(
          expect.objectContaining({ status: "canceled", order_id: response.data.order.id })
        )
      })

      it("links the booking to the order and keeps one booking on a retried completion", async () => {
        const term = await firstAvailableTerm()
        const cartId = await prepareCart(term)
        const first = await complete(cartId)
        const second = await complete(cartId)

        expect(second.data.order.id).toEqual(first.data.order.id)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        const bookings = await catering.listBookings({ cart_id: cartId })
        expect(bookings).toHaveLength(1)
        expect(bookings[0].order_id).toEqual(first.data.order.id)
      })
    })

    const adminHeaders = async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: "admin@lapalette.local",
        password: "lapalette-local",
      })
      return { authorization: `Bearer ${data.token}` }
    }

    describe("US3 — staff manage the schedule and blocked days", () => {
      it("round-trips the schedule and rejects overlapping windows", async () => {
        const headers = await adminHeaders()
        const { data } = await api.get("/admin/catering/schedule?method=pickup", { headers })
        expect(data.schedule).toEqual(
          expect.objectContaining({
            method: "pickup",
            is_enabled: true,
            lead_time_hours: 48,
            booking_horizon_days: 60,
            daily_capacity: 10,
          })
        )
        expect(data.schedule.windows).toHaveLength(48)

        const { method: _m, ...body } = data.schedule
        const saved = await api.post(
          "/admin/catering/schedule?method=pickup",
          { ...body, daily_capacity: 3, windows: [{ weekday: 6, start: "09:00", end: "10:30" }] },
          { headers }
        )
        expect(saved.data.schedule.daily_capacity).toEqual(3)
        expect(saved.data.schedule.windows).toEqual([{ weekday: 6, start: "09:00", end: "10:30" }])

        const overlapping = await api
          .post(
            "/admin/catering/schedule?method=pickup",
            {
              ...body,
              windows: [
                { weekday: 6, start: "09:00", end: "10:30" },
                { weekday: 6, start: "10:00", end: "11:00" },
              ],
            },
            { headers }
          )
          .catch((e: ErrorResponse) => e.response)
        expect(overlapping.status).toEqual(400)
      })

      it("blocks a date with an order, reports it, and unblocks it", async () => {
        const headers = await adminHeaders()
        const term = await firstAvailableTerm()
        expect((await complete(await prepareCart(term))).data.type).toEqual("order")

        const { data } = await api.post(
          "/admin/catering/blocked-dates",
          { date: term.date, method: null, reason: "Wesele" },
          { headers }
        )
        expect(data.existing_orders).toEqual(1)
        expect((await getSlots(term.date, term.date))[0].reason).toEqual("blocked")

        const duplicate = await api
          .post("/admin/catering/blocked-dates", { date: term.date, method: null }, { headers })
          .catch((e: ErrorResponse) => e.response)
        expect(duplicate.status).toBeGreaterThanOrEqual(400)

        await api.delete(`/admin/catering/blocked-dates/${data.blocked_date.id}`, { headers })
        expect((await getSlots(term.date, term.date))[0].available).toBe(true)
      })
    })

    describe("US4 — pickup calendar", () => {
      it("groups orders by window with used/total and blocked days", async () => {
        const headers = await adminHeaders()
        // the day after the first available one has every window open
        const first = await firstAvailableTerm([(await firstAvailableTerm()).date])
        const [firstDay] = await getSlots(first.date, first.date)
        const last = firstDay.windows[firstDay.windows.length - 1]
        const second = { ...first, start: last.start, end: last.end }
        const a = await complete(await prepareCart(first))
        const b = await complete(await prepareCart(second))
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const blockedDate = addDays(first.date, 1)
        await catering.createBlockedDates({ date: blockedDate, fulfillment_method: null, reason: "Urlop" })

        const { data } = await api.get(
          `/admin/catering/calendar?from=${first.date}&to=${blockedDate}`,
          { headers }
        )
        const [day, next] = data.calendar.days
        expect(data.calendar.daily_capacity).toEqual(10)
        expect(day.used).toEqual(2)
        const withOrders = day.windows.filter((w: { orders: unknown[] }) => w.orders.length)
        expect(withOrders.map((w: { start: string }) => w.start).sort()).toEqual(
          [first.start, second.start].sort()
        )
        const orderIds = withOrders.flatMap((w: { orders: { order_id: string }[] }) =>
          w.orders.map((o) => o.order_id)
        )
        expect(orderIds.sort()).toEqual([a.data.order.id, b.data.order.id].sort())
        expect(withOrders[0].orders[0].display_id).toEqual(expect.any(Number))
        expect(next.blocked).toEqual(expect.objectContaining({ reason: "Urlop" }))

        const tooLong = await api
          .get(`/admin/catering/calendar?from=${first.date}&to=${addDays(first.date, 63)}`, { headers })
          .catch((e: ErrorResponse) => e.response)
        expect(tooLong.status).toEqual(400)
      })
    })

    describe("US5 — staff reschedule an order", () => {
      it("moves the term, warns on a full day and saves after confirmation", async () => {
        const headers = await adminHeaders()
        const term = await firstAvailableTerm()
        const order = (await complete(await prepareCart(term))).data.order
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const target = await firstAvailableTerm([term.date])
        const moved = await api.post(
          `/admin/catering/orders/${order.id}/pickup-term`,
          { date: target.date, start: target.start, end: target.end },
          { headers }
        )
        expect(moved.data.booking).toEqual(
          expect.objectContaining({
            date: target.date,
            start_time: target.start,
            previous_date: term.date,
            previous_start_time: term.start,
            rescheduled_at: expect.any(String),
          })
        )
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["metadata"],
          filters: { id: order.id },
        })
        expect(orders[0].metadata?.catering_term).toEqual(target)

        // make the original day full, then move the order back there
        const [settings] = await catering.listSchedulingSettings({}, { take: 1 })
        await catering.updateSchedulingSettings({ id: settings.id, daily_capacity: 1 })
        expect((await complete(await prepareCart(term))).data.type).toEqual("order")

        const conflict = await api
          .post(
            `/admin/catering/orders/${order.id}/pickup-term`,
            { date: term.date, start: term.start, end: term.end },
            { headers }
          )
          .catch((e: ErrorResponse) => e.response)
        expect(conflict.status).toEqual(409)
        expect(conflict.data.warnings).toEqual(["full"])

        const confirmed = await api.post(
          `/admin/catering/orders/${order.id}/pickup-term`,
          { date: term.date, start: term.start, end: term.end, confirm: true },
          { headers }
        )
        expect(confirmed.data.booking.date).toEqual(term.date)
      })

      it("answers 404 for an order without a booking", async () => {
        const headers = await adminHeaders()
        const response = await api
          .get(`/admin/catering/orders/order_missing/pickup-term`, { headers })
          .catch((e: ErrorResponse) => e.response)
        expect(response.status).toEqual(404)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
