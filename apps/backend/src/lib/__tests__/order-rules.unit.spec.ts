import { MedusaError } from "@medusajs/framework/utils"
import {
  assertMinOrderValue,
  DEFAULT_MIN_ORDER_VALUE,
  formatPln,
  MIN_ORDER_VALUE_METADATA_KEY,
  minOrderValueFromMetadata,
} from "../order-rules"

describe("minOrderValueFromMetadata (unit, no database)", () => {
  it.each([
    [{ [MIN_ORDER_VALUE_METADATA_KEY]: 150 }, 150],
    [{ [MIN_ORDER_VALUE_METADATA_KEY]: "150" }, 150],
    [{ [MIN_ORDER_VALUE_METADATA_KEY]: "99,50" }, 99.5],
    [{ [MIN_ORDER_VALUE_METADATA_KEY]: 0 }, 0],
  ])("reads %j as %d", (metadata, expected) => {
    expect(minOrderValueFromMetadata(metadata)).toEqual(expected)
  })

  it.each([
    null,
    undefined,
    {},
    { [MIN_ORDER_VALUE_METADATA_KEY]: "" },
    { [MIN_ORDER_VALUE_METADATA_KEY]: "abc" },
    { [MIN_ORDER_VALUE_METADATA_KEY]: -10 },
    { [MIN_ORDER_VALUE_METADATA_KEY]: true },
  ])("falls back to the default for %j", (metadata) => {
    expect(minOrderValueFromMetadata(metadata)).toEqual(DEFAULT_MIN_ORDER_VALUE)
  })
})

describe("formatPln", () => {
  it("formats with a comma and two decimals", () => {
    expect(formatPln(100)).toEqual("100,00 zł")
    expect(formatPln(12.5)).toEqual("12,50 zł")
  })
})

describe("assertMinOrderValue", () => {
  it("accepts a total equal to or above the minimum", () => {
    expect(() => assertMinOrderValue(100, 100)).not.toThrow()
    expect(() => assertMinOrderValue(144, 100)).not.toThrow()
    expect(() => assertMinOrderValue("100", 100)).not.toThrow()
  })

  it("rejects a total below the minimum with the missing amount", () => {
    expect.assertions(2)
    try {
      assertMinOrderValue(88, 100)
    } catch (e) {
      expect((e as MedusaError).type).toEqual(MedusaError.Types.INVALID_DATA)
      expect((e as MedusaError).message).toEqual(
        "Minimalna wartość zamówienia to 100,00 zł. Dodaj produkty za co najmniej 12,00 zł."
      )
    }
  })

  it("treats a missing total as zero", () => {
    expect(() => assertMinOrderValue(undefined, 100)).toThrow(
      "Dodaj produkty za co najmniej 100,00 zł."
    )
  })

  it("never rejects when the minimum is zero", () => {
    expect(() => assertMinOrderValue(0, 0)).not.toThrow()
  })
})
