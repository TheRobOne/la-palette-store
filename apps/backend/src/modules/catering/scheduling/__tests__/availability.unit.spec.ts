import {
  checkTerm,
  computeAvailability,
  termRequiresConfirmation,
  windowKey,
  type ScheduleInputs,
} from "../availability"

// Default schedule: Tuesday–Sunday, hourly windows 10:00–18:00.
const DEFAULT_WINDOWS = [2, 3, 4, 5, 6, 7].flatMap((weekday) =>
  [10, 11, 12, 13, 14, 15, 16, 17].map((h) => ({
    weekday,
    start_time: `${h}:00`,
    end_time: `${h + 1}:00`,
  }))
)

// Tuesday 2026-10-20 09:00 Warsaw (CEST) = 07:00Z
const NOW = new Date("2026-10-20T07:00:00Z")

const inputs = (overrides: Partial<ScheduleInputs> = {}): ScheduleInputs => ({
  now: NOW,
  method: "pickup",
  schedule: { is_enabled: true, lead_time_hours: 48, booking_horizon_days: 60 },
  windows: DEFAULT_WINDOWS,
  blockedDates: [],
  bookingsPerDate: {},
  dailyCapacity: 10,
  ...overrides,
})

const day = (date: string, overrides: Partial<ScheduleInputs> = {}) =>
  computeAvailability({ ...inputs(overrides), from: date, to: date })[0]

describe("computeAvailability (unit, no database)", () => {
  it("returns every date of the range in order", () => {
    const days = computeAvailability({ ...inputs(), from: "2026-10-20", to: "2026-10-26" })
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ])
  })

  it("marks Monday closed with no windows", () => {
    expect(day("2026-10-26")).toEqual({
      date: "2026-10-26",
      available: false,
      reason: "closed",
      windows: [],
    })
  })

  it("marks days inside the lead time but lists their windows", () => {
    const wednesday = day("2026-10-21")
    expect(wednesday.reason).toEqual("lead_time")
    expect(wednesday.windows).toHaveLength(8)
    expect(wednesday.windows.every((w) => !w.available)).toBe(true)
  })

  it("measures the lead time to the window start", () => {
    // Thursday 10:00 CEST = 08:00Z; 48 h earlier = Tuesday 08:00Z
    const at = (iso: string) => day("2026-10-22", { now: new Date(iso) }).windows[0]
    expect(at("2026-10-20T07:59:00Z").available).toBe(true)
    expect(at("2026-10-20T08:00:00Z").available).toBe(true)
    expect(at("2026-10-20T08:01:00Z").available).toBe(false)
    // the next window is still available
    expect(day("2026-10-22", { now: new Date("2026-10-20T08:01:00Z") }).available).toBe(true)
  })

  it("marks past dates", () => {
    expect(day("2026-10-19").reason).toEqual("past")
  })

  it("offers today + horizon but not the day after", () => {
    expect(day("2026-12-19").available).toBe(true) // +60 days, Saturday
    expect(day("2026-12-20").reason).toEqual("beyond_horizon")
  })

  it.each([null, "pickup"])("blocks a date blocked for method %p", (method) => {
    expect(
      day("2026-10-23", { blockedDates: [{ date: "2026-10-23", fulfillment_method: method }] })
        .reason
    ).toEqual("blocked")
  })

  it("ignores a block for another method", () => {
    expect(
      day("2026-10-23", {
        blockedDates: [{ date: "2026-10-23", fulfillment_method: "delivery" }],
      }).available
    ).toBe(true)
  })

  it("marks a full day but keeps its windows listed as unavailable", () => {
    const full = day("2026-10-23", { bookingsPerDate: { "2026-10-23": 10 } })
    expect(full.reason).toEqual("full")
    expect(full.windows).toHaveLength(8)
    expect(full.windows.every((w) => !w.available)).toBe(true)
    expect(day("2026-10-23", { bookingsPerDate: { "2026-10-23": 9 } }).available).toBe(true)
  })

  it("treats capacity 0 as no orders accepted", () => {
    expect(day("2026-10-23", { dailyCapacity: 0 }).reason).toEqual("full")
  })

  it.each([
    [null],
    [{ is_enabled: false, lead_time_hours: 48, booking_horizon_days: 60 }],
  ])("marks every day disabled without an enabled schedule (%p)", (schedule) => {
    expect(day("2026-10-23", { schedule }).reason).toEqual("disabled")
  })

  it("lists the same 8 windows on the fall-back Sunday 2026-10-25", () => {
    const sunday = day("2026-10-25")
    expect(sunday.windows.map((w) => w.start)).toEqual([
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ])
    expect(sunday.available).toBe(true)
  })
})

describe("checkTerm", () => {
  const term = { date: "2026-10-23", start: "11:00", end: "12:00" }

  it("accepts an available term", () => {
    expect(checkTerm(term, inputs())).toEqual([])
  })

  it("rejects a window that does not match a rule exactly", () => {
    expect(checkTerm({ ...term, end: "12:30" }, inputs())).toEqual(["closed"])
    expect(checkTerm({ ...term, date: "2026-10-26" }, inputs())).toEqual(["closed"])
  })

  it("collects every broken rule in order", () => {
    expect(
      checkTerm(
        { date: "2026-10-21", start: "10:00", end: "11:00" },
        inputs({
          blockedDates: [{ date: "2026-10-21", fulfillment_method: null }],
          bookingsPerDate: { "2026-10-21": 10 },
        })
      )
    ).toEqual(["blocked", "full", "lead_time"])
  })

  it("reports past and beyond horizon", () => {
    expect(checkTerm({ ...term, date: "2026-10-18" }, inputs())).toEqual([
      "past",
      "lead_time",
    ])
    expect(checkTerm({ ...term, date: "2026-12-20" }, inputs())).toEqual([
      "beyond_horizon",
    ])
  })
})

// spec 005 — on-request windows
describe("on-request windows (unit, no database)", () => {
  // Monday (weekday 1) on request, 10:00–18:00 hourly
  const MONDAY_ON_REQUEST = [10, 11, 12, 13, 14, 15, 16, 17].map((h) => ({
    weekday: 1,
    start_time: `${h}:00`,
    end_time: `${h + 1}:00`,
    requires_confirmation: true,
  }))
  const withRequests = (overrides: Partial<ScheduleInputs> = {}) =>
    inputs({
      schedule: {
        is_enabled: true,
        lead_time_hours: 48,
        booking_horizon_days: 60,
        request_lead_time_hours: 72,
      },
      windows: [...DEFAULT_WINDOWS, ...MONDAY_ON_REQUEST],
      ...overrides,
    })
  const dayOf = (date: string, overrides: Partial<ScheduleInputs> = {}) =>
    computeAvailability({ ...withRequests(overrides), from: date, to: date })[0]

  it("lists Monday windows as requiring confirmation", () => {
    const monday = dayOf("2026-10-26")
    expect(monday.available).toBe(true)
    expect(monday.windows).toHaveLength(8)
    expect(monday.windows.every((w) => w.requires_confirmation)).toBe(true)
    expect(dayOf("2026-10-27").windows.every((w) => !w.requires_confirmation)).toBe(true)
  })

  it("applies the request lead time (72 h) to on-request windows only", () => {
    // now: Tue 2026-10-20 09:00; Thu 10:00 is 49 h ahead → standard ok
    expect(dayOf("2026-10-22").available).toBe(true)
    // a Thursday window on request at the same time is inside 72 h
    const thursdayOnRequest = [{ weekday: 4, start_time: "10:00", end_time: "11:00", requires_confirmation: true }]
    const day = dayOf("2026-10-22", { windows: thursdayOnRequest })
    expect(day.windows[0]).toEqual({
      start: "10:00",
      end: "11:00",
      available: false,
      requires_confirmation: true,
      reason: "lead_time",
    })
    expect(day.reason).toEqual("lead_time")
    // Monday 2026-10-26 10:00 is 145 h ahead → fine
    expect(dayOf("2026-10-26").windows[0].available).toBe(true)
  })

  it("supports a mixed day (standard morning, on-request afternoon)", () => {
    const mixed = [
      { weekday: 6, start_time: "10:00", end_time: "11:00" },
      { weekday: 6, start_time: "14:00", end_time: "15:00", requires_confirmation: true },
    ]
    const saturday = dayOf("2026-10-24", { windows: mixed })
    expect(saturday.windows.map((w) => w.requires_confirmation)).toEqual([false, true])
  })

  it("counts requests against capacity through bookingsPerDate", () => {
    expect(dayOf("2026-10-26", { bookingsPerDate: { "2026-10-26": 10 } }).reason).toEqual("full")
  })

  it("tells whether a term is on request", () => {
    const i = withRequests()
    expect(termRequiresConfirmation({ date: "2026-10-26", start: "10:00", end: "11:00" }, i)).toBe(true)
    expect(termRequiresConfirmation({ date: "2026-10-27", start: "10:00", end: "11:00" }, i)).toBe(false)
    expect(termRequiresConfirmation({ date: "2026-10-26", start: "10:30", end: "11:00" }, i)).toBe(false)
  })

  it("checkTerm uses the request lead time for an on-request term", () => {
    const thursdayOnRequest = [{ weekday: 4, start_time: "10:00", end_time: "11:00", requires_confirmation: true }]
    expect(
      checkTerm({ date: "2026-10-22", start: "10:00", end: "11:00" }, withRequests({ windows: thursdayOnRequest }))
    ).toEqual(["lead_time"])
  })
})

// spec 007 — per-window delivery limit (the driver)
describe("per-window limit (unit, no database)", () => {
  const friday = "2026-10-23"
  const limited = (count: number, overrides: Partial<ScheduleInputs> = {}) =>
    inputs({
      method: "delivery",
      maxOrdersPerWindow: 2,
      bookingsPerWindow: { [windowKey(friday, "12:00", "13:00")]: count },
      ...overrides,
    })

  it("marks the window window_full at the maximum, other windows unaffected", () => {
    const d = day(friday, limited(2))
    const noon = d.windows.find((w) => w.start === "12:00")
    expect(noon).toEqual({
      start: "12:00",
      end: "13:00",
      available: false,
      requires_confirmation: false,
      reason: "window_full",
    })
    expect(d.windows.filter((w) => w.available)).toHaveLength(7)
    expect(d.windows.filter((w) => w.available).every((w) => w.reason === null)).toBe(true)
    expect(d.available).toBe(true)
    expect(day(friday, limited(1)).windows.find((w) => w.start === "12:00")?.available).toBe(true)
  })

  it("applies no limit when the maximum is null or absent", () => {
    expect(day(friday, limited(5, { maxOrdersPerWindow: null })).windows.every((w) => w.available)).toBe(true)
    expect(day(friday, limited(5, { maxOrdersPerWindow: undefined })).windows.every((w) => w.available)).toBe(true)
  })

  it("keeps the day-level full reason and window reason full on a full day", () => {
    const d = day(friday, limited(2, { bookingsPerDate: { [friday]: 10 } }))
    expect(d.reason).toEqual("full")
    expect(d.windows.every((w) => w.reason === "full")).toBe(true)
  })

  it("reads a day with every window taken as full", () => {
    const all = Object.fromEntries(
      [10, 11, 12, 13, 14, 15, 16, 17].map((h) => [windowKey(friday, `${h}:00`, `${h + 1}:00`), 2])
    )
    const d = day(friday, limited(0, { bookingsPerWindow: all }))
    expect(d.available).toBe(false)
    expect(d.reason).toEqual("full")
  })

  it("checkTerm reports window_full", () => {
    expect(checkTerm({ date: friday, start: "12:00", end: "13:00" }, limited(2))).toEqual([
      "window_full",
    ])
    expect(checkTerm({ date: friday, start: "13:00", end: "14:00" }, limited(2))).toEqual([])
  })
})
