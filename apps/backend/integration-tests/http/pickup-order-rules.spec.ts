import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seed from "../../src/scripts/seed"
import { setupPickup } from "../../src/scripts/setup-pickup"

// Pickup-only fulfillment + minimum order value (contract: apps/backend/AGENTS.md
// → "Kontrakty dla storefrontu"). Sample product "test-mini-tarta-cytrynowa"
// costs 12 zł gross: 1 piece = 12 zł (below 100 zł), 12 pieces = 144 zł.
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

    const createCartWithPickup = async (quantity: number) => {
      const {
        data: { cart },
      } = await api.post(
        "/store/carts",
        { region_id: regionId, email: "klient@example.com" },
        { headers }
      )
      await api.post(
        `/store/carts/${cart.id}/line-items`,
        { variant_id: variantId, quantity },
        { headers }
      )

      const {
        data: { shipping_options },
      } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, { headers })
      expect(shipping_options).toHaveLength(1)
      expect(shipping_options[0]).toEqual(
        expect.objectContaining({
          name: "Odbiór osobisty",
          amount: 0,
          type: expect.objectContaining({ code: "pickup" }),
        })
      )

      await api.post(
        `/store/carts/${cart.id}/shipping-methods`,
        { option_id: shipping_options[0].id },
        { headers }
      )
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

    describe("GET /store/catering/order-rules", () => {
      it("returns the minimum order value and the pickup address", async () => {
        const response = await api.get("/store/catering/order-rules", { headers })

        expect(response.status).toEqual(200)
        expect(response.data.order_rules).toEqual({
          currency_code: "pln",
          min_order_value: 100,
          fulfillment: {
            pickup: {
              enabled: true,
              address: {
                address_1: "ul. Gustawa Morcinka 40",
                postal_code: "31-762",
                city: "Kraków",
                phone: "+48 734 431 447",
              },
            },
            delivery: { enabled: false },
          },
        })
      })
    })

    describe("POST /store/carts/:id/complete with pickup", () => {
      it("rejects a cart below the minimum order value", async () => {
        const cartId = await createCartWithPickup(1)
        await pay(cartId)

        const response = await api
          .post(`/store/carts/${cartId}/complete`, {}, { headers })
          .catch((e: { response: { status: number; data: unknown } }) => e.response)

        expect(response.status).toEqual(400)
        expect(response.data).toEqual(
          expect.objectContaining({
            type: "invalid_data",
            message:
              "Minimalna wartość zamówienia to 100,00 zł. Dodaj produkty za co najmniej 88,00 zł.",
          })
        )
      })

      it("places an order at or above the minimum without a shipping address", async () => {
        const cartId = await createCartWithPickup(12)
        await pay(cartId)

        const response = await api.post(
          `/store/carts/${cartId}/complete`,
          {},
          { headers }
        )

        expect(response.status).toEqual(200)
        expect(response.data.type).toEqual("order")
        // Medusa pre-fills only country_code for a single-country region;
        // the storefront never sends a street address for pickup.
        expect(response.data.order.shipping_address).toEqual(
          expect.objectContaining({ country_code: "pl", address_1: null, city: null })
        )
        expect(response.data.order.shipping_methods).toEqual([
          expect.objectContaining({ name: "Odbiór osobisty", amount: 0 }),
        ])
      })
    })

    describe("setupPickup idempotency", () => {
      it("keeps exactly one pickup set, zone and option after another run", async () => {
        const container = getContainer()
        await setupPickup(container)

        const fulfillment = container.resolve(Modules.FULFILLMENT)
        expect(
          await fulfillment.listFulfillmentSets({ type: "pickup" })
        ).toHaveLength(1)
        expect(
          await fulfillment.listServiceZones({ name: "Lokal La Palette Garden" })
        ).toHaveLength(1)
        expect(
          await fulfillment.listShippingOptions({ name: "Odbiór osobisty" })
        ).toHaveLength(1)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
