import { discountOf } from "../discount"
import { promotionMinOrderValue } from "../promotion-min-order-value"

describe("discountOf (unit, discount codes)", () => {
  it("returns null without a discount", () => {
    expect(discountOf(null)).toBeNull()
    expect(discountOf({ item_total: 144, original_item_total: 144 })).toBeNull()
  })

  it("takes the amounts from the totals and the codes from the adjustments", () => {
    expect(
      discountOf({
        item_total: 124,
        original_item_total: 144,
        shipping_total: 10,
        original_shipping_total: 30,
        items: [
          { adjustments: [{ code: "WESELE20" }] },
          { adjustments: [{ code: "WESELE20" }, { code: null }] },
        ],
        shipping_methods: [{ adjustments: [{ code: "DOSTAWA" }] }],
      })
    ).toEqual({ codes: ["DOSTAWA", "WESELE20"], items_amount: 20, shipping_amount: 20 })
  })

  it("rounds to grosze and ignores missing totals", () => {
    expect(discountOf({ item_total: 89.9, original_item_total: 99.99 })).toEqual({
      codes: [],
      items_amount: 10.09,
      shipping_amount: 0,
    })
    expect(discountOf({ item_total: 89.9 })).toBeNull()
  })
})

describe("promotionMinOrderValue (unit, discount codes)", () => {
  it("reads the gte rule on original_item_total", () => {
    expect(
      promotionMinOrderValue([
        { attribute: "currency_code", operator: "eq", values: [{ value: "pln" }] },
        { attribute: "original_item_total", operator: "gte", values: [{ value: "300" }] },
      ])
    ).toBe(300)
    expect(promotionMinOrderValue([])).toBeNull()
    expect(promotionMinOrderValue(undefined)).toBeNull()
  })
})
