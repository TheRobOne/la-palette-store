import { validateZoneInput } from "../zone-input"

const zones = [
  { id: "dzone_1", name: "Strefa 1", codes: ["31-762", "31-763"] },
  { id: "dzone_2", name: "Strefa 2", codes: ["30-001"] },
]

describe("validateZoneInput (unit, no database)", () => {
  it("cleans, dedupes and sorts the codes", () => {
    expect(
      validateZoneInput({ name: "Strefa 3", postal_codes: [" 31-871 ", "31-870", "31-871", ""] }, zones)
    ).toEqual({ ok: true, codes: ["31-870", "31-871"] })
  })

  it("lets a zone keep its own codes and name", () => {
    expect(
      validateZoneInput({ id: "dzone_1", name: "Strefa 1", postal_codes: ["31-762"] }, zones)
    ).toEqual({ ok: true, codes: ["31-762"] })
  })

  it.each([
    [{ name: "strefa 1 ", postal_codes: ["31-870"] }, "Strefa o nazwie „strefa 1” już istnieje."],
    [{ name: "Strefa 3", postal_codes: ["31-7", "3187", "31-7"] }, "Nieprawidłowe kody pocztowe: 31-7, 3187. Użyj formatu XX-XXX."],
    [{ name: "Strefa 3", postal_codes: [" "] }, "Podaj co najmniej jeden kod pocztowy."],
    [{ name: "Strefa 3", postal_codes: ["31-762"] }, "Kod 31-762 jest już w strefie „Strefa 1”."],
    [
      { name: "Strefa 3", postal_codes: ["31-762", "31-763", "30-001"] },
      "Kody 31-762, 31-763 są już w strefie „Strefa 1”. Kod 30-001 jest już w strefie „Strefa 2”.",
    ],
  ])("refuses %j", (input, message) => {
    expect(validateZoneInput(input, zones)).toEqual({ ok: false, message })
  })
})
