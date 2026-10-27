import {
  CateringDeliveryFulfillmentService,
  deliveryAmountFromContext,
} from "../service"

describe("deliveryAmountFromContext", () => {
  it("returns the amount computed by the pricing hook", () => {
    expect(deliveryAmountFromContext({ catering_delivery_amount: 30 })).toBe(30)
    expect(deliveryAmountFromContext({ catering_delivery_amount: 0 })).toBe(0)
  })

  it("falls back to 0 instead of throwing", () => {
    expect(deliveryAmountFromContext(undefined)).toBe(0)
    expect(deliveryAmountFromContext({})).toBe(0)
    expect(deliveryAmountFromContext({ catering_delivery_amount: "30" })).toBe(0)
    expect(deliveryAmountFromContext({ catering_delivery_amount: -5 })).toBe(0)
    expect(deliveryAmountFromContext({ catering_delivery_amount: NaN })).toBe(0)
  })
})

describe("CateringDeliveryFulfillmentService", () => {
  const service = new CateringDeliveryFulfillmentService()

  it("is a calculated, tax-inclusive option", async () => {
    expect(await service.canCalculate()).toBe(true)
    expect(
      await service.calculatePrice({}, {}, { catering_delivery_amount: 50 } as never)
    ).toEqual({ calculated_amount: 50, is_calculated_price_tax_inclusive: true })
  })

  it("offers one delivery option", async () => {
    expect(await service.getFulfillmentOptions()).toEqual([{ id: "delivery" }])
  })
})
