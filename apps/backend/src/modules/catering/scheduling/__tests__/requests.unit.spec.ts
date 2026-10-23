import {
  buildSnapshot,
  canConfirm,
  canDecline,
  canPay,
  paymentTimeOverError,
  requiresConfirmationError,
  responseDeadline,
  selectExpired,
  snapshotMatches,
  snapshotMismatchError,
  notOnRequestError,
} from "../requests"
import { warsawWallClockToInstant } from "../time"

const NOW = new Date("2026-10-20T08:00:00Z")
const H = 3_600_000
const term = { method: "pickup" as const, date: "2026-10-26", start: "10:00", end: "11:00" }

describe("deadlines (unit, no database)", () => {
  it("is now + hours when the window is far away", () => {
    const start = warsawWallClockToInstant("2026-10-26", "10:00")
    expect(responseDeadline(NOW, 24, start).toISOString()).toEqual("2026-10-21T08:00:00.000Z")
  })

  it("is capped at the window start", () => {
    // fall-back day: Sunday 2026-10-25 10:00 CET = 09:00Z
    const start = warsawWallClockToInstant("2026-10-25", "10:00")
    const now = new Date("2026-10-24T20:00:00Z")
    expect(responseDeadline(now, 24, start).toISOString()).toEqual("2026-10-25T09:00:00.000Z")
  })
})

describe("state transitions", () => {
  const past = new Date(NOW.getTime() - H)
  const future = new Date(NOW.getTime() + H)

  it.each([
    ["requested", future, true],
    ["requested", past, false],
    ["requested", NOW, true], // exactly at the deadline is still in time
    ["confirmed", future, false],
    ["declined", future, false],
  ] as const)("canConfirm(%s, deadline %s) = %s", (status, response_deadline, expected) => {
    expect(canConfirm({ status, response_deadline }, NOW)).toBe(expected)
  })

  it.each([
    ["requested", true],
    ["confirmed", true],
    ["active", false],
    ["declined", false],
    ["expired", false],
    ["canceled", false],
  ] as const)("canDecline(%s) = %s", (status, expected) => {
    expect(canDecline({ status })).toBe(expected)
  })

  it.each([
    ["confirmed", future, true],
    ["confirmed", past, false],
    ["requested", future, false],
    ["active", future, false],
    ["expired", future, false],
  ] as const)("canPay(%s, deadline %s) = %s", (status, payment_deadline, expected) => {
    expect(canPay({ status, payment_deadline }, NOW)).toBe(expected)
  })
})

describe("selectExpired", () => {
  it("expires unanswered and cancels unpaid requests past their deadline only", () => {
    const past = new Date(NOW.getTime() - 1)
    const future = new Date(NOW.getTime() + H)
    expect(
      selectExpired(
        [
          { id: "a", status: "requested", response_deadline: past },
          { id: "b", status: "requested", response_deadline: future },
          { id: "c", status: "requested", response_deadline: NOW },
          { id: "d", status: "confirmed", payment_deadline: past },
          { id: "e", status: "confirmed", payment_deadline: future },
          { id: "f", status: "active", payment_deadline: past },
        ],
        NOW
      )
    ).toEqual({ expire: ["a"], cancel: ["d"] })
  })
})

describe("snapshot", () => {
  const cart = {
    items: [
      { variant_id: "v2", quantity: 12 },
      { variant_id: "v1", quantity: 20 },
    ],
  }

  it("matches regardless of item order and merges duplicate variants", () => {
    const snapshot = buildSnapshot(cart, term)
    expect(snapshot.items).toEqual([
      { variant_id: "v1", quantity: 20 },
      { variant_id: "v2", quantity: 12 },
    ])
    expect(snapshotMatches(snapshot, { items: [...cart.items].reverse() }, term)).toBe(true)
    expect(
      snapshotMatches(
        snapshot,
        { items: [{ variant_id: "v1", quantity: 10 }, { variant_id: "v1", quantity: 10 }, { variant_id: "v2", quantity: 12 }] },
        term
      )
    ).toBe(true)
  })

  it.each([
    ["changed quantity", { items: [{ variant_id: "v1", quantity: 21 }, { variant_id: "v2", quantity: 12 }] }, term],
    ["extra item", { items: [...cart.items, { variant_id: "v3", quantity: 1 }] }, term],
    ["changed term", cart, { ...term, start: "11:00", end: "12:00" }],
  ])("does not match on %s", (_, changedCart, changedTerm) => {
    expect(snapshotMatches(buildSnapshot(cart, term), changedCart, changedTerm)).toBe(false)
  })

  it("matches a snapshot read back from jsonb (keys reordered)", () => {
    // Postgres jsonb returns keys in its own order, not insertion order
    const fromDb = JSON.parse(
      '{"term":{"end":"11:00","date":"2026-10-26","start":"10:00","method":"pickup"},' +
        '"items":[{"quantity":12,"variant_id":"v2"},{"quantity":20,"variant_id":"v1"}]}'
    )
    expect(snapshotMatches(fromDb, cart, term)).toBe(true)
  })

  it("does not match without a snapshot", () => {
    expect(snapshotMatches(null, cart, term)).toBe(false)
  })
})

describe("messages", () => {
  it("uses the contract texts as invalid_data", () => {
    expect(notOnRequestError()).toMatchObject({
      type: "invalid_data",
      message: "Ten termin nie wymaga potwierdzenia — złóż zwykłe zamówienie.",
    })
    expect(requiresConfirmationError().message).toEqual(
      "Ten termin wymaga potwierdzenia kuchni — wyślij zapytanie."
    )
    expect(paymentTimeOverError().message).toEqual("Czas na płatność za to zamówienie minął.")
    expect(snapshotMismatchError().message).toEqual(
      "Zamówienie różni się od wysłanego zapytania — skontaktuj się z nami."
    )
  })
})
