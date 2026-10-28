import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seed from "../../src/scripts/seed"
import { CATERING_MODULE } from "../../src/modules/catering"
import type CateringModuleService from "../../src/modules/catering/service"
import { FREE_DELIVERY_THRESHOLD_METADATA_KEY } from "../../src/lib/free-delivery-threshold"
import { addDays, warsawToday } from "../../src/modules/catering/scheduling/time"

// City delivery in postal-code zones (specs/007-delivery-zones, contracts/store-api.md).
// Seed creates "Strefa 1" (31-762, 31-763, 31-764, 32-005, 32-010, 32-020 — 30 zł) and
// "Strefa 2" (30-001, 31-001 — 50 zł). Sample product "test-mini-tarta-cytrynowa"
// costs 12 zł gross: 12 pieces = 144 zł.
type ErrorResponse = { response: { status: number; data: { type?: string; message?: string } } }
const asResponse = (e: ErrorResponse) => e.response

const address = (postal_code: string, overrides: Record<string, string> = {}) => ({
  first_name: "Anna",
  last_name: "Nowak",
  address_1: "ul. Przykładowa 5/2",
  postal_code,
  city: "Kraków",
  phone: "+48 600 000 000",
  country_code: "pl",
  ...overrides,
})

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: { "x-publishable-api-key": string }
    let regionId: string
    let variantId: string

    beforeEach(async () => {
      const container = getContainer()
      process.env.APP_ENV = "local"
      await seed({ container } as never)

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

    const catering = () => getContainer().resolve<CateringModuleService>(CATERING_MODULE)

    const adminHeaders = async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: "admin@lapalette.local",
        password: "lapalette-local",
      })
      return { authorization: `Bearer ${data.token}` }
    }

    const createCart = async (quantity = 12) => {
      const {
        data: { cart },
      } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "klient@example.com" },
        { headers }
      )
      await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity }, { headers })
      return cart.id as string
    }

    const listOptions = async (cartId: string) => {
      const {
        data: { shipping_options },
      } = await api.get(`/store/shipping-options?cart_id=${cartId}`, { headers })
      return shipping_options as { id: string; amount: number; type: { code: string } }[]
    }

    const optionFor = async (cartId: string, code: "pickup" | "delivery") =>
      (await listOptions(cartId)).find((o) => o.type.code === code)!

    const getCart = async (cartId: string) => (await api.get(`/store/carts/${cartId}`, { headers })).data.cart

    /** First available window of `method` in the next two weeks. */
    const firstWindow = async (method: "pickup" | "delivery") => {
      const today = warsawToday(new Date())
      const {
        data: { slots },
      } = await api.get(
        `/store/catering/slots?from=${today}&to=${addDays(today, 14)}&method=${method}`,
        { headers }
      )
      const day = slots.days.find((d: { available: boolean }) => d.available)
      const window = day.windows.find((w: { available: boolean }) => w.available)
      return { method, date: day.date as string, start: window.start as string, end: window.end as string }
    }

    /** A delivery cart ready to pay: address, delivery method, delivery term. */
    const createDeliveryCart = async (postalCode = "31-763", quantity = 12, overrides = {}) => {
      const cartId = await createCart(quantity)
      await api.post(`/store/carts/${cartId}`, { shipping_address: address(postalCode, overrides) }, { headers })
      const option = await optionFor(cartId, "delivery")
      await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: option.id }, { headers })
      await api.post(
        `/store/carts/${cartId}`,
        { metadata: { catering_term: await firstWindow("delivery") } },
        { headers }
      )
      return cartId
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
      api.post(`/store/carts/${cartId}/complete`, {}, { headers }).catch(asResponse)

    const expectRefused = async (cartId: string, message: string | RegExp) => {
      await pay(cartId)
      const response = await complete(cartId)
      expect(response.status).toEqual(400)
      expect(response.data).toEqual(
        expect.objectContaining({ type: "invalid_data", message: expect.stringMatching(message) })
      )
    }

    describe("GET /store/catering/delivery-quote", () => {
      it.each([
        ["31-763", "in_zone", "Strefa 1", 30],
        ["32-005", "in_zone", "Strefa 1", 30],
        ["30-001", "in_zone", "Strefa 2", 50],
      ])("prices %s in its zone", async (postalCode, status, zone, amount) => {
        const { data } = await api.get(`/store/catering/delivery-quote?postal_code=${postalCode}`, { headers })
        expect(data.delivery_quote).toEqual(
          expect.objectContaining({
            postal_code: postalCode,
            status,
            zone: expect.objectContaining({ name: zone }),
            amount,
            min_order_value: 100,
            free_delivery_threshold: null,
            requires_confirmation: false,
          })
        )
      })

      it("sends a code outside every zone to confirmation and refuses a partial code", async () => {
        const outside = await api.get("/store/catering/delivery-quote?postal_code=34-500", { headers })
        expect(outside.data.delivery_quote).toEqual(
          expect.objectContaining({ status: "out_of_zone", zone: null, amount: null, requires_confirmation: true })
        )
        const invalid = await api.get("/store/catering/delivery-quote?postal_code=31763", { headers })
        expect(invalid.data.delivery_quote).toEqual(expect.objectContaining({ status: "invalid", amount: null }))
      })
    })

    describe("GET /store/catering/order-rules", () => {
      it("enables delivery without free delivery at launch", async () => {
        const { data } = await api.get("/store/catering/order-rules", { headers })
        expect(data.order_rules.fulfillment.delivery).toEqual({ enabled: true, free_delivery_threshold: null })
      })
    })

    describe("US1 — delivery to an address in a zone", () => {
      it("lists both options and prices delivery from the postal code", async () => {
        const cartId = await createCart()
        await api.post(`/store/carts/${cartId}`, { shipping_address: address("31-763") }, { headers })
        const options = await listOptions(cartId)
        expect(options.map((o) => o.type.code).sort()).toEqual(["delivery", "pickup"])

        // a calculated option is priced through the calculate route (contracts §3)
        const delivery = options.find((o) => o.type.code === "delivery")!
        const {
          data: { shipping_option },
        } = await api.post(
          `/store/shipping-options/${delivery.id}/calculate`,
          { cart_id: cartId },
          { headers }
        )
        expect(shipping_option.amount).toEqual(30)
      })

      it("re-prices the delivery method when the postal code or the items change", async () => {
        const cartId = await createDeliveryCart("31-763")
        expect((await getCart(cartId)).shipping_total).toEqual(30)

        await api.post(`/store/carts/${cartId}`, { shipping_address: address("30-001") }, { headers })
        expect((await getCart(cartId)).shipping_total).toEqual(50)

        const store = getContainer().resolve(Modules.STORE)
        const [s] = await store.listStores()
        await store.updateStores(s.id, {
          metadata: { ...(s.metadata ?? {}), [FREE_DELIVERY_THRESHOLD_METADATA_KEY]: 150 },
        })
        await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 1 }, { headers })
        expect((await getCart(cartId)).shipping_total).toEqual(0)
      })

      it("places a delivery order with the address, the term and the zone price", async () => {
        const cartId = await createDeliveryCart("31-763")
        await pay(cartId)
        const response = await complete(cartId)

        expect(response.status).toEqual(200)
        const order = response.data.order
        expect(order.shipping_total).toEqual(30)
        expect(order.shipping_address).toEqual(
          expect.objectContaining({ address_1: "ul. Przykładowa 5/2", postal_code: "31-763", phone: "+48 600 000 000" })
        )
        const { data: orders } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order", fields: ["metadata"], filters: { id: order.id } })
        expect(orders[0].metadata?.catering_term).toEqual(expect.objectContaining({ method: "delivery" }))

        const [booking] = await catering().listBookings({ cart_id: cartId })
        expect(booking).toEqual(
          expect.objectContaining({
            fulfillment_method: "delivery",
            delivery_postal_code: "31-763",
            delivery_zone_name: "Strefa 1",
          })
        )
        expect(Number(booking.delivery_cost)).toEqual(30)
      })

      it("refuses delivery without a phone number", async () => {
        const cartId = await createDeliveryCart("31-763", 12, { phone: "" })
        await expectRefused(cartId, "Uzupełnij adres dostawy: telefon.")
      })

      it("refuses an invalid postal code", async () => {
        const cartId = await createDeliveryCart("31763")
        await expectRefused(cartId, /^Podaj poprawny kod pocztowy \(XX-XXX\)\.$/)
      })

      it("refuses a pickup term with the delivery option", async () => {
        const cartId = await createDeliveryCart("31-763")
        await api.post(`/store/carts/${cartId}`, { metadata: { catering_term: await firstWindow("pickup") } }, { headers })
        await expectRefused(cartId, "Wybierz ponownie sposób odbioru lub dostawy.")
      })

      it("refuses when staff changed the zone price after the cart was priced", async () => {
        const cartId = await createDeliveryCart("31-763")
        const [zone] = await catering().listDeliveryZones({ name: "Strefa 1" })
        await catering().updateDeliveryZones({ id: zone.id, price: 35 })
        await expectRefused(cartId, "Koszt dostawy się zmienił — sprawdź koszyk i spróbuj ponownie.")
      })

      it("refuses an order below the zone minimum", async () => {
        const [zone] = await catering().listDeliveryZones({ name: "Strefa 1" })
        await catering().updateDeliveryZones({ id: zone.id, min_order_value: 200 })
        const cartId = await createDeliveryCart("31-763")
        await expectRefused(
          cartId,
          "Minimalna wartość zamówienia z dostawą pod ten adres to 200,00 zł. Dodaj produkty za co najmniej 56,00 zł."
        )
      })

      it("refuses an out-of-zone address without the kitchen's confirmation", async () => {
        const cartId = await createDeliveryCart("34-500")
        await expectRefused(cartId, "Dostawa pod ten adres wymaga potwierdzenia kuchni — wyślij zapytanie.")
      })

      it("keeps pickup working without a shipping address", async () => {
        const cartId = await createCart()
        const option = await optionFor(cartId, "pickup")
        await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: option.id }, { headers })
        await api.post(`/store/carts/${cartId}`, { metadata: { catering_term: await firstWindow("pickup") } }, { headers })
        await pay(cartId)
        const response = await complete(cartId)
        expect(response.status).toEqual(200)
        expect(response.data.order.shipping_total).toEqual(0)
      })
    })

    describe("US2 — staff manage zones in the Admin", () => {
      it("creates, updates, matches and deletes a zone", async () => {
        const auth = await adminHeaders()
        const created = await api.post(
          "/admin/catering/delivery-zones",
          { name: "Strefa 3", price: 70, min_order_value: 150, postal_codes: ["31-870", " 31-871 ", "31-870"] },
          { headers: auth }
        )
        expect(created.status).toEqual(200)
        expect(created.data.delivery_zone).toEqual(
          expect.objectContaining({ name: "Strefa 3", price: 70, min_order_value: 150, postal_codes: ["31-870", "31-871"] })
        )
        const id = created.data.delivery_zone.id

        const match = await api.get("/admin/catering/delivery-zones/match?postal_code=31-871", { headers: auth })
        expect(match.data).toEqual({ postal_code: "31-871", valid: true, zone: { id, name: "Strefa 3" } })

        const updated = await api.post(
          `/admin/catering/delivery-zones/${id}`,
          { name: "Strefa 3", price: 65.5, min_order_value: null, postal_codes: ["31-872"] },
          { headers: auth }
        )
        expect(updated.data.delivery_zone).toEqual(
          expect.objectContaining({ price: 65.5, min_order_value: null, postal_codes: ["31-872"] })
        )
        const quote = await api.get("/store/catering/delivery-quote?postal_code=31-871", { headers })
        expect(quote.data.delivery_quote.status).toEqual("out_of_zone")

        const list = await api.get("/admin/catering/delivery-zones", { headers: auth })
        expect(list.data.delivery_zones.map((z: { name: string }) => z.name)).toEqual(["Strefa 1", "Strefa 2", "Strefa 3"])

        const deleted = await api.delete(`/admin/catering/delivery-zones/${id}`, { headers: auth })
        expect(deleted.data).toEqual({ id, deleted: true })
        expect(await catering().listDeliveryZoneCodes({ code: "31-872" })).toHaveLength(0)
      })

      it("names invalid entries, codes of another zone and a duplicate name", async () => {
        const auth = await adminHeaders()
        const post = (body: Record<string, unknown>) =>
          api.post("/admin/catering/delivery-zones", body, { headers: auth }).catch(asResponse)

        const invalid = await post({ name: "Strefa 3", price: 70, postal_codes: ["31-870", "31-7", "3187"] })
        expect(invalid.status).toEqual(400)
        expect(invalid.data.message).toEqual("Nieprawidłowe kody pocztowe: 31-7, 3187. Użyj formatu XX-XXX.")

        const taken = await post({ name: "Strefa 3", price: 70, postal_codes: ["31-870", "31-762", "31-763"] })
        expect(taken.status).toEqual(400)
        expect(taken.data.message).toEqual("Kody 31-762, 31-763 są już w strefie „Strefa 1”.")

        const duplicate = await post({ name: "Strefa 1", price: 70, postal_codes: ["31-870"] })
        expect(duplicate.status).toEqual(400)
        expect(duplicate.data.message).toEqual("Strefa o nazwie „Strefa 1” już istnieje.")

        const empty = await post({ name: "Strefa 3", price: 70, postal_codes: [] })
        expect(empty.status).toEqual(400)
        expect(empty.data.message).toEqual("Podaj co najmniej jeden kod pocztowy.")
      })

      it("applies a price change to new carts and keeps placed orders", async () => {
        const first = await createDeliveryCart("31-763")
        await pay(first)
        const placed = await complete(first)
        expect(placed.data.order.shipping_total).toEqual(30)

        const auth = await adminHeaders()
        const [zone] = await catering().listDeliveryZones({ name: "Strefa 1" }, { relations: ["codes"] })
        await api.post(
          `/admin/catering/delivery-zones/${zone.id}`,
          { name: "Strefa 1", price: 40, postal_codes: zone.codes.map((c) => c.code) },
          { headers: auth }
        )

        const second = await createDeliveryCart("31-763")
        expect((await getCart(second)).shipping_total).toEqual(40)
        const order = await api.get(`/admin/orders/${placed.data.order.id}?fields=shipping_total`, { headers: auth })
        expect(order.data.order.shipping_total).toEqual(30)
      })
    })

    describe("US3 — an address outside every zone goes to the kitchen", () => {
      const sendRequest = (cartId: string) =>
        api.post("/store/catering/requests", { cart_id: cartId }, { headers }).catch(asResponse)
      const requestOf = async (cartId: string) =>
        (await api.get(`/store/catering/requests/${cartId}`, { headers })).data.request
      const confirm = async (id: string, body?: Record<string, unknown>) =>
        api
          .post(`/admin/catering/requests/${id}/confirm`, body ?? {}, { headers: await adminHeaders() })
          .catch(asResponse)
      const bookingOf = async (cartId: string) =>
        (await catering().listBookings({ cart_id: cartId, requires_confirmation: true }))[0]

      it("sends an out-of-zone cart on a standard window and pays the confirmed cost", async () => {
        const cartId = await createDeliveryCart("34-500")
        const sent = await sendRequest(cartId)
        expect(sent.status).toEqual(200)
        expect(sent.data.request.fulfillment).toEqual({
          method: "delivery",
          postal_code: "34-500",
          out_of_zone: true,
          delivery_cost: null,
        })

        // not payable before the kitchen confirms
        await expectRefused(cartId, "Dostawa pod ten adres wymaga potwierdzenia kuchni — wyślij zapytanie.")

        const booking = await bookingOf(cartId)
        const { data } = await api.get("/admin/catering/requests?status=requested", {
          headers: await adminHeaders(),
        })
        expect(data.requests.find((r: { id: string }) => r.id === booking.id).fulfillment).toEqual(
          expect.objectContaining({
            method: "delivery",
            address: "ul. Przykładowa 5/2, 34-500 Kraków",
            phone: "+48 600 000 000",
            out_of_zone: true,
            zone_name: null,
          })
        )

        const missing = await confirm(booking.id)
        expect(missing.status).toEqual(400)
        expect(missing.data.message).toEqual("Podaj koszt dostawy.")

        expect((await confirm(booking.id, { delivery_cost: 80 })).status).toEqual(200)
        expect((await requestOf(cartId)).fulfillment.delivery_cost).toEqual(80)
        expect((await getCart(cartId)).shipping_total).toEqual(80)

        await pay(cartId)
        const placed = await complete(cartId)
        expect(placed.data.type).toEqual("order")
        expect(placed.data.order.shipping_total).toEqual(80)
      })

      it("refuses a delivery cost for an in-zone request", async () => {
        const term = await firstWindow("delivery")
        const [zone] = await catering().listDeliveryZones({ name: "Strefa 1" })
        const booking = await catering().createBookings({
          cart_id: "cart_in_zone",
          fulfillment_method: "delivery",
          date: term.date,
          start_time: term.start,
          end_time: term.end,
          status: "requested",
          requires_confirmation: true,
          response_deadline: new Date(Date.now() + 3_600_000),
          delivery_postal_code: "31-763",
          delivery_zone_id: zone.id,
          delivery_zone_name: zone.name,
        })
        const refused = await confirm(booking.id, { delivery_cost: 80 })
        expect(refused.status).toEqual(400)
        expect(refused.data.message).toEqual("Koszt dostawy podaje się tylko dla dostawy spoza stref.")
      })

      it("refuses payment after the postal code changed", async () => {
        const cartId = await createDeliveryCart("34-500")
        await sendRequest(cartId)
        await confirm((await bookingOf(cartId)).id, { delivery_cost: 80 })
        await api.post(`/store/carts/${cartId}`, { shipping_address: address("34-501") }, { headers })
        await expectRefused(cartId, "Zamówienie różni się od wysłanego zapytania — skontaktuj się z nami.")
      })
    })

    describe("US4 — delivery has its own schedule", () => {
      type Window = { start: string; end: string; available: boolean; reason: string | null }
      const dayOf = async (method: "pickup" | "delivery", date: string) => {
        const {
          data: { slots },
        } = await api.get(`/store/catering/slots?from=${date}&to=${date}&method=${method}`, { headers })
        return slots.days[0] as { available: boolean; reason: string | null; windows: Window[] }
      }
      const windowOf = async (term: { date: string; start: string }) =>
        (await dayOf("delivery", term.date)).windows.find((w) => w.start === term.start)!

      it("fills a window at the driver's maximum and keeps pickup open", async () => {
        const term = await firstWindow("delivery")
        for (let i = 0; i < 2; i++) {
          const cartId = await createDeliveryCart()
          await pay(cartId)
          expect((await complete(cartId)).data.type).toEqual("order")
        }

        expect(await windowOf(term)).toEqual(
          expect.objectContaining({ available: false, reason: "window_full" })
        )
        const day = await dayOf("delivery", term.date)
        expect(day.windows.filter((w) => w.start !== term.start).some((w) => w.available)).toBe(true)
        expect((await dayOf("pickup", term.date)).available).toBe(true)
      })

      it("lets exactly one of two parallel completions take the last place (SC-007)", async () => {
        const [first, a, b] = [await createDeliveryCart(), await createDeliveryCart(), await createDeliveryCart()]
        await pay(first)
        expect((await complete(first)).data.type).toEqual("order")
        await pay(a)
        await pay(b)

        const results = await Promise.all([complete(a), complete(b)])
        const orders = results.filter((r) => r.data.type === "order")
        const refused = results.filter((r) => r.status === 400)
        expect(orders).toHaveLength(1)
        expect(refused).toHaveLength(1)
        expect(refused[0].data.message).toMatch(/^Wybrany termin dostawy .* nie jest już dostępny/)
      })

      it("counts open requests against the window", async () => {
        const term = await firstWindow("delivery")
        for (const status of ["requested", "confirmed"] as const) {
          await catering().createBookings({
            cart_id: `cart_${status}`,
            fulfillment_method: "delivery",
            date: term.date,
            start_time: term.start,
            end_time: term.end,
            status,
            requires_confirmation: true,
          })
        }
        expect((await windowOf(term)).reason).toEqual("window_full")
      })

      it("blocks a date for deliveries only", async () => {
        const term = await firstWindow("delivery")
        await api.post(
          "/admin/catering/blocked-dates",
          { date: term.date, method: "delivery", reason: "Kierowca na urlopie" },
          { headers: await adminHeaders() }
        )
        expect((await dayOf("delivery", term.date)).reason).toEqual("blocked")
        expect((await dayOf("pickup", term.date)).available).toBe(true)
      })

      it("reads and writes the per-window maximum for delivery only", async () => {
        const auth = await adminHeaders()
        const get = async (method: string) =>
          (await api.get(`/admin/catering/schedule?method=${method}`, { headers: auth })).data.schedule

        const delivery = await get("delivery")
        expect(delivery.max_orders_per_window).toEqual(2)
        expect((await get("pickup")).max_orders_per_window).toBeNull()

        const { method: _d, ...deliveryBody } = delivery
        const saved = await api.post(
          "/admin/catering/schedule?method=delivery",
          { ...deliveryBody, max_orders_per_window: 3 },
          { headers: auth }
        )
        expect(saved.data.schedule.max_orders_per_window).toEqual(3)

        const { method: _p, ...pickupBody } = await get("pickup")
        const refused = await api
          .post("/admin/catering/schedule?method=pickup", { ...pickupBody, max_orders_per_window: 2 }, { headers: auth })
          .catch(asResponse)
        expect(refused.status).toEqual(400)
        expect(refused.data.message).toEqual("Limit zamówień w jednym oknie dotyczy tylko dostaw.")

        const noLimit = await api.post(
          "/admin/catering/schedule?method=delivery",
          { ...deliveryBody, max_orders_per_window: null },
          { headers: auth }
        )
        expect(noLimit.data.schedule.max_orders_per_window).toBeNull()
      })

      it("warns about a full window when staff move a delivery order", async () => {
        const term = await firstWindow("delivery")
        const orderIds: string[] = []
        for (let i = 0; i < 2; i++) {
          const cartId = await createDeliveryCart()
          await pay(cartId)
          orderIds.push((await complete(cartId)).data.order.id)
        }
        // a third order in another window, moved into the full one
        const other = (await dayOf("delivery", term.date)).windows.find((w) => w.available)!
        const cartId = await createCart()
        await api.post(`/store/carts/${cartId}`, { shipping_address: address("31-763") }, { headers })
        const option = await optionFor(cartId, "delivery")
        await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: option.id }, { headers })
        await api.post(
          `/store/carts/${cartId}`,
          { metadata: { catering_term: { method: "delivery", date: term.date, start: other.start, end: other.end } } },
          { headers }
        )
        await pay(cartId)
        const third = (await complete(cartId)).data.order.id

        const auth = await adminHeaders()
        const move = (confirm: boolean) =>
          api
            .post(
              `/admin/catering/orders/${third}/pickup-term`,
              { date: term.date, start: term.start, end: term.end, confirm },
              { headers: auth }
            )
            .catch(asResponse)
        const warned = await move(false)
        expect(warned.status).toEqual(409)
        expect(warned.data).toEqual(
          expect.objectContaining({
            message: "Nowy termin łamie reguły dostawy. Potwierdź, aby zapisać mimo to.",
            warnings: ["window_full"],
          })
        )
        // an order already in the full window does not count itself
        const own = await api
          .post(
            `/admin/catering/orders/${orderIds[0]}/pickup-term`,
            { date: term.date, start: term.start, end: term.end },
            { headers: auth }
          )
          .catch(asResponse)
        expect(own.status).toEqual(200)
        expect((await move(true)).status).toEqual(200)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
