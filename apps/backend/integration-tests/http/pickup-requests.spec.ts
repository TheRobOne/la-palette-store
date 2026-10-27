import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import seed from "../../src/scripts/seed"
import { CATERING_MODULE } from "../../src/modules/catering"
import type CateringModuleService from "../../src/modules/catering/service"
import { addDays, warsawToday } from "../../src/modules/catering/scheduling/time"
import { expirePickupRequests } from "../../src/jobs/expire-pickup-requests"

// specs/005-on-request-terms — contracts/store-api.md, contracts/admin-api.md.
// Mondays (closed in the default schedule) are made "on request" for every
// test; carts hold 12 × "test-mini-tarta-cytrynowa" (12 zł) = 144 zł.

type Window = { start: string; end: string; available: boolean; requires_confirmation: boolean }
type Day = { date: string; available: boolean; reason: string | null; windows: Window[] }
type Term = { method: string; date: string; start: string; end: string }
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

      await catering.createWindowRules(
        [10, 11, 12, 13, 14, 15, 16, 17].map((h) => ({
          fulfillment_method: "pickup" as const,
          weekday: 1,
          start_time: `${h}:00`,
          end_time: `${h + 1}:00`,
          requires_confirmation: true,
        }))
      )

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
      const { data } = await api.get(`/store/catering/slots?from=${from}&to=${to}`, { headers })
      return data.slots.days
    }

    /** First available window of the given kind within 3 weeks. */
    const firstTerm = async (onRequest: boolean, skipDates: string[] = []): Promise<Term> => {
      const days = await getSlots(today(), addDays(today(), 21))
      for (const day of days) {
        if (skipDates.includes(day.date)) continue
        const w = day.windows.find((x) => x.available && x.requires_confirmation === onRequest)
        if (w) return { method: "pickup", date: day.date, start: w.start, end: w.end }
      }
      throw new Error("no window found")
    }

    const prepareCart = async (term: Term, quantity = 12) => {
      const {
        data: { cart },
      } = await api.post("/store/carts", { region_id: regionId, email: "klient@example.com" }, { headers })
      await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity }, { headers })
      const {
        data: { shipping_options },
      } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, { headers })
      await api.post(`/store/carts/${cart.id}/shipping-methods`, { option_id: shipping_options.find((o: { type: { code: string } }) => o.type.code === "pickup").id }, { headers })
      await api.post(`/store/carts/${cart.id}`, { metadata: { catering_term: term } }, { headers })
      return cart.id as string
    }

    const pay = async (cartId: string) => {
      const {
        data: { payment_collection },
      } = await api.post("/store/payment-collections", { cart_id: cartId }, { headers })
      await api.post(
        `/store/payment-collections/${payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        { headers }
      )
    }

    const complete = (cartId: string) =>
      api.post(`/store/carts/${cartId}/complete`, {}, { headers }).catch((e: ErrorResponse) => e.response)

    const sendRequest = (cartId: string) =>
      api.post("/store/catering/requests", { cart_id: cartId }, { headers }).catch((e: ErrorResponse) => e.response)

    const requestStatus = (cartId: string) =>
      api.get(`/store/catering/requests/${cartId}`, { headers }).catch((e: ErrorResponse) => e.response)

    describe("US1 — sending a request", () => {
      it("flags on-request windows and keeps them out of the 72 h lead time", async () => {
        const days = await getSlots(today(), addDays(today(), 13))
        const mondays = days.filter((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 1)
        expect(mondays.length).toBeGreaterThan(0)
        for (const monday of mondays) {
          expect(monday.windows.length).toEqual(8)
          expect(monday.windows.every((w) => w.requires_confirmation)).toBe(true)
        }
        // nothing on request within the first 3 days (72 h)
        for (const day of days.slice(0, 3)) {
          expect(day.windows.filter((w) => w.requires_confirmation && w.available)).toEqual([])
        }
      })

      it("creates a request without payment that holds capacity", async () => {
        const term = await firstTerm(true)
        const cartId = await prepareCart(term)
        const before = Date.now()

        const response = await sendRequest(cartId)
        expect(response.status).toEqual(200)
        const request = response.data.request as Record<string, unknown>
        expect(request).toEqual(
          expect.objectContaining({
            cart_id: cartId,
            status: "requested",
            term,
            payment_deadline: null,
            items: [{ variant_id: variantId, quantity: 12 }],
          })
        )
        const deadline = new Date(String(request.response_deadline)).getTime()
        expect(Math.abs(deadline - (before + 24 * 3_600_000))).toBeLessThan(60_000)

        // idempotent
        const again = await sendRequest(cartId)
        expect(again.data.request.response_deadline).toEqual(request.response_deadline)
        expect(await catering.listBookings({ cart_id: cartId })).toHaveLength(1)

        expect((await requestStatus(cartId)).data.request.status).toEqual("requested")

        // capacity: with daily_capacity 1 the day is now full
        const [settings] = await catering.listSchedulingSettings({}, { take: 1 })
        await catering.updateSchedulingSettings({ id: settings.id, daily_capacity: 1 })
        expect((await getSlots(term.date, term.date))[0].reason).toEqual("full")
      })

      it("refuses the request path for a standard window", async () => {
        const response = await sendRequest(await prepareCart(await firstTerm(false)))
        expect(response.status).toEqual(400)
        expect(response.data.message).toEqual(
          "Ten termin nie wymaga potwierdzenia — złóż zwykłe zamówienie."
        )
      })

      it("applies the minimum order value to requests", async () => {
        const response = await sendRequest(await prepareCart(await firstTerm(true), 1))
        expect(response.status).toEqual(400)
        expect(String(response.data.message)).toMatch(/Minimalna wartość zamówienia/)
      })

      it("refuses to complete an on-request cart without a confirmed request", async () => {
        const cartId = await prepareCart(await firstTerm(true))
        await pay(cartId)
        const response = await complete(cartId)
        expect(response.status).toEqual(400)
        expect(response.data.message).toEqual(
          "Ten termin wymaga potwierdzenia kuchni — wyślij zapytanie."
        )
      })

      it("answers 404 for a cart without a request", async () => {
        const cartId = await prepareCart(await firstTerm(true))
        expect((await requestStatus(cartId)).status).toEqual(404)
      })
    })

    const adminHeaders = async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: "admin@lapalette.local",
        password: "lapalette-local",
      })
      return { authorization: `Bearer ${data.token}` }
    }

    /** Sends a request and returns its booking id. */
    const requestFor = async (term: Term, quantity = 12) => {
      const cartId = await prepareCart(term, quantity)
      expect((await sendRequest(cartId)).status).toEqual(200)
      const [booking] = await catering.listBookings({ cart_id: cartId })
      return { cartId, requestId: booking.id }
    }

    const decide = async (id: string, decision: "confirm" | "decline") =>
      api
        .post(`/admin/catering/requests/${id}/${decision}`, {}, { headers: await adminHeaders() })
        .catch((e: ErrorResponse) => e.response)

    describe("US2 — staff confirm or decline", () => {
      it("lists, confirms and refuses a second confirmation", async () => {
        const term = await firstTerm(true)
        const { requestId } = await requestFor(term)
        const admin = await adminHeaders()

        const { data } = await api.get("/admin/catering/requests?status=requested", { headers: admin })
        expect(data.requests).toEqual([
          expect.objectContaining({
            id: requestId,
            status: "requested",
            email: "klient@example.com",
            item_total: 144,
            items: [expect.objectContaining({ quantity: 12 })],
          }),
        ])

        const before = Date.now()
        const confirmed = await decide(requestId, "confirm")
        expect(confirmed.status).toEqual(200)
        expect(confirmed.data.request.status).toEqual("confirmed")
        const deadline = new Date(confirmed.data.request.payment_deadline).getTime()
        expect(Math.abs(deadline - (before + 24 * 3_600_000))).toBeLessThan(60_000)

        expect((await decide(requestId, "confirm")).status).toEqual(409)

        const { data: cal } = await api.get(
          `/admin/catering/calendar?from=${term.date}&to=${term.date}`,
          { headers: admin }
        )
        const entry = cal.calendar.days[0].windows
          .flatMap((w: { orders: Record<string, unknown>[] }) => w.orders)
          .find((o: Record<string, unknown>) => o.request_id === requestId)
        expect(entry).toEqual(
          expect.objectContaining({ booking_status: "confirmed", email: "klient@example.com" })
        )
      })

      it("declines requested and confirmed requests and frees the place", async () => {
        const [settings] = await catering.listSchedulingSettings({}, { take: 1 })
        await catering.updateSchedulingSettings({ id: settings.id, daily_capacity: 1 })
        const term = await firstTerm(true)
        const { cartId, requestId } = await requestFor(term)
        expect((await getSlots(term.date, term.date))[0].reason).toEqual("full")

        const declined = await decide(requestId, "decline")
        expect(declined.data.request.status).toEqual("declined")
        expect((await getSlots(term.date, term.date))[0].available).toBe(true)
        expect((await requestStatus(cartId)).data.request.status).toEqual("declined")

        const second = await requestFor(term)
        await decide(second.requestId, "confirm")
        expect((await decide(second.requestId, "decline")).data.request.status).toEqual("declined")
      })

      it("refuses to confirm a request past its response deadline", async () => {
        const { requestId } = await requestFor(await firstTerm(true))
        await catering.updateBookings({ id: requestId, response_deadline: new Date(Date.now() - 1000) })
        expect((await decide(requestId, "confirm")).status).toEqual(409)
      })

      it("reschedules a confirmed request and keeps it payable", async () => {
        const term = await firstTerm(true)
        const { cartId, requestId } = await requestFor(term)
        await decide(requestId, "confirm")
        const target = await firstTerm(true, [term.date])
        const moved = await api.post(
          `/admin/catering/requests/${requestId}/pickup-term`,
          { date: target.date, start: target.start, end: target.end },
          { headers: await adminHeaders() }
        )
        expect(moved.data.request).toEqual(
          expect.objectContaining({ status: "confirmed", term: target })
        )
        await pay(cartId)
        const response = await complete(cartId)
        expect(response.data.type).toEqual("order")
      })
    })

    describe("US3 — paying after confirmation", () => {
      it("turns a confirmed request into an order", async () => {
        const term = await firstTerm(true)
        const { cartId, requestId } = await requestFor(term)
        await decide(requestId, "confirm")
        await pay(cartId)

        const response = await complete(cartId)
        expect(response.status).toEqual(200)
        expect(response.data.type).toEqual("order")
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const status = (await requestStatus(cartId)).data.request
        expect(status).toEqual(
          expect.objectContaining({ status: "active", order_id: response.data.order.id })
        )
      })

      it("refuses payment after the payment deadline", async () => {
        const { cartId, requestId } = await requestFor(await firstTerm(true))
        await decide(requestId, "confirm")
        await catering.updateBookings({ id: requestId, payment_deadline: new Date(Date.now() - 1000) })
        await pay(cartId)
        const response = await complete(cartId)
        expect(response.status).toEqual(400)
        expect(response.data.message).toEqual("Czas na płatność za to zamówienie minął.")
      })

      it("refuses payment when the cart changed after the request", async () => {
        const { cartId, requestId } = await requestFor(await firstTerm(true))
        await decide(requestId, "confirm")
        const { data } = await api.get(`/store/carts/${cartId}`, { headers })
        await api.post(
          `/store/carts/${cartId}/line-items/${data.cart.items[0].id}`,
          { quantity: 24 },
          { headers }
        )
        await pay(cartId)
        const response = await complete(cartId)
        expect(response.status).toEqual(400)
        expect(response.data.message).toEqual(
          "Zamówienie różni się od wysłanego zapytania — skontaktuj się z nami."
        )
      })

      it("refuses payment for a declined request", async () => {
        const { cartId, requestId } = await requestFor(await firstTerm(true))
        await decide(requestId, "decline")
        await pay(cartId)
        expect((await complete(cartId)).data.message).toEqual(
          "Czas na płatność za to zamówienie minął."
        )
      })
    })

    describe("US4 — automatic expiry", () => {
      it("expires unanswered and cancels unpaid requests, freeing capacity", async () => {
        const [settings] = await catering.listSchedulingSettings({}, { take: 1 })
        await catering.updateSchedulingSettings({ id: settings.id, daily_capacity: 2 })
        const term = await firstTerm(true)
        const unanswered = await requestFor(term)
        const unpaid = await requestFor(term)
        await decide(unpaid.requestId, "confirm")
        expect((await getSlots(term.date, term.date))[0].reason).toEqual("full")

        const past = new Date(Date.now() - 1000)
        await catering.updateBookings({ id: unanswered.requestId, response_deadline: past })
        await catering.updateBookings({ id: unpaid.requestId, payment_deadline: past })

        const result = await expirePickupRequests(container)
        expect(result).toEqual({ expired: [unanswered.requestId], canceled: [unpaid.requestId] })
        expect((await requestStatus(unanswered.cartId)).data.request.status).toEqual("expired")
        expect((await requestStatus(unpaid.cartId)).data.request.status).toEqual("canceled")
        expect((await getSlots(term.date, term.date))[0].available).toBe(true)
      })

      it("leaves requests with future deadlines untouched", async () => {
        const { requestId } = await requestFor(await firstTerm(true))
        expect(await expirePickupRequests(container)).toEqual({ expired: [], canceled: [] })
        expect((await catering.listBookings({ id: requestId }))[0].status).toEqual("requested")
      })
    })

    describe("US5 — staff configure on-request terms", () => {
      it("round-trips the request settings and validates ranges", async () => {
        const admin = await adminHeaders()
        const { data } = await api.get("/admin/catering/schedule?method=pickup", { headers: admin })
        expect(data.schedule).toEqual(
          expect.objectContaining({
            request_lead_time_hours: 72,
            request_response_hours: 24,
            request_payment_hours: 24,
          })
        )
        expect(
          data.schedule.windows.filter((w: { requires_confirmation: boolean }) => w.requires_confirmation)
        ).toHaveLength(8)

        const { method: _m, ...body } = data.schedule
        const saved = await api.post(
          "/admin/catering/schedule?method=pickup",
          {
            ...body,
            request_response_hours: 12,
            windows: [{ weekday: 1, start: "10:00", end: "11:00" }],
          },
          { headers: admin }
        )
        expect(saved.data.schedule.request_response_hours).toEqual(12)
        expect(saved.data.schedule.windows).toEqual([
          { weekday: 1, start: "10:00", end: "11:00", requires_confirmation: false },
        ])

        for (const bad of [{ request_response_hours: 0 }, { request_payment_hours: 169 }]) {
          const response = await api
            .post("/admin/catering/schedule?method=pickup", { ...body, ...bad }, { headers: admin })
            .catch((e: ErrorResponse) => e.response)
          expect(response.status).toEqual(400)
        }
      })

      it("applies a new response time to new requests only", async () => {
        const term = await firstTerm(true)
        const first = await requestFor(term)
        const [before] = await catering.listBookings({ id: first.requestId })

        const [schedule] = await catering.listFulfillmentSchedules({ fulfillment_method: "pickup" })
        await catering.updateFulfillmentSchedules({ id: schedule.id, request_response_hours: 2 })

        const second = await requestFor(term)
        const [after] = await catering.listBookings({ id: second.requestId })
        const [unchanged] = await catering.listBookings({ id: first.requestId })

        expect(new Date(unchanged.response_deadline!).getTime()).toEqual(
          new Date(before.response_deadline!).getTime()
        )
        expect(new Date(after.response_deadline!).getTime() - Date.now()).toBeLessThan(2 * 3_600_000 + 60_000)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
