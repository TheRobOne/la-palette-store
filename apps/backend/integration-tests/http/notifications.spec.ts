import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import seed from "../../src/scripts/seed"
import { CATERING_MODULE } from "../../src/modules/catering"
import type CateringModuleService from "../../src/modules/catering/service"
import { addDays, warsawToday } from "../../src/modules/catering/scheduling/time"
import { expirePickupRequests } from "../../src/jobs/expire-pickup-requests"
import { remindStaffRequests } from "../../src/jobs/remind-staff-requests"

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
      await api.post(`/store/carts/${cart.id}/shipping-methods`, { option_id: shipping_options[0].id }, { headers })
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
  },
})

jest.setTimeout(300_000)
