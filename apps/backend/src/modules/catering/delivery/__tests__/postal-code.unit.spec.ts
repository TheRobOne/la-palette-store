import { isValidPostalCode, parsePostalCode, parsePostalCodeList } from "../postal-code"

describe("parsePostalCode", () => {
  it("accepts full XX-XXX codes, trimmed", () => {
    expect(parsePostalCode("31-870")).toBe("31-870")
    expect(parsePostalCode(" 31-870 ")).toBe("31-870")
  })

  it("rejects partial or unformatted codes", () => {
    for (const value of ["31870", "31 870", "31-7", "3187", "31-8700", "ab-cde", "", null, 31870]) {
      expect(isValidPostalCode(value)).toBe(false)
    }
  })
})

describe("parsePostalCodeList", () => {
  it("splits on commas, spaces, semicolons and new lines and dedupes", () => {
    expect(parsePostalCodeList("31-870, 31-871\n31-872;31-870  32-005")).toEqual({
      valid: ["31-870", "31-871", "31-872", "32-005"],
      invalid: [],
    })
  })

  it("returns invalid entries as typed", () => {
    expect(parsePostalCodeList("31-870, 31-7, 3187, 31-7")).toEqual({
      valid: ["31-870"],
      invalid: ["31-7", "3187"],
    })
  })
})
