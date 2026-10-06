import { MedusaError } from "@medusajs/framework/utils"
import { assertInvoiceData, isInvoiceRequested } from "../invoice"

const companyAddress = {
  company: "La Palette Sp. z o.o.",
  address_1: "ul. Gustawa Morcinka 40",
  postal_code: "31-762",
  city: "Kraków",
  country_code: "pl",
}

const invoiceCart = (overrides: {
  nip?: unknown
  billing_address?: Partial<typeof companyAddress> | null
}) => ({
  metadata: {
    invoice_requested: true,
    invoice_nip: "nip" in overrides ? overrides.nip : "123-456-32-18",
  },
  billing_address:
    overrides.billing_address === null
      ? null
      : { ...companyAddress, ...overrides.billing_address },
})

const messageOf = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    expect((e as MedusaError).type).toEqual(MedusaError.Types.INVALID_DATA)
    return (e as MedusaError).message
  }
  return null
}

describe("isInvoiceRequested (unit, no database)", () => {
  it.each([
    [{ invoice_requested: true }, true],
    [{ invoice_requested: false }, false],
    [{ invoice_requested: "true" }, false],
    [{}, false],
    [null, false],
  ])("%j → %s", (metadata, expected) => {
    expect(isInvoiceRequested(metadata)).toBe(expected)
  })
})

describe("assertInvoiceData", () => {
  it("does nothing when no invoice is requested, even without data", () => {
    expect(() =>
      assertInvoiceData({ metadata: { invoice_nip: "bad" }, billing_address: null })
    ).not.toThrow()
  })

  it("accepts a valid NIP with complete company data", () => {
    expect(() => assertInvoiceData(invoiceCart({}))).not.toThrow()
  })

  it.each([["1234563219"], [""], [undefined], [1234563218]])(
    "rejects NIP %p",
    (nip) => {
      expect(messageOf(() => assertInvoiceData(invoiceCart({ nip })))).toEqual(
        "Podany NIP jest nieprawidłowy. Sprawdź numer i spróbuj ponownie."
      )
    }
  )

  it("lists every missing company field", () => {
    expect(
      messageOf(() =>
        assertInvoiceData(
          invoiceCart({ billing_address: { company: " ", city: "", postal_code: null as never } })
        )
      )
    ).toEqual("Uzupełnij dane do faktury: nazwa firmy, kod pocztowy, miejscowość.")
  })

  it("rejects a missing billing address", () => {
    expect(
      messageOf(() => assertInvoiceData(invoiceCart({ billing_address: null })))
    ).toEqual(
      "Uzupełnij dane do faktury: nazwa firmy, ulica i numer, kod pocztowy, miejscowość."
    )
  })
})
