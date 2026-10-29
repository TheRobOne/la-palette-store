import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import seed from "../../src/scripts/seed"
import { CATERING_MODULE } from "../../src/modules/catering"
import type CateringModuleService from "../../src/modules/catering/service"
import { addDays, warsawToday } from "../../src/modules/catering/scheduling/time"
import { expirePickupRequests } from "../../src/jobs/expire-pickup-requests"
import { remindStaffRequests } from "../../src/jobs/remind-staff-requests"
import { sendPickupReminders } from "../../src/jobs/send-pickup-reminders"
import { warsawWallClockToInstant } from "../../src/modules/catering/scheduling/time"

// specs/006-transactional-emails — contracts/emails.md. No RESEND_API_KEY in
// tests: the provider only logs, and the Notification Module records every
// e-mail (template, recipient, data, status), which these tests read.
// Mondays are "on request" as in pickup-requests.spec.ts; carts hold
// 12 × "test-mini-tarta-cytrynowa" (12 zł) = 144 zł.

type Window = { start: string; end: string; available: boolean; requires_confirmation: boolean }
type Day = { date: string; windows: Window[] }
type Term = { method: string; date: string; start: string; end: string }
type ErrorResponse = { response: { status: number; data: Record<string, unknown> } }
type Notification = {
  id: string
  to: string
  template: string
  status: string
  resource_id: string
  data: Record<string, unknown>
}

const STAFF = "kuchnia@lapalettegarden.pl"
const CUSTOMER = "klient@example.com"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: { "x-publishable-api-key": string }
    let regionId: string
    let variantId: string
    let container: MedusaContainer
    let catering: CateringModuleService

    const setStaffEmail = async (email: string) => {
      const stores = container.resolve(Modules.STORE)
      const [store] = await stores.listStores({}, { take: 1 })
      await stores.updateStores(store.id, {
        metadata: { ...(store.metadata ?? {}), catering_staff_email: email },
      })
    }

    beforeEach(async () => {
      container = getContainer()
      process.env.APP_ENV = "local"
      process.env.STOREFRONT_URL = "https://shop.example"
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
      await setStaffEmail(STAFF)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: apiKeys } = await query.graph({
        entity: "api_key",
        fields: ["token"],
        filters: { title: "Storefront" },
      })
      headers = { "x-publishable-api-key": apiKeys[0].token }
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"], filters: { name: "Polska" } })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { handle: "test-mini-tarta-cytrynowa" },
      })
      variantId = products[0].variants[0].id
    })

    const emails = async (filter: Record<string, unknown> = {}): Promise<Notification[]> =>
      (await container
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "email", ...filter } as never, { take: 100 })) as never

    /** Subscribers run asynchronously: wait until `count` e-mails match. */
    const waitForEmails = async (filter: Record<string, unknown>, count = 1) => {
      for (let i = 0; i < 50; i++) {
        const found = await emails(filter)
        if (found.length >= count) {
          // give a duplicate a chance to show up before asserting "exactly"
          await new Promise((r) => setTimeout(r, 300))
          return emails(filter)
        }
        await new Promise((r) => setTimeout(r, 200))
      }
      return emails(filter)
    }

    const today = () => warsawToday(new Date())

    const firstTerm = async (onRequest: boolean): Promise<Term> => {
      const { data } = await api.get(
        `/store/catering/slots?from=${today()}&to=${addDays(today(), 21)}`,
        { headers }
      )
      for (const day of data.slots.days as Day[]) {
        const w = day.windows.find((x) => x.available && x.requires_confirmation === onRequest)
        if (w) return { method: "pickup", date: day.date, start: w.start, end: w.end }
      }
      throw new Error("no window found")
    }

    const prepareCart = async (term: Term, metadata: Record<string, unknown> = {}) => {
      const {
        data: { cart },
      } = await api.post("/store/carts", { region_id: regionId, email: CUSTOMER }, { headers })
      await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity: 12 }, { headers })
      const {
        data: { shipping_options },
      } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, { headers })
      await api.post(`/store/carts/${cart.id}/shipping-methods`, { option_id: shipping_options.find((o: { type: { code: string } }) => o.type.code === "pickup").id }, { headers })
      await api.post(`/store/carts/${cart.id}`, { metadata: { catering_term: term, ...metadata } }, { headers })
      return cart.id as string
    }

    const payAndComplete = async (cartId: string) => {
      const {
        data: { payment_collection },
      } = await api.post("/store/payment-collections", { cart_id: cartId }, { headers })
      await api.post(
        `/store/payment-collections/${payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        { headers }
      )
      const response = await api
        .post(`/store/carts/${cartId}/complete`, {}, { headers })
        .catch((e: ErrorResponse) => e.response)
      expect(response.data.type).toEqual("order")
      return response.data.order as { id: string; display_id: number }
    }

    const adminHeaders = async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: "admin@lapalette.local",
        password: "lapalette-local",
      })
      return { authorization: `Bearer ${data.token}` }
    }

    const sendRequest = async (term: Term) => {
      const cartId = await prepareCart(term)
      expect((await api.post("/store/catering/requests", { cart_id: cartId }, { headers })).status).toEqual(200)
      const [booking] = await catering.listBookings({ cart_id: cartId })
      return { cartId, requestId: booking.id }
    }

    const decide = async (id: string, decision: "confirm" | "decline") =>
      api.post(`/admin/catering/requests/${id}/${decision}`, {}, { headers: await adminHeaders() })

    describe("US1 — order confirmation", () => {
      it("sends exactly one confirmation with the contract data, and one staff e-mail", async () => {
        const order = await payAndComplete(
          await prepareCart(await firstTerm(false), { order_notes: "Bez orzechów" })
        )

        const [confirmation, ...duplicates] = await waitForEmails({ template: "order-confirmation" })
        expect(duplicates).toEqual([])
        expect(confirmation).toEqual(
          expect.objectContaining({ to: CUSTOMER, status: "success", resource_id: order.id })
        )
        expect(confirmation.data).toEqual(
          expect.objectContaining({
            display_id: order.display_id,
            total: 144,
            notes: "Bez orzechów",
            invoice: null,
            items: [expect.objectContaining({ quantity: 12, total: 144 })],
            pickup_address: expect.objectContaining({ city: "Kraków" }),
            links: expect.objectContaining({ terms: "https://shop.example/catering/regulamin" }),
          })
        )

        const staff = await waitForEmails({ template: "staff-new-order" })
        expect(staff.map((n) => n.to)).toEqual([STAFF])

        // a repeated order.placed sends nothing new
        await container.resolve(Modules.EVENT_BUS).emit({ name: "order.placed", data: { id: order.id } })
        await new Promise((r) => setTimeout(r, 1500))
        expect(await emails({ template: "order-confirmation" })).toHaveLength(1)
        expect(await emails({ template: "staff-new-order" })).toHaveLength(1)
      })

      it("includes invoice data when requested", async () => {
        const cartId = await prepareCart(await firstTerm(false), {
          invoice_requested: true,
          invoice_nip: "1234563218",
        })
        await api.post(
          `/store/carts/${cartId}`,
          {
            billing_address: {
              company: "Firma Sp. z o.o.",
              address_1: "ul. Testowa 1",
              postal_code: "30-001",
              city: "Kraków",
              country_code: "pl",
            },
          },
          { headers }
        )
        await payAndComplete(cartId)
        const [confirmation] = await waitForEmails({ template: "order-confirmation" })
        expect(confirmation.data.invoice).toEqual({
          company: "Firma Sp. z o.o.",
          nip: "1234563218",
          address: "ul. Testowa 1, 30-001 Kraków",
        })
      })
    })

    // spec 007 — a delivery order carries the address, zone and cost
    describe("delivery orders", () => {
      it("sends confirmation and staff e-mail with the delivery fulfillment", async () => {
        const { data } = await api.get(
          `/store/catering/slots?from=${today()}&to=${addDays(today(), 14)}&method=delivery`,
          { headers }
        )
        const day = (data.slots.days as Day[]).find((d) => d.windows.some((w) => w.available))!
        const w = day.windows.find((x) => x.available)!
        const {
          data: { cart },
        } = await api.post("/store/carts", { region_id: regionId, email: CUSTOMER }, { headers })
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity: 12 }, { headers })
        await api.post(
          `/store/carts/${cart.id}`,
          {
            shipping_address: {
              first_name: "Anna",
              last_name: "Nowak",
              address_1: "ul. Przykładowa 5/2",
              postal_code: "31-763",
              city: "Kraków",
              phone: "+48 600 000 000",
              country_code: "pl",
            },
          },
          { headers }
        )
        const {
          data: { shipping_options },
        } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, { headers })
        await api.post(
          `/store/carts/${cart.id}/shipping-methods`,
          { option_id: shipping_options.find((o: { type: { code: string } }) => o.type.code === "delivery").id },
          { headers }
        )
        await api.post(
          `/store/carts/${cart.id}`,
          { metadata: { catering_term: { method: "delivery", date: day.date, start: w.start, end: w.end } } },
          { headers }
        )
        await payAndComplete(cart.id)

        const fulfillment = {
          method: "delivery",
          address: { address_1: "ul. Przykładowa 5/2", postal_code: "31-763", city: "Kraków", phone: "+48 600 000 000" },
          zone_name: "Strefa 1",
          out_of_zone: false,
          delivery_cost: 30,
        }
        const [confirmation] = await waitForEmails({ template: "order-confirmation" })
        expect(confirmation.data).toEqual(expect.objectContaining({ fulfillment }))
        const [staff] = await waitForEmails({ template: "staff-new-order" })
        expect(staff.data).toEqual(expect.objectContaining({ fulfillment }))
      })
    })

    describe("US2 — request e-mails", () => {
      it("sends one e-mail per state: created, confirmed, then the order confirmation when paid", async () => {
        const term = await firstTerm(true)
        const { cartId, requestId } = await sendRequest(term)

        const [created] = await waitForEmails({ template: "request-created" })
        expect(created).toEqual(expect.objectContaining({ to: CUSTOMER, resource_id: requestId }))
        expect(created.data).toEqual(
          expect.objectContaining({
            response_deadline: expect.any(String),
            links: expect.objectContaining({
              request_status: `https://shop.example/catering/zapytanie/${cartId}`,
            }),
          })
        )
        expect((await waitForEmails({ template: "staff-new-request" })).map((n) => n.to)).toEqual([STAFF])

        expect((await decide(requestId, "confirm")).status).toEqual(200)
        const [confirmed] = await waitForEmails({ template: "request-confirmed" })
        expect(confirmed.data.payment_deadline).toEqual(expect.any(String))

        const order = await payAndComplete(cartId)
        const [orderConfirmation] = await waitForEmails({ template: "order-confirmation" })
        expect(orderConfirmation.resource_id).toEqual(order.id)

        const requestEmails = (await emails({ resource_id: requestId })).map((n) => n.template).sort()
        expect(requestEmails).toEqual(["request-confirmed", "request-created", "staff-new-request"])
      })

      it("tells the customer about a decline, an expiry and a cancellation for lack of payment", async () => {
        const term = await firstTerm(true)
        const declined = await sendRequest(term)
        expect((await decide(declined.requestId, "decline")).status).toEqual(200)
        expect(await waitForEmails({ template: "request-declined" })).toHaveLength(1)

        const expired = await sendRequest(term)
        const unpaid = await sendRequest(term)
        expect((await decide(unpaid.requestId, "confirm")).status).toEqual(200)
        const past = new Date(Date.now() - 60_000)
        await catering.updateBookings([
          { id: expired.requestId, response_deadline: past },
          { id: unpaid.requestId, payment_deadline: past },
        ])
        await expirePickupRequests(container)
        await expirePickupRequests(container) // a repeated run sends nothing new

        const [expiredEmail] = await waitForEmails({ template: "request-expired" })
        expect(expiredEmail.resource_id).toEqual(expired.requestId)
        const [canceledEmail] = await waitForEmails({ template: "request-canceled" })
        expect(canceledEmail.resource_id).toEqual(unpaid.requestId)
        expect(await emails({ template: "request-expired" })).toHaveLength(1)
        expect(await emails({ template: "request-canceled" })).toHaveLength(1)
      })
    })

    describe("US3 — staff notifications", () => {
      it("reminds staff once about an undecided request near its deadline", async () => {
        const { requestId } = await sendRequest(await firstTerm(true))
        const decided = await sendRequest(await firstTerm(true))
        expect((await decide(decided.requestId, "confirm")).status).toEqual(200)
        const inThreeHours = new Date(Date.now() + 3 * 3_600_000)
        await catering.updateBookings([
          { id: requestId, response_deadline: inThreeHours },
          { id: decided.requestId, response_deadline: inThreeHours },
        ])

        expect((await remindStaffRequests(container)).reminded).toEqual([requestId])
        await remindStaffRequests(container)
        const reminders = await waitForEmails({ template: "staff-request-reminder" })
        expect(reminders.map((n) => [n.to, n.resource_id])).toEqual([[STAFF, requestId]])
      })

      it("skips staff e-mails without a staff address but still e-mails the customer", async () => {
        await setStaffEmail("")
        await payAndComplete(await prepareCart(await firstTerm(false)))
        expect(await waitForEmails({ template: "order-confirmation" })).toHaveLength(1)
        expect(await emails({ template: "staff-new-order" })).toEqual([])
      })
    })

    /** Available standard windows within 3 weeks, in order. */
    const standardTerms = async (): Promise<Term[]> => {
      const { data } = await api.get(
        `/store/catering/slots?from=${today()}&to=${addDays(today(), 21)}`,
        { headers }
      )
      return (data.slots.days as Day[]).flatMap((day) =>
        day.windows
          .filter((w) => w.available && !w.requires_confirmation)
          .map((w) => ({ method: "pickup", date: day.date, start: w.start, end: w.end }))
      )
    }

    /** The order's booking once the order.placed subscriber has linked it. */
    const bookingOf = async (orderId: string) => {
      for (let i = 0; i < 25; i++) {
        const [booking] = await catering.listBookings({ order_id: orderId })
        if (booking) return booking
        await new Promise((r) => setTimeout(r, 200))
      }
      throw new Error(`no booking linked to ${orderId}`)
    }

    describe("US4 — reschedule and cancellation", () => {
      it("e-mails the old and new term on every move of an order or a request", async () => {
        const terms = await standardTerms()
        const order = await payAndComplete(await prepareCart(terms[0]))
        await bookingOf(order.id)
        const admin = await adminHeaders()

        const target = terms.find((t) => t.date !== terms[0].date)!
        await api.post(
          `/admin/catering/orders/${order.id}/pickup-term`,
          { date: target.date, start: target.start, end: target.end, confirm: true },
          { headers: admin }
        )
        const [moved] = await waitForEmails({ template: "pickup-rescheduled" })
        expect(moved.resource_id).toEqual(order.id)
        expect(moved.data.previous_term).toEqual({ date: terms[0].date, start: terms[0].start, end: terms[0].end })
        expect(moved.data.term).toEqual({ date: target.date, start: target.start, end: target.end })

        // a second move is a second e-mail
        await api.post(
          `/admin/catering/orders/${order.id}/pickup-term`,
          { date: terms[0].date, start: terms[0].start, end: terms[0].end, confirm: true },
          { headers: admin }
        )
        expect(await waitForEmails({ template: "pickup-rescheduled" }, 2)).toHaveLength(2)

        // a request (no order yet) is moved too
        const { requestId } = await sendRequest(await firstTerm(true))
        await api.post(
          `/admin/catering/requests/${requestId}/pickup-term`,
          { date: target.date, start: target.start, end: target.end, confirm: true },
          { headers: admin }
        )
        const forRequest = await waitForEmails({ template: "pickup-rescheduled", resource_id: requestId })
        expect(forRequest).toHaveLength(1)
        expect(forRequest[0].data.links).toEqual(
          expect.objectContaining({ request_status: expect.stringContaining("/catering/zapytanie/") })
        )
      })

      it("e-mails the customer when staff cancel the order", async () => {
        const order = await payAndComplete(await prepareCart(await firstTerm(false)))
        await bookingOf(order.id)
        await api.post(`/admin/orders/${order.id}/cancel`, {}, { headers: await adminHeaders() })
        const [canceled, ...more] = await waitForEmails({ template: "order-canceled" })
        expect(more).toEqual([])
        expect(canceled).toEqual(expect.objectContaining({ to: CUSTOMER, resource_id: order.id }))
      })
    })

    describe("US5 — pickup reminder", () => {
      it("reminds once the day before the pickup, after 08:00 Warsaw", async () => {
        const term = await firstTerm(false)
        const order = await payAndComplete(await prepareCart(term))
        await bookingOf(order.id)
        const dayBefore = addDays(term.date, -1)

        const early = warsawWallClockToInstant(dayBefore, "07:30")
        expect((await sendPickupReminders(container, early)).reminded).toEqual([])

        const morning = warsawWallClockToInstant(dayBefore, "09:00")
        expect((await sendPickupReminders(container, morning)).reminded).toEqual([order.id])
        await sendPickupReminders(container, warsawWallClockToInstant(dayBefore, "10:00"))

        const reminders = await waitForEmails({ template: "pickup-reminder" })
        expect(reminders.map((n) => [n.to, n.resource_id])).toEqual([[CUSTOMER, order.id]])
      })
    })

    describe("E-mail history (Admin)", () => {
      it("lists an order's e-mails including those of the request it was paid from", async () => {
        const { cartId, requestId } = await sendRequest(await firstTerm(true))
        await decide(requestId, "confirm")
        await waitForEmails({ template: "request-confirmed" })
        const order = await payAndComplete(cartId)
        await waitForEmails({ template: "order-confirmation" })
        await waitForEmails({ template: "staff-new-order" })

        const { data } = await api.get(`/admin/catering/notifications?resource_id=${order.id}`, {
          headers: await adminHeaders(),
        })
        const templates = data.notifications.map((n: { template: string }) => n.template).sort()
        expect(templates).toEqual([
          "order-confirmation",
          "request-confirmed",
          "request-created",
          "staff-new-order",
          "staff-new-request",
        ])
        expect(data.notifications.every((n: { resource_id: string }) => n.resource_id === order.id)).toBe(true)
        expect(data.notifications[0]).toEqual(
          expect.objectContaining({ status: "success", attempts: 1, to: expect.any(String) })
        )

        const bad = await api
          .get("/admin/catering/notifications", { headers: await adminHeaders() })
          .catch((e: ErrorResponse) => e.response)
        expect(bad.status).toEqual(400)
      })
    })
  },
})

jest.setTimeout(300_000)
