import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import seed from "../../src/scripts/seed"

// contracts/http-api.md: GET /store/products (gross PLN price) +
// GET /store/catering-info (catering attributes for those products).
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("GET /store/products + GET /store/catering-info", () => {
      it("returns seeded products with gross PLN prices and matching catering info", async () => {
        const container = getContainer()
        process.env.APP_ENV = "local"
        await seed({ container } as never)

        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data: apiKeys } = await query.graph({
          entity: "api_key",
          fields: ["token"],
          filters: { title: "Storefront" },
        })
        const publishableKey = apiKeys[0].token

        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id"],
          filters: { name: "Polska" },
        })

        const productsResponse = await api.get(
          `/store/products?fields=id,title,handle,thumbnail,*variants.calculated_price&region_id=${regions[0].id}&limit=24`,
          { headers: { "x-publishable-api-key": publishableKey } }
        )

        expect(productsResponse.status).toEqual(200)
        const products = productsResponse.data.products
        expect(products.length).toBeGreaterThanOrEqual(6)

        for (const product of products) {
          expect(product.title).toBeTruthy()
          expect(product.handle).toBeTruthy()
          expect(product.thumbnail).toBeTruthy()

          const price = product.variants[0].calculated_price
          expect(price.currency_code).toEqual("pln")
          expect(price.calculated_amount).toBeGreaterThan(0)
        }

        const productIds = products.map((p: { id: string }) => p.id)
        const cateringResponse = await api.get(
          `/store/catering-info?${productIds
            .map((id: string) => `product_id=${id}`)
            .join("&")}`,
          { headers: { "x-publishable-api-key": publishableKey } }
        )

        expect(cateringResponse.status).toEqual(200)
        const cateringInfoById = cateringResponse.data.catering_info
        for (const id of productIds) {
          expect(cateringInfoById[id]).toEqual(
            expect.objectContaining({
              min_quantity: expect.any(Number),
              pricing_unit: expect.any(String),
              ingredients: expect.any(String),
              allergens: expect.any(Array),
            })
          )
        }
      })
    })
  },
})

jest.setTimeout(300 * 1000)
