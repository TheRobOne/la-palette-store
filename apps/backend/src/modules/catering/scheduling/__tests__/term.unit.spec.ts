import {
  formatTerm,
  lockBusyError,
  missingTermError,
  parseTerm,
  unavailableTermError,
} from "../term"

const valid = { method: "pickup", date: "2026-10-20", start: "11:00", end: "12:00" }

describe("parseTerm (unit, no database)", () => {
  it("reads a valid term", () => {
    expect(parseTerm({ catering_term: valid, invoice_requested: true })).toEqual(valid)
  })

  it.each([
    ["missing metadata", null],
    ["missing key", { other: 1 }],
    ["string instead of object", { catering_term: "2026-10-20" }],
    ["array", { catering_term: [valid] }],
    ["unknown method", { catering_term: { ...valid, method: "delivery" } }],
    ["impossible date", { catering_term: { ...valid, date: "2026-02-30" } }],
    ["invalid time", { catering_term: { ...valid, end: "24:00" } }],
    ["start equal to end", { catering_term: { ...valid, end: "11:00" } }],
    ["start after end", { catering_term: { ...valid, start: "13:00" } }],
  ])("returns null for %s", (_, metadata) => {
    expect(parseTerm(metadata as Record<string, unknown> | null)).toBeNull()
  })
})

describe("messages", () => {
  it("formats the term with a Polish date and an en dash", () => {
    expect(formatTerm(valid)).toEqual("20.10.2026, 11:00–12:00")
  })

  it("uses the contract's texts and invalid_data", () => {
    expect(missingTermError()).toMatchObject({
      type: "invalid_data",
      message: "Wybierz termin odbioru.",
    })
    expect(unavailableTermError(valid as never)).toMatchObject({
      type: "invalid_data",
      message:
        "Wybrany termin odbioru (20.10.2026, 11:00–12:00) nie jest już dostępny. Wybierz inny termin.",
    })
    expect(lockBusyError().message).toEqual(
      "Nie udało się zarezerwować terminu. Spróbuj ponownie za chwilę."
    )
  })
})
