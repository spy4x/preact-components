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

    expect(step).toEqual({ unit: "minute", count: 15 })
    expect(ticks.length).toBe(5)
  })

  it("starts weekly ticks on a Monday", () => {
    const { step, ticks } = timeTicks(at("2026-03-01T00:00:00Z"), at("2026-04-05T00:00:00Z"))

    expect(step).toEqual({ unit: "day", count: 7 })
    expect(ticks.map((time) => new Date(time).getUTCDay())).toEqual(ticks.map(() => 1))
  })

  it("puts month ticks on the first of the month, whatever the month's length", () => {
    const { step, ticks } = timeTicks(at("2026-01-15T00:00:00Z"), at("2026-12-20T00:00:00Z"))

    expect(step).toEqual({ unit: "month", count: 3 })
    expect(iso(ticks)).toEqual([
      "2026-04-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
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
})

describe("formatTimeFull", () => {
  it("adds the clock time only when ticks are less than a day apart", () => {
    const time = at("2026-03-01T06:00:00Z")

    expect(formatTimeFull(time, { unit: "hour", count: 1 })).toBe("1 Mar 2026, 06:00")
    expect(formatTimeFull(time, { unit: "day", count: 1 })).toBe("1 Mar 2026")
  })
})
