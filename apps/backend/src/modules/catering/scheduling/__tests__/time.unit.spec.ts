import {
  addDays,
  daysBetween,
  formatPlDate,
  isoWeekday,
  isValidDate,
  isValidTime,
  warsawToday,
  warsawWallClockToInstant,
} from "../time"

// Reference instants computed with Python's zoneinfo (Europe/Warsaw).
describe("warsawWallClockToInstant (unit, no database)", () => {
  it.each([
    ["2026-01-15", "10:00", "2026-01-15T09:00:00.000Z"], // winter, +01:00
    ["2026-10-20", "10:00", "2026-10-20T08:00:00.000Z"], // summer, +02:00
    ["2026-03-28", "10:00", "2026-03-28T09:00:00.000Z"], // day before spring forward
    ["2026-03-29", "10:00", "2026-03-29T08:00:00.000Z"], // spring forward day
    ["2026-10-24", "10:00", "2026-10-24T08:00:00.000Z"], // day before fall back
    ["2026-10-25", "10:00", "2026-10-25T09:00:00.000Z"], // fall back day
  ])("%s %s → %s", (date, time, expected) => {
    expect(warsawWallClockToInstant(date, time).toISOString()).toEqual(expected)
  })

  it("resolves the non-existent 02:30 on spring forward to the next valid hour", () => {
    // 02:00–03:00 does not exist on 2026-03-29; 03:30 CEST = 01:30Z
    expect(warsawWallClockToInstant("2026-03-29", "02:30").toISOString()).toEqual(
      "2026-03-29T01:30:00.000Z"
    )
  })
})

describe("warsawToday", () => {
  it.each([
    ["2026-07-01T21:59:00Z", "2026-07-01"], // 23:59 CEST
    ["2026-07-01T22:30:00Z", "2026-07-02"], // 00:30 CEST next day
    ["2026-01-01T22:59:00Z", "2026-01-01"], // 23:59 CET
    ["2026-01-01T23:30:00Z", "2026-01-02"], // 00:30 CET next day
  ])("%s → %s", (instant, expected) => {
    expect(warsawToday(new Date(instant))).toEqual(expected)
  })
})

describe("calendar helpers", () => {
  it("returns ISO weekdays", () => {
    expect(isoWeekday("2026-10-19")).toEqual(1) // Monday
    expect(isoWeekday("2026-10-06")).toEqual(2) // Tuesday
    expect(isoWeekday("2026-10-25")).toEqual(7) // Sunday
  })

  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-10-24", 1)).toEqual("2026-10-25")
    expect(addDays("2026-10-25", 1)).toEqual("2026-10-26")
    expect(addDays("2026-12-31", 1)).toEqual("2027-01-01")
    expect(addDays("2026-03-01", -1)).toEqual("2026-02-28")
  })

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-20", "2026-12-19")).toEqual(60)
    expect(daysBetween("2026-10-26", "2026-10-25")).toEqual(-1)
  })

  it("formats Polish dates", () => {
    expect(formatPlDate("2026-10-20")).toEqual("20.10.2026")
  })

  it.each([
    ["2026-10-20", true],
    ["2026-02-30", false],
    ["2026-13-01", false],
    ["20-10-2026", false],
    [20261020, false],
  ])("isValidDate(%p) = %s", (value, expected) => {
    expect(isValidDate(value)).toBe(expected)
  })

  it.each([
    ["10:00", true],
    ["23:59", true],
    ["24:00", false],
    ["9:00", false],
    ["10:60", false],
  ])("isValidTime(%p) = %s", (value, expected) => {
    expect(isValidTime(value)).toBe(expected)
  })
})
