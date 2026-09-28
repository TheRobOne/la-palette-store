import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

// contracts/http-api.md: GET /status reports database health.
medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    describe("GET /status", () => {
      it("returns 200 with an ok database check", async () => {
        const response = await api.get("/status")

        expect(response.status).toEqual(200)
        expect(response.data).toEqual(
          expect.objectContaining({
            status: "ok",
            checks: { database: "ok" },
          })
        )
      })
    })
  },
})

jest.setTimeout(60 * 1000)
