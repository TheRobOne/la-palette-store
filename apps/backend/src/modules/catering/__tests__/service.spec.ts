import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CATERING_MODULE } from "../index"
import CateringModuleService from "../service"

// data-model.md Validation: min_quantity must be a multiple of quantity_step,
// enforced by the module service (not just the pure helper in validate.unit.spec.ts).
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("catering module service", () => {
      it("stores valid catering info", async () => {
        const service: CateringModuleService = getContainer().resolve(
          CATERING_MODULE
        )

        const created = await service.createCateringProductInfos({
          min_quantity: 20,
          quantity_step: 10,
          pricing_unit: "piece",
          ingredients: "Test ingredients",
          allergens: ["gluten"],
          dietary_tags: [],
        })

        expect(created.min_quantity).toEqual(20)
        expect(created.quantity_step).toEqual(10)
      })

      it("rejects a min_quantity that is not a multiple of quantity_step", async () => {
        const service: CateringModuleService = getContainer().resolve(
          CATERING_MODULE
        )

        await expect(
          service.createCateringProductInfos({
            min_quantity: 7,
            quantity_step: 5,
            pricing_unit: "piece",
            ingredients: "Test ingredients",
            allergens: [],
            dietary_tags: [],
          })
        ).rejects.toThrow(/multiple of quantity_step/)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
