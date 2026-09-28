import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import seed from "../../src/scripts/seed"

// spec US1 scenario 3 / FR-004: the seed is idempotent — running it twice
// must not create duplicate regions, sales channels, categories or products.
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("seed idempotency", () => {
      it("creates the same entities on a second run", async () => {
        const container = getContainer()
        process.env.APP_ENV = "local"

        await seed({ container } as never)
        await seed({ container } as never)

        const query = container.resolve(ContainerRegistrationKeys.QUERY)

        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id"],
          filters: { name: "Polska" },
        })
        expect(regions).toHaveLength(1)

        const { data: salesChannels } = await query.graph({
          entity: "sales_channel",
          fields: ["id"],
          filters: { name: "Sklep internetowy" },
        })
        expect(salesChannels).toHaveLength(1)

        const { data: categories } = await query.graph({
          entity: "product_category",
          fields: ["id", "handle"],
        })
        expect(categories.filter((c) => c.handle === "finger-food")).toHaveLength(1)
        expect(categories.filter((c) => c.handle === "desery")).toHaveLength(1)

        const { data: products } = await query.graph({
          entity: "product",
          fields: ["id", "handle"],
        })
        const testProducts = products.filter((p) =>
          p.handle?.startsWith("test-")
        )
        expect(testProducts.length).toBeGreaterThanOrEqual(6)
        // still exactly one of each handle after the second run
        const handles = testProducts.map((p) => p.handle)
        expect(new Set(handles).size).toEqual(handles.length)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
