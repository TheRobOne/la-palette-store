import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import seed from "../../src/scripts/seed"

// contracts/http-api.md: GET /store/products with catering_info + gross PLN price.
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("GET /store/products", () => {
      it("returns seeded products with catering info and gross PLN prices", async () => {
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

        const response = await api.get(
          `/store/products?fields=id,title,handle,thumbnail,*variants.calculated_price,+catering_info.*&region_id=${regions[0].id}&limit=24`,
          { headers: { "x-publishable-api-key": publishableKey } }
        )

        expect(response.status).toEqual(200)
        const products = response.data.products
        expect(products.length).toBeGreaterThanOrEqual(6)

        for (const product of products) {
          expect(product.title).toBeTruthy()
          expect(product.handle).toBeTruthy()
          expect(product.thumbnail).toBeTruthy()

          const price = product.variants[0].calculated_price
          expect(price.currency_code).toEqual("pln")
          expect(price.calculated_amount).toBeGreaterThan(0)

          expect(product.catering_info).toEqual(
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

jest.setTimeout(120 * 1000)
