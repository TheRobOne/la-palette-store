import {
  assertDeliveryAddress,
  assertDeliveryAmount,
  assertDeliveryQuote,
  assertMethodMatchesOption,
} from "../delivery-checks"
import { quoteDelivery } from "../../modules/catering/delivery/quote"

const zones = [{ id: "dzone_1", name: "Strefa 1", price: 30, min_order_value: 200, codes: ["31-762"] }]
const quote = (postalCode: string, confirmedCost: number | null = null) =>
  quoteDelivery({ postalCode, itemTotal: 0, zones, freeThreshold: null, globalMinimum: 100, confirmedCost })

describe("delivery checks (unit, no database)", () => {
  it("requires the term method to match the shipping option", () => {
    expect(() => assertMethodMatchesOption("delivery", "delivery")).not.toThrow()
    expect(() => assertMethodMatchesOption("pickup", "delivery")).toThrow(
      "Wybierz ponownie sposób odbioru lub dostawy."
    )
    expect(() => assertMethodMatchesOption("delivery", undefined)).toThrow()
  })

  it("names every missing address field", () => {
    expect(() =>
      assertDeliveryAddress({ address_1: "ul. X 1", postal_code: "31-762", city: "Kraków", phone: " " })
    ).toThrow("Uzupełnij adres dostawy: telefon.")
    expect(() => assertDeliveryAddress(null)).toThrow(
      "Uzupełnij adres dostawy: ulica i numer, kod pocztowy, miejscowość, telefon."
    )
  })

  it("refuses an invalid code and an order below the zone minimum", () => {
    expect(() => assertDeliveryQuote(quote("31762"), 500)).toThrow("Podaj poprawny kod pocztowy (XX-XXX).")
    expect(() => assertDeliveryQuote(quote("31-762"), 150)).toThrow(
      "Minimalna wartość zamówienia z dostawą pod ten adres to 200,00 zł. Dodaj produkty za co najmniej 50,00 zł."
    )
    expect(() => assertDeliveryQuote(quote("31-762"), 200)).not.toThrow()
  })

  it("requires the shipping method to carry the quoted amount", () => {
    expect(() => assertDeliveryAmount(30, quote("31-762"))).not.toThrow()
    expect(() => assertDeliveryAmount(50, quote("31-762"))).toThrow(
      "Koszt dostawy się zmienił — sprawdź koszyk i spróbuj ponownie."
    )
    expect(() => assertDeliveryAmount(0, quote("34-500"))).not.toThrow()
    expect(() => assertDeliveryAmount(80, quote("34-500", 80))).not.toThrow()
    expect(() => assertDeliveryAmount(0, quote("34-500", 80))).toThrow()
  })
})
