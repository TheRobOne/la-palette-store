import { formatNip, isValidNip, normalizeNip } from "../nip"

// Checksum: digits 1–9 × weights 6,5,7,2,3,4,5,6,7, sum mod 11 = digit 10.
const VALID = [
  "1234563218", // 118 mod 11 = 8
  "5260250274", // Ministerstwo Finansów — 169 mod 11 = 4
  "6783188631", // La Palette Garden (polityka prywatności) — 265 mod 11 = 1
]

describe("isValidNip (unit, no database)", () => {
  it.each(VALID)("accepts %s", (nip) => {
    expect(isValidNip(nip)).toBe(true)
  })

  it.each([
    ["123-456-32-18", "dashes"],
    ["123 456 32 18", "spaces"],
    ["PL1234563218", "EU VAT prefix"],
    ["pl 123-456-32-18", "lower-case prefix with formatting"],
  ])("accepts %s (%s)", (nip) => {
    expect(isValidNip(nip)).toBe(true)
  })

  it.each([
    ["1234563219", "wrong check digit"],
    ["123456321", "9 digits"],
    ["12345632180", "11 digits"],
    ["12345a3218", "letter inside"],
    ["0000000000", "all zeros (passes the checksum)"],
    ["", "empty"],
    ["DE1234563218", "foreign prefix"],
  ])("rejects %s (%s)", (nip) => {
    expect(isValidNip(nip)).toBe(false)
  })

  it.each([null, undefined, 1234563218 as unknown as string])(
    "rejects non-string %p",
    (nip) => {
      expect(isValidNip(nip)).toBe(false)
    }
  )
})

describe("normalizeNip / formatNip", () => {
  it("strips formatting and the PL prefix", () => {
    expect(normalizeNip(" PL 123-456.32 18 ")).toEqual("1234563218")
  })

  it("formats as XXX-XXX-XX-XX", () => {
    expect(formatNip("PL1234563218")).toEqual("123-456-32-18")
  })

  it("leaves unparseable input untouched", () => {
    expect(formatNip("abc")).toEqual("abc")
  })
})
