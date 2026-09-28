import { assertQuantityRule } from "../service"

describe("catering assertQuantityRule (unit, no database)", () => {
  it("accepts a min_quantity that is a multiple of quantity_step", () => {
    expect(() =>
      assertQuantityRule({ min_quantity: 20, quantity_step: 10 })
    ).not.toThrow()
  })

  it("accepts defaults when neither value is provided", () => {
    expect(() => assertQuantityRule({})).not.toThrow()
  })

  it("rejects a min_quantity that is not a multiple of quantity_step", () => {
    expect(() =>
      assertQuantityRule({ min_quantity: 7, quantity_step: 5 })
    ).toThrow(/multiple of quantity_step/)
  })

  it("rejects a quantity_step below 1", () => {
    expect(() =>
      assertQuantityRule({ min_quantity: 1, quantity_step: 0 })
    ).toThrow()
  })
})
