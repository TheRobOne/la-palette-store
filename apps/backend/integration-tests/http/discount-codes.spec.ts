import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import seed from "../../src/scripts/seed"
import { loadOrderEmailData } from "../../src/lib/emails/data"
import { addDays, warsawToday } from "../../src/modules/catering/scheduling/time"

// apps/backend/AGENTS.md "Discount codes" — contracts/store-api.md, contracts/admin-api.md.
// "test-mini-tarta-cytrynowa" costs 12 zł gross; the store minimum is 100 zł.

type ErrorResponse = { response: { status: number; data: Record<string, unknown> } }

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: { "x-publishable-api-key": string }
    let regionId: string
    let variantId: string
    let container: MedusaContainer

    beforeEach(async () => {
      container = getContainer()
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

    const adminHeaders = async () => {
      const { data } = await api.post("/auth/user/emailpass", {
        email: "admin@lapalette.local",
        password: "lapalette-local",
      })
      return { authorization: `Bearer ${data.token}` }
    }

    /** A fixed-amount code on the whole order — what the manager creates in the Admin. */
    const createCode = async (code: string, value: number) => {
      const { result } = await createPromotionsWorkflow(container).run({
        input: {
          promotionsData: [
            {
              code,
              type: "standard",
              status: "active",
              application_method: {
                type: "fixed",
                target_type: "order",
                allocation: "across",
                value,
                currency_code: "pln",
              },
            },
          ],
        },
      })
      return result[0].id as string
    }

    const prepareCart = async (quantity: number) => {
      const {
        data: { cart },
      } = await api.post("/store/carts", { region_id: regionId, email: "klient@example.com" }, { headers })
      const {
        data: { cart: withItem },
      } = await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity }, { headers })
      const {
        data: { shipping_options },
      } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, { headers })
      await api.post(
        `/store/carts/${cart.id}/shipping-methods`,
        { option_id: shipping_options.find((o: { type: { code: string } }) => o.type.code === "pickup").id },
        { headers }
      )
      const today = warsawToday(new Date())
      const {
        data: { slots },
      } = await api.get(`/store/catering/slots?from=${today}&to=${addDays(today, 14)}`, { headers })
      const day = slots.days.find((d: { available: boolean }) => d.available)
      const window = day.windows.find((w: { available: boolean }) => w.available)
      await api.post(
        `/store/carts/${cart.id}`,
        { metadata: { catering_term: { method: "pickup", date: day.date, start: window.start, end: window.end } } },
        { headers }
      )
      return { cartId: cart.id as string, lineId: withItem.items[0].id as string }
    }

    const applyCode = (cartId: string, code: string) =>
      api
        .post(`/store/carts/${cartId}/promotions`, { promo_codes: [code] }, { headers })
        .catch((e: ErrorResponse) => e.response)

    const codesOf = (cart: { promotions?: { code?: string }[] }) =>
      (cart.promotions ?? []).map((p) => p.code)

    const complete = async (cartId: string) => {
      const {
        data: { payment_collection },
      } = await api.post("/store/payment-collections", { cart_id: cartId }, { headers })
      await api.post(
        `/store/payment-collections/${payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        { headers }
      )
      return api.post(`/store/carts/${cartId}/complete`, {}, { headers }).catch((e: ErrorResponse) => e.response)
    }

    it("applies a fixed code, completes the order and puts the discount into the e-mail data", async () => {
      await createCode("RABAT20", 20)
      const { cartId } = await prepareCart(12)

      const applied = await applyCode(cartId, "RABAT20")
      expect(applied.status).toEqual(200)
      expect(applied.data.cart).toEqual(
        expect.objectContaining({ item_total: 124, original_item_total: 144 })
      )
      expect(codesOf(applied.data.cart)).toEqual(["RABAT20"])

      const completed = await complete(cartId)
      expect(completed.status).toEqual(200)
      const orderId = completed.data.order.id

      const email = await loadOrderEmailData(container, orderId)
      expect(email.total).toEqual(124)
      expect(email.items).toEqual([expect.objectContaining({ quantity: 12, total: 144 })])
      expect(email.discount).toEqual({ codes: ["RABAT20"], items_amount: 20, shipping_amount: 0 })
    })

    it("removes a code", async () => {
      await createCode("RABAT20", 20)
      const { cartId } = await prepareCart(12)
      await applyCode(cartId, "RABAT20")

      const { data } = await api.delete(`/store/carts/${cartId}/promotions`, {
        headers,
        data: { promo_codes: ["RABAT20"] },
      })
      expect(data.cart.item_total).toEqual(144)
      expect(codesOf(data.cart)).toEqual([])
    })

    it("refuses an unknown code; codes are case-sensitive", async () => {
      await createCode("RABAT20", 20)
      const { cartId } = await prepareCart(12)
      for (const code of ["NIEMA", "rabat20"]) {
        const response = await applyCode(cartId, code)
        expect(response.status).toEqual(400)
        expect(response.data.message).toEqual(`The promotion code ${code} is invalid`)
      }
    })

    it("makes every new promotion tax inclusive: 20 zł is 20 zł gross", async () => {
      const promotionId = await createCode("RABAT20", 20)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "promotion",
        fields: ["is_tax_inclusive"],
        filters: { id: promotionId },
      })
      expect(data[0].is_tax_inclusive).toBe(true)
    })

    it("refuses an order the code took below the store minimum", async () => {
      await createCode("RABAT20", 20)
      // 9 × 12 = 108 zł, after the code 88 zł < 100 zł
      const { cartId } = await prepareCart(9)
      expect((await applyCode(cartId, "RABAT20")).data.cart.item_total).toEqual(88)

      const response = await complete(cartId)
      expect(response.status).toEqual(400)
      expect(response.data.message).toMatch(/Minimalna wartość zamówienia/)
    })

    describe("minimum cart value of a code", () => {
      it("is set in the Admin and applies only from that amount, before the discount", async () => {
        const promotionId = await createCode("WESELE30", 30)
        const admin = await adminHeaders()

        const set = await api.post(
          `/admin/catering/promotions/${promotionId}/min-order-value`,
          { min_order_value: 200 },
          { headers: admin }
        )
        expect(set.data).toEqual({ min_order_value: 200 })
        const { data: read } = await api.get(
          `/admin/catering/promotions/${promotionId}/min-order-value`,
          { headers: admin }
        )
        expect(read).toEqual({ min_order_value: 200 })

        // 144 zł < 200 zł
        const { cartId, lineId } = await prepareCart(12)
        // not an error: Medusa leaves the code out of the cart
        const below = await applyCode(cartId, "WESELE30")
        expect(below.status).toEqual(200)
        expect(below.data.cart.item_total).toEqual(144)
        expect(codesOf(below.data.cart)).toEqual([])

        // 204 zł ≥ 200 zł; after the code 174 zł — the minimum is checked before the discount
        await api.post(`/store/carts/${cartId}/line-items/${lineId}`, { quantity: 17 }, { headers })
        const above = await applyCode(cartId, "WESELE30")
        expect(above.status).toEqual(200)
        expect(above.data.cart.item_total).toEqual(174)
        expect(codesOf(above.data.cart)).toEqual(["WESELE30"])

        // back below: the code no longer applies
        const { data: reduced } = await api.post(
          `/store/carts/${cartId}/line-items/${lineId}`,
          { quantity: 12 },
          { headers }
        )
        expect(reduced.cart.item_total).toEqual(144)
        expect(codesOf(reduced.cart)).toEqual([])

        const cleared = await api.post(
          `/admin/catering/promotions/${promotionId}/min-order-value`,
          { min_order_value: null },
          { headers: admin }
        )
        expect(cleared.data).toEqual({ min_order_value: null })
        expect((await applyCode(cartId, "WESELE30")).data.cart.item_total).toEqual(114)
      })

      it("rejects an invalid amount and an unknown promotion", async () => {
        const admin = await adminHeaders()
        const promotionId = await createCode("WESELE30", 30)
        const invalid = await api
          .post(`/admin/catering/promotions/${promotionId}/min-order-value`, { min_order_value: -5 }, { headers: admin })
          .catch((e: ErrorResponse) => e.response)
        expect(invalid.status).toEqual(400)
        const missing = await api
          .get(`/admin/catering/promotions/promo_missing/min-order-value`, { headers: admin })
          .catch((e: ErrorResponse) => e.response)
        expect(missing.status).toEqual(404)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
