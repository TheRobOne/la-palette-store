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
