import { selectPickupReminders, warsawHour } from "../pickup-reminders"

// 2026-10-29 (Thursday) 09:00 Warsaw = 08:00 UTC (CET); tomorrow = 2026-10-30
const morning = new Date("2026-10-29T08:00:00.000Z")
const early = new Date("2026-10-29T06:30:00.000Z") // 07:30 Warsaw

const booking = (order_id: string, overrides = {}) => ({
  order_id,
  status: "active",
  date: "2026-10-30",
  start_time: "12:00",
  ...overrides,
})

// window 2026-10-30 12:00 Warsaw = 11:00 UTC
const placed = new Map<string, string>([
  ["old", "2026-10-20T10:00:00.000Z"],
  ["exactly24h", "2026-10-29T11:00:00.000Z"],
  ["fresh", "2026-10-29T11:01:00.000Z"],
])

describe("selectPickupReminders (unit)", () => {
  it("knows the Warsaw hour", () => {
    expect(warsawHour(morning)).toBe(9)
    expect(warsawHour(early)).toBe(7)
  })

  it("sends nothing before 08:00 Warsaw", () => {
    expect(selectPickupReminders([booking("old")], placed, early)).toEqual([])
  })

  it("reminds tomorrow's active orders placed at least 24 h before the window", () => {
    expect(
      selectPickupReminders([booking("old"), booking("exactly24h"), booking("fresh")], placed, morning)
    ).toEqual([
      { order_id: "old", date: "2026-10-30" },
      { order_id: "exactly24h", date: "2026-10-30" },
    ])
  })

  it("skips other days, cancelled bookings, requests without an order and unknown orders", () => {
    expect(
      selectPickupReminders(
        [
          booking("old", { date: "2026-10-31" }),
          booking("old", { status: "canceled" }),
          booking(null as never),
          booking("missing"),
        ],
        placed,
        morning
      )
    ).toEqual([])
  })
})
