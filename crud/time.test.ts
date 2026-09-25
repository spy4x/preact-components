import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { formatTimestamp, timeAgo } from "./+index.ts"

const DAY = 86_400_000

describe("timeAgo", () => {
  it("renders an unset column as a dash", () => {
    expect(timeAgo(null)).toBe("-")
    expect(timeAgo(undefined)).toBe("-")
  })

  // ts-libs before 1.4.0 said "0 years ago" here: it switched to years at 360 days but counted
  // them in 365-day steps (spy4x/ts-libs#206).
  it("says 12 months, not 0 years, for something 362 days old", () => {
    expect(timeAgo(Date.now() - 362 * DAY)).toBe("12 months ago")
  })

  it("switches to years once a full year has passed", () => {
    expect(timeAgo(Date.now() - 366 * DAY)).toBe("1 year ago")
  })
})

describe("formatTimestamp", () => {
  // 23:59 on 14 January in Pago Pago (UTC-11), while the clock already reads 00:30 on 15 January
  // there. Every host zone from UTC-10 to UTC+13 puts both instants on 15 January, so a "today"
  // decided in the host's zone would print "Today 23:59".
  const beforeMidnight = "2026-01-15T10:59:00Z"
  const clock = { now: () => Date.parse("2026-01-15T11:30:00Z") }

  it("does not label a time just before midnight in its zone as today when that zone's day has moved on", () => {
    expect(formatTimestamp(beforeMidnight, { timeZone: "Pacific/Pago_Pago", clock }))
      .toBe("14/01/2026 23:59")
  })

  it("labels a time today when it falls on the clock's day in its zone", () => {
    expect(formatTimestamp(beforeMidnight, { timeZone: "UTC", clock })).toBe("Today 10:59")
  })
})
