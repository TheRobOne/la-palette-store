import { test } from "node:test"
import assert from "node:assert/strict"
import { convertToLocale } from "../../src/lib/util/money"

test("formats a gross PLN amount using the Polish locale", () => {
  const formatted = convertToLocale({
    amount: 89,
    currency_code: "pln",
    locale: "pl-PL",
  })

  // Non-breaking space between amount and currency symbol, Polish grouping.
  assert.match(formatted.replace(/ /g, " "), /89,00\s*zł/)
})

test("falls back to the raw amount when no currency code is given", () => {
  assert.equal(
    convertToLocale({ amount: 5, currency_code: "" }),
    "5"
  )
})
