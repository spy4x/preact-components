import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { formatTimeFull, formatTimeTick, timeTicks } from "./time-ticks.ts"

const at = (iso: string) => Date.parse(iso)
const iso = (ticks: number[]) => ticks.map((time) => new Date(time).toISOString())

describe("timeTicks", () => {
  it("steps a day of data in whole hours on round instants", () => {
    const { step, ticks } = timeTicks(at("2026-03-01T00:20:00Z"), at("2026-03-01T23:00:00Z"))

    expect(step).toEqual({ unit: "hour", count: 6 })
    expect(iso(ticks)).toEqual([
      "2026-03-01T06:00:00.000Z",
      "2026-03-01T12:00:00.000Z",
      "2026-03-01T18:00:00.000Z",
    ])
  })

  it("steps an hour of data in minutes", () => {
    const { step, ticks } = timeTicks(at("2026-03-01T10:00:00Z"), at("2026-03-01T11:00:00Z"))

    expect(step).toEqual({ unit: "minute", count: 10 })
    expect(ticks.length).toBe(7)
  })

  it("starts weekly ticks on a Monday", () => {
    const { step, ticks } = timeTicks(at("2026-03-01T00:00:00Z"), at("2026-04-05T00:00:00Z"))

    expect(step).toEqual({ unit: "day", count: 7 })
    expect(ticks.map((time) => new Date(time).getUTCDay())).toEqual(ticks.map(() => 1))
  })

  it("puts month ticks on the first of the month, whatever the month's length", () => {
    const { step, ticks } = timeTicks(at("2026-01-15T00:00:00Z"), at("2026-12-20T00:00:00Z"))

    expect(step).toEqual({ unit: "month", count: 2 })
    expect(iso(ticks)).toEqual([
      "2026-03-01T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    ])
  })

  it("labels a 45-day span in fortnights, not with a single month", () => {
    const { step, ticks } = timeTicks(at("2026-03-10T00:00:00Z"), at("2026-04-24T00:00:00Z"))

    expect(step).toEqual({ unit: "day", count: 14 })
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.map((time) => new Date(time).getUTCDay())).toEqual(ticks.map(() => 1))
  })

  it("labels a 12.5-day span every three days, not with a single week", () => {
    const { step, ticks } = timeTicks(at("2026-03-01T00:00:00Z"), at("2026-03-13T12:00:00Z"))

    expect(step).toEqual({ unit: "day", count: 3 })
    expect(ticks.length).toBe(4)
  })

  it("puts ticks on the midnights of the zone it is given, not of UTC", () => {
    const { ticks } = timeTicks(at("2026-03-01T00:00:00Z"), at("2026-03-06T00:00:00Z"), {
      timeZone: "Asia/Tokyo",
    })

    expect(iso(ticks)).toEqual([
      "2026-03-01T15:00:00.000Z",
      "2026-03-02T15:00:00.000Z",
      "2026-03-03T15:00:00.000Z",
      "2026-03-04T15:00:00.000Z",
      "2026-03-05T15:00:00.000Z",
    ])
  })

  it("grows year steps by 1, 2, 5 for a long span", () => {
    const { step, ticks } = timeTicks(at("1990-06-01T00:00:00Z"), at("2026-06-01T00:00:00Z"))

    expect(step).toEqual({ unit: "year", count: 10 })
    expect(iso(ticks)).toEqual([
      "2000-01-01T00:00:00.000Z",
      "2010-01-01T00:00:00.000Z",
      "2020-01-01T00:00:00.000Z",
    ])
  })

  it("gives a single instant as its only tick, and nothing for a non-finite one", () => {
    const time = at("2026-03-01T12:00:00Z")

    expect(timeTicks(time, time).ticks).toEqual([time])
    expect(timeTicks(Number.NaN, time).ticks).toEqual([])
  })
})

describe("formatTimeTick", () => {
  it("prints a clock time below a day, a date for days and a month for months, in UTC", () => {
    const time = at("2026-03-01T06:00:00Z")

    expect(formatTimeTick(time, { unit: "hour", count: 6 })).toBe("06:00")
    expect(formatTimeTick(time, { unit: "day", count: 1 })).toBe("1 Mar")
    expect(formatTimeTick(time, { unit: "month", count: 1 })).toBe("Mar 2026")
    expect(formatTimeTick(time, { unit: "year", count: 1 })).toBe("2026")
  })

  it("prints in the zone and locale it is given", () => {
    const time = at("2026-03-01T06:00:00Z")

    expect(formatTimeTick(time, { unit: "hour", count: 1 }, { timeZone: "America/New_York" }))
      .toBe("01:00")
    expect(formatTimeTick(time, { unit: "day", count: 1 }, { locale: "de-DE" })).toBe("1. März")
  })

  it("prints the date instead of 00:00 on an hour tick that falls on midnight", () => {
    const midnight = at("2026-03-02T00:00:00Z")

    expect(formatTimeTick(midnight, { unit: "hour", count: 12 })).toBe("2 Mar")
    expect(formatTimeTick(midnight, { unit: "hour", count: 12 }, { timeZone: "Asia/Tokyo" }))
      .toBe("09:00")
  })
})

describe("formatTimeFull", () => {
  it("adds the clock time only when asked to", () => {
    const time = at("2026-03-01T06:00:00Z")

    expect(formatTimeFull(time, true)).toBe("1 Mar 2026, 06:00")
    expect(formatTimeFull(time, false)).toBe("1 Mar 2026")
  })
})
