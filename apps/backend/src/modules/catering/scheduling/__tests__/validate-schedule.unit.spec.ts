import { assertValidSchedule, type ScheduleInput } from "../validate-schedule"

const valid: ScheduleInput = {
  is_enabled: true,
  lead_time_hours: 48,
  booking_horizon_days: 60,
  daily_capacity: 10,
  windows: [
    { weekday: 6, start: "10:00", end: "11:00" },
    { weekday: 6, start: "11:00", end: "12:00" },
    { weekday: 7, start: "10:00", end: "11:00" },
  ],
}

describe("assertValidSchedule (unit, no database)", () => {
  it("accepts adjacent windows and an empty week", () => {
    expect(() => assertValidSchedule(valid)).not.toThrow()
    expect(() => assertValidSchedule({ ...valid, windows: [] })).not.toThrow()
  })

  it.each([
    [{ daily_capacity: -1 }, /Limit zamówień/],
    [{ daily_capacity: 1.5 }, /Limit zamówień/],
    [{ lead_time_hours: -1 }, /wyprzedzenie/],
    [{ booking_horizon_days: 0 }, /od 1 do 365/],
    [{ booking_horizon_days: 366 }, /od 1 do 365/],
  ])("rejects %j", (patch, message) => {
    expect(() => assertValidSchedule({ ...valid, ...patch })).toThrow(message)
  })

  it.each([
    [{ weekday: 0, start: "10:00", end: "11:00" }, /Dzień tygodnia/],
    [{ weekday: 2, start: "11:00", end: "10:00" }, /wcześniejsza/],
    [{ weekday: 2, start: "10:00", end: "10:00" }, /wcześniejsza/],
    [{ weekday: 2, start: "10:00", end: "24:00" }, /wcześniejsza/],
  ])("rejects window %j", (window, message) => {
    expect(() => assertValidSchedule({ ...valid, windows: [window] })).toThrow(message)
  })

  it("rejects overlapping and duplicate windows on the same day", () => {
    expect(() =>
      assertValidSchedule({
        ...valid,
        windows: [...valid.windows, { weekday: 6, start: "11:30", end: "12:30" }],
      })
    ).toThrow("Okna 11:00–12:00 i 11:30–12:30 (sob.) nachodzą na siebie.")
    expect(() =>
      assertValidSchedule({
        ...valid,
        windows: [...valid.windows, { weekday: 7, start: "10:00", end: "11:00" }],
      })
    ).toThrow(/nachodzą na siebie/)
  })
})

describe("assertValidSchedule — on-request fields (spec 005)", () => {
  it("accepts valid values and omitted fields", () => {
    expect(() =>
      assertValidSchedule({
        ...valid,
        request_lead_time_hours: 72,
        request_response_hours: 24,
        request_payment_hours: 168,
        windows: [{ weekday: 1, start: "10:00", end: "11:00", requires_confirmation: true }],
      })
    ).not.toThrow()
  })

  it.each([
    [{ request_lead_time_hours: -1 }, /Wyprzedzenie zapytań/],
    [{ request_response_hours: 0 }, /Czas na odpowiedź musi wynosić od 1 do 168/],
    [{ request_response_hours: 169 }, /Czas na odpowiedź/],
    [{ request_payment_hours: 0 }, /Czas na płatność/],
    [{ request_payment_hours: 1.5 }, /Czas na płatność/],
  ])("rejects %j", (patch, message) => {
    expect(() => assertValidSchedule({ ...valid, ...patch })).toThrow(message)
  })
})

describe("assertValidSchedule — per-window limit (spec 007)", () => {
  it("accepts a limit ≥ 1 or null for delivery, null or omitted for pickup", () => {
    expect(() => assertValidSchedule({ ...valid, max_orders_per_window: 2 }, "delivery")).not.toThrow()
    expect(() => assertValidSchedule({ ...valid, max_orders_per_window: null }, "delivery")).not.toThrow()
    expect(() => assertValidSchedule({ ...valid, max_orders_per_window: null }, "pickup")).not.toThrow()
    expect(() => assertValidSchedule(valid, "pickup")).not.toThrow()
  })

  it.each([0, -1, 1.5])("rejects %p for delivery", (value) => {
    expect(() => assertValidSchedule({ ...valid, max_orders_per_window: value }, "delivery")).toThrow(
      /Maks\. dostaw w jednym oknie/
    )
  })

  it("refuses a limit for pickup", () => {
    expect(() => assertValidSchedule({ ...valid, max_orders_per_window: 2 }, "pickup")).toThrow(
      "Limit zamówień w jednym oknie dotyczy tylko dostaw."
    )
  })
})
