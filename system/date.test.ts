import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  addDaysIso,
  isoDateInTz,
  isoToday,
  monthFirstWeekday,
  monthLabel,
  shiftMonth,
  startOfMonth,
  weekdayLabels,
} from "./date.ts"

describe("addDaysIso", () => {
  it("adds days within a month", () => {
    expect(addDaysIso("2026-08-10", 5)).toBe("2026-08-15")
  })

  it("crosses a month boundary", () => {
    expect(addDaysIso("2026-08-31", 1)).toBe("2026-09-01")
  })

  it("crosses a year boundary", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDaysIso("2027-01-01", -1)).toBe("2026-12-31")
  })

  it("handles a leap day", () => {
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29")
    expect(addDaysIso("2028-02-29", 1)).toBe("2028-03-01")
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01")
  })

  it("adds zero days unchanged", () => {
    expect(addDaysIso("2026-08-10", 0)).toBe("2026-08-10")
  })

  it("is not drifting across the US spring-forward weekend", () => {
    // 2026-03-08 is the DST transition in America/New_York: a naive local-clock walk loses an hour.
    expect(addDaysIso("2026-03-07", 1)).toBe("2026-03-08")
    expect(addDaysIso("2026-03-08", 1)).toBe("2026-03-09")
  })

  it("rejects a string that is not a date", () => {
    expect(() => addDaysIso("10/08/2026", 1)).toThrow("expected a YYYY-MM-DD date")
  })
})

describe("startOfMonth", () => {
  it("returns the first of the month", () => {
    expect(startOfMonth("2026-08-23")).toBe("2026-08-01")
  })

  it("is a no-op on the first", () => {
    expect(startOfMonth("2026-08-01")).toBe("2026-08-01")
  })
})

describe("shiftMonth", () => {
  it("moves forward and back a month", () => {
    expect(shiftMonth("2026-08-01", 1)).toBe("2026-09-01")
    expect(shiftMonth("2026-08-01", -1)).toBe("2026-07-01")
  })

  it("lands on the first of the target month, never a clipped day", () => {
    expect(shiftMonth("2026-03-31", -1)).toBe("2026-02-01")
    expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-01")
  })

  it("crosses a year boundary in both directions", () => {
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-01")
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-01")
  })

  it("handles a multi-year step", () => {
    expect(shiftMonth("2026-08-01", 25)).toBe("2028-09-01")
    expect(shiftMonth("2026-08-01", -20)).toBe("2024-12-01")
  })
})

describe("monthFirstWeekday", () => {
  it("reports Monday as 0", () => {
    expect(monthFirstWeekday("2026-06-01")).toBe(0) // 2026-06-01 is a Monday
  })

  it("reports Sunday as 6", () => {
    expect(monthFirstWeekday("2026-11-01")).toBe(6) // 2026-11-01 is a Sunday
  })

  it("reports a mid-week first in Monday-first order", () => {
    expect(monthFirstWeekday("2026-08-01")).toBe(5) // Saturday
  })
})

describe("monthLabel", () => {
  it("formats month and year", () => {
    expect(monthLabel("2026-08-23")).toBe("August 2026")
  })

  it("honours a locale", () => {
    expect(monthLabel("2026-08-23", "fr-FR")).toBe("août 2026")
  })
})

describe("weekdayLabels", () => {
  it("returns seven labels starting on Monday", () => {
    const labels = weekdayLabels()

    expect(labels).toHaveLength(7)
    expect(labels[0]).toMatch(/^Mon/)
    expect(labels[6]).toMatch(/^Sun/)
  })

  it("follows the locale's language", () => {
    expect(weekdayLabels("de-DE")[0]).toMatch(/^Mo/)
  })
})

describe("isoDateInTz", () => {
  it("formats the calendar date in the given zone", () => {
    const instant = new Date("2026-08-23T23:30:00Z")

    expect(isoDateInTz(instant, "UTC")).toBe("2026-08-23")
    expect(isoDateInTz(instant, "Asia/Tokyo")).toBe("2026-08-24")
    expect(isoDateInTz(instant, "America/Los_Angeles")).toBe("2026-08-23")
  })

  it("pads single-digit months and days", () => {
    expect(isoDateInTz(new Date("2026-01-05T12:00:00Z"), "UTC")).toBe("2026-01-05")
  })
})

describe("isoToday", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(isoToday("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("agrees with isoDateInTz for the same instant", () => {
    expect(isoToday("Asia/Tokyo")).toBe(isoDateInTz(new Date(), "Asia/Tokyo"))
  })
})
