import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  addDays,
  calendarDateInZone,
  type DateRange,
  type DateRangePreset,
  dateRangePresets,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  formatIsoDate,
  isSameDay,
  isValidDateRange,
  parseIsoDate,
  presetForRange,
  rangeForPreset,
  shiftMonth,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "./date-range.ts"

/** Fixed instant every range assertion resolves against: 2026-08-23, a Sunday. */
const NOW = new Date("2026-08-23T12:00:00Z")

/** Day count of an inclusive range. */
function dayCount(range: DateRange): number {
  return (parseIsoDate(range.to) - parseIsoDate(range.from)) / 86_400_000 + 1
}

describe("parseIsoDate", () => {
  it("reads midnight UTC of the date", () => {
    expect(parseIsoDate("2026-08-23")).toBe(Date.parse("2026-08-23T00:00:00Z"))
  })

  it("rejects a value that is not YYYY-MM-DD", () => {
    expect(() => parseIsoDate("23/08/2026")).toThrow("expected a YYYY-MM-DD date")
    expect(() => parseIsoDate("2026-8-23")).toThrow("expected a YYYY-MM-DD date")
    expect(() => parseIsoDate("")).toThrow("expected a YYYY-MM-DD date")
  })

  it("rejects a month the calendar does not have", () => {
    expect(() => parseIsoDate("2026-13-01")).toThrow("expected a YYYY-MM-DD date")
  })

  it("rejects a day the month does not have instead of rolling into the next month", () => {
    expect(() => parseIsoDate("2026-04-31")).toThrow("expected a YYYY-MM-DD date")
    expect(() => parseIsoDate("2026-02-29")).toThrow("expected a YYYY-MM-DD date")
  })

  it("accepts the leap day of a leap year", () => {
    expect(parseIsoDate("2028-02-29")).toBe(Date.parse("2028-02-29T00:00:00Z"))
  })
})

describe("formatIsoDate", () => {
  it("round-trips through parseIsoDate", () => {
    expect(formatIsoDate(parseIsoDate("2028-02-29"))).toBe("2028-02-29")
  })
})

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-08-10", 5)).toBe("2026-08-15")
  })

  it("crosses a month boundary in both directions", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01")
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31")
  })

  it("crosses a year boundary in both directions", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31")
  })

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01")
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01")
  })

  it("adds zero days unchanged", () => {
    expect(addDays("2026-08-10", 0)).toBe("2026-08-10")
  })

  it("is not drifting across the Paris DST weekends", () => {
    // 2026-03-29 is spring-forward (23h) and 2026-10-25 fall-back (25h) in Europe/Paris. A naive
    // local-clock walk loses or gains an hour on exactly these days.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29")
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30")
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25")
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26")
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

describe("startOfMonth and endOfMonth", () => {
  it("bracket a 31-day month", () => {
    expect(startOfMonth("2026-08-23")).toBe("2026-08-01")
    expect(endOfMonth("2026-08-23")).toBe("2026-08-31")
  })

  it("bracket a 30-day month", () => {
    expect(endOfMonth("2026-04-15")).toBe("2026-04-30")
  })

  it("bracket February in a non-leap year", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28")
  })

  it("bracket February in a leap year", () => {
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29")
  })

  it("are idempotent on the first of the month", () => {
    expect(startOfMonth("2026-08-01")).toBe("2026-08-01")
  })
})

describe("startOfQuarter and endOfQuarter", () => {
  it("bracket Q1", () => {
    expect(startOfQuarter("2026-01-05")).toBe("2026-01-01")
    expect(endOfQuarter("2026-01-05")).toBe("2026-03-31")
  })

  it("bracket Q2", () => {
    expect(startOfQuarter("2026-05-31")).toBe("2026-04-01")
    expect(endOfQuarter("2026-05-31")).toBe("2026-06-30")
  })

  it("bracket Q3", () => {
    expect(startOfQuarter("2026-08-23")).toBe("2026-07-01")
    expect(endOfQuarter("2026-08-23")).toBe("2026-09-30")
  })

  it("bracket Q4", () => {
    expect(startOfQuarter("2026-11-30")).toBe("2026-10-01")
    expect(endOfQuarter("2026-11-30")).toBe("2026-12-31")
  })

  it("are stable on the first day of a quarter", () => {
    expect(startOfQuarter("2026-10-01")).toBe("2026-10-01")
  })
})

describe("startOfYear and endOfYear", () => {
  it("bracket the year", () => {
    expect(startOfYear("2026-08-23")).toBe("2026-01-01")
    expect(endOfYear("2026-08-23")).toBe("2026-12-31")
  })

  it("bracket a leap year", () => {
    expect(endOfYear("2028-06-01")).toBe("2028-12-31")
  })
})

describe("isSameDay", () => {
  it("matches identical dates", () => {
    expect(isSameDay("2026-08-23", "2026-08-23")).toBe(true)
  })

  it("separates neighbouring days", () => {
    expect(isSameDay("2026-08-23", "2026-08-24")).toBe(false)
    expect(isSameDay("2026-08-23", "2025-08-23")).toBe(false)
  })

  it("throws on a value that is not a date", () => {
    expect(() => isSameDay("2026-08-23", "yesterday")).toThrow("expected a YYYY-MM-DD date")
  })
})

describe("isValidDateRange", () => {
  it("accepts an ordered range and a single day", () => {
    expect(isValidDateRange({ from: "2026-08-01", to: "2026-08-23" })).toBe(true)
    expect(isValidDateRange({ from: "2026-08-23", to: "2026-08-23" })).toBe(true)
  })

  it("rejects a reversed range", () => {
    expect(isValidDateRange({ from: "2026-08-23", to: "2026-08-01" })).toBe(false)
  })

  it("rejects a half-typed or impossible range without throwing", () => {
    expect(isValidDateRange({ from: "", to: "" })).toBe(false)
    expect(isValidDateRange({ from: "2026-08-01", to: "" })).toBe(false)
    expect(isValidDateRange({ from: "2026-02-31", to: "2026-03-01" })).toBe(false)
  })
})

describe("calendarDateInZone", () => {
  it("formats the calendar date in each zone", () => {
    const instant = new Date("2026-08-23T23:30:00Z")

    expect(calendarDateInZone(instant, "UTC")).toBe("2026-08-23")
    expect(calendarDateInZone(instant, "Asia/Tokyo")).toBe("2026-08-24")
    expect(calendarDateInZone(instant, "America/Los_Angeles")).toBe("2026-08-23")
  })

  it("pads single-digit months and days", () => {
    expect(calendarDateInZone(new Date("2026-01-05T12:00:00Z"), "UTC")).toBe("2026-01-05")
  })

  it("pads a year below 1000 to the four-digit ISO form", () => {
    // `Intl` reports year 999 as "999"; unpadded, every date in it would be unparsable and every
    // calendar preset would throw.
    expect(calendarDateInZone(new Date("0999-01-01T00:00:00Z"), "UTC")).toBe("0999-01-01")
    expect(calendarDateInZone(new Date("0001-06-01T00:00:00Z"), "UTC")).toBe("0001-06-01")
  })

  it("reads the spring-forward day in Europe/Paris, not the UTC day", () => {
    // 23:30Z on 28 March is already 00:30 on 29 March in Paris (CET+1, the last hour before the
    // clocks jump). Computing in UTC would claim the day before the transition.
    const instant = new Date("2026-03-28T23:30:00Z")

    expect(calendarDateInZone(instant, "Europe/Paris")).toBe("2026-03-29")
    expect(calendarDateInZone(instant, "UTC")).toBe("2026-03-28")
  })

  it("reads the fall-back day in Europe/Paris", () => {
    // 22:30Z on 24 October is 00:30 on 25 October in Paris, still CEST+2. The 25th is 25 hours long.
    const instant = new Date("2026-10-24T22:30:00Z")

    expect(calendarDateInZone(instant, "Europe/Paris")).toBe("2026-10-25")
    expect(calendarDateInZone(instant, "UTC")).toBe("2026-10-24")
  })

  it("throws on a zone Intl does not know", () => {
    expect(() => calendarDateInZone(new Date("2026-08-23T12:00:00Z"), "not/a-zone")).toThrow()
  })
})

describe("rangeForPreset", () => {
  it("returns the documented range for every preset", () => {
    // One readable table for the whole preset set: `now` is 2026-08-23T12:00:00Z, zone UTC.
    const expected: Record<DateRangePreset, DateRange> = {
      "today": { from: "2026-08-23", to: "2026-08-23" },
      "yesterday": { from: "2026-08-22", to: "2026-08-22" },
      "last-3-days": { from: "2026-08-21", to: "2026-08-23" },
      "last-7-days": { from: "2026-08-17", to: "2026-08-23" },
      "last-14-days": { from: "2026-08-10", to: "2026-08-23" },
      "last-30-days": { from: "2026-07-25", to: "2026-08-23" },
      "last-90-days": { from: "2026-05-26", to: "2026-08-23" },
      "last-12-months": { from: "2025-09-01", to: "2026-08-31" },
      "this-month": { from: "2026-08-01", to: "2026-08-31" },
      "last-month": { from: "2026-07-01", to: "2026-07-31" },
      "this-quarter": { from: "2026-07-01", to: "2026-09-30" },
      "last-quarter": { from: "2026-04-01", to: "2026-06-30" },
      "this-year": { from: "2026-01-01", to: "2026-12-31" },
      "last-year": { from: "2025-01-01", to: "2025-12-31" },
      "custom": { from: "2026-08-01", to: "2026-08-15" },
    }

    for (const preset of dateRangePresets) {
      expect(rangeForPreset(preset, {
        now: NOW,
        timeZone: "UTC",
        custom: { from: "2026-08-01", to: "2026-08-15" },
      })).toEqual(expected[preset])
    }
  })

  it("covers every declared preset, so a new one cannot land untested", () => {
    expect(new Set(dateRangePresets).size).toBe(dateRangePresets.length)
    expect(dateRangePresets).toContain("custom")
  })

  it("counts the rolling windows inclusively, today included", () => {
    const windows: Array<[DateRangePreset, number]> = [
      ["today", 1],
      ["yesterday", 1],
      ["last-3-days", 3],
      ["last-7-days", 7],
      ["last-14-days", 14],
      ["last-30-days", 30],
      ["last-90-days", 90],
    ]

    for (const [preset, days] of windows) {
      expect(dayCount(rangeForPreset(preset, { now: NOW, timeZone: "UTC" }))).toBe(days)
    }

    // Every window but `yesterday` ends on today; `yesterday` is a single day of its own.
    for (const preset of windows.map(([preset]) => preset)) {
      const endsToday = preset !== "yesterday"
      expect(rangeForPreset(preset, { now: NOW, timeZone: "UTC" }).to)
        .toBe(endsToday ? "2026-08-23" : "2026-08-22")
    }
  })

  it("crosses a month boundary in a rolling window", () => {
    const range = rangeForPreset("last-30-days", {
      now: new Date("2026-09-02T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2026-08-04", to: "2026-09-02" })
    expect(dayCount(range)).toBe(30)
  })

  it("crosses a year boundary in a rolling window", () => {
    const range = rangeForPreset("last-7-days", {
      now: new Date("2027-01-03T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2026-12-28", to: "2027-01-03" })
  })

  it("spans a full leap February in a rolling window", () => {
    // 2028-03-01 minus 29 days has to reach 2028-02-01, i.e. the whole 29-day month.
    const range = rangeForPreset("last-30-days", {
      now: new Date("2028-03-01T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2028-02-01", to: "2028-03-01" })
    expect(dayCount(range)).toBe(30)
  })

  it("rolls the morning of 1 March back through a leap day", () => {
    expect(rangeForPreset("yesterday", {
      now: new Date("2028-03-01T09:00:00Z"),
      timeZone: "UTC",
    })).toEqual({ from: "2028-02-29", to: "2028-02-29" })
  })

  it("keeps the last-month range inside the previous month across a year boundary", () => {
    const range = rangeForPreset("last-month", {
      now: new Date("2027-01-15T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2026-12-01", to: "2026-12-31" })
  })

  it("ends the last-month range on the leap day", () => {
    const range = rangeForPreset("last-month", {
      now: new Date("2028-03-15T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2028-02-01", to: "2028-02-29" })
  })

  it("wraps the last quarter into the previous year in Q1", () => {
    const range = rangeForPreset("last-quarter", {
      now: new Date("2026-01-05T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2025-10-01", to: "2025-12-31" })
  })

  it("keeps the last quarter inside the previous year in Q1 of a leap year", () => {
    const range = rangeForPreset("last-quarter", {
      now: new Date("2028-02-29T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2027-10-01", to: "2027-12-31" })
  })

  it("bounds the last 12 months by whole calendar months", () => {
    const range = rangeForPreset("last-12-months", {
      now: new Date("2026-01-15T12:00:00Z"),
      timeZone: "UTC",
    })

    expect(range).toEqual({ from: "2025-02-01", to: "2026-01-31" })
  })

  it("resolves today in the given zone, not in UTC", () => {
    const instant = new Date("2026-08-23T23:30:00Z")

    expect(rangeForPreset("today", { now: instant, timeZone: "Asia/Tokyo" }))
      .toEqual({ from: "2026-08-24", to: "2026-08-24" })
    expect(rangeForPreset("today", { now: instant, timeZone: "UTC" }))
      .toEqual({ from: "2026-08-23", to: "2026-08-23" })
  })

  it("resolves a preset in a year before 1000", () => {
    // The four-digit window the module documents: a three-digit year must not escape the maths.
    const options = { now: new Date("0999-06-15T12:00:00Z"), timeZone: "UTC" }

    expect(rangeForPreset("today", options)).toEqual({ from: "0999-06-15", to: "0999-06-15" })
    expect(rangeForPreset("this-month", options)).toEqual({ from: "0999-06-01", to: "0999-06-30" })
    expect(rangeForPreset("this-year", options)).toEqual({ from: "0999-01-01", to: "0999-12-31" })
    expect(rangeForPreset("last-year", options)).toEqual({ from: "0998-01-01", to: "0998-12-31" })
  })

  it("resolves the spring-forward day in Europe/Paris", () => {
    const options = { now: new Date("2026-03-28T23:30:00Z"), timeZone: "Europe/Paris" }

    expect(rangeForPreset("today", options)).toEqual({ from: "2026-03-29", to: "2026-03-29" })
    expect(rangeForPreset("yesterday", options)).toEqual({ from: "2026-03-28", to: "2026-03-28" })
    expect(rangeForPreset("last-3-days", options))
      .toEqual({ from: "2026-03-27", to: "2026-03-29" })
  })

  it("resolves the fall-back day in Europe/Paris", () => {
    // The 25th is 25 hours long; picking it must not shift the window by an hour.
    const options = { now: new Date("2026-10-24T22:30:00Z"), timeZone: "Europe/Paris" }

    expect(rangeForPreset("today", options)).toEqual({ from: "2026-10-25", to: "2026-10-25" })
    expect(rangeForPreset("yesterday", options)).toEqual({ from: "2026-10-24", to: "2026-10-24" })
    expect(rangeForPreset("last-7-days", options))
      .toEqual({ from: "2026-10-19", to: "2026-10-25" })
  })

  it("keeps every rolling window exactly N days long across a DST change", () => {
    const windows: Array<[DateRangePreset, number]> = [
      ["last-3-days", 3],
      ["last-7-days", 7],
      ["last-14-days", 14],
      ["last-30-days", 30],
      ["last-90-days", 90],
    ]

    for (const timeZone of ["Europe/Paris", "America/New_York", "UTC"]) {
      for (const now of [new Date("2026-03-29T12:00:00Z"), new Date("2026-10-25T12:00:00Z")]) {
        for (const [preset, days] of windows) {
          const range = rangeForPreset(preset, { now, timeZone })

          expect(dayCount(range)).toBe(days)
          expect(range.to).toBe(calendarDateInZone(now, timeZone))
        }
      }
    }
  })

  it("crosses the year boundary in Paris a day before UTC does", () => {
    const instant = new Date("2026-12-31T23:30:00Z")

    expect(rangeForPreset("this-year", { now: instant, timeZone: "Europe/Paris" }))
      .toEqual({ from: "2027-01-01", to: "2027-12-31" })
    expect(rangeForPreset("last-year", { now: instant, timeZone: "Europe/Paris" }))
      .toEqual({ from: "2026-01-01", to: "2026-12-31" })
    expect(rangeForPreset("this-quarter", { now: instant, timeZone: "Europe/Paris" }))
      .toEqual({ from: "2027-01-01", to: "2027-03-31" })
    expect(rangeForPreset("this-year", { now: instant, timeZone: "UTC" }))
      .toEqual({ from: "2026-01-01", to: "2026-12-31" })
  })

  it("is a pure function of its arguments", () => {
    const first = rangeForPreset("last-30-days", { now: NOW, timeZone: "Europe/Paris" })
    const second = rangeForPreset("last-30-days", { now: NOW, timeZone: "Europe/Paris" })

    expect(first).toEqual(second)
  })

  it("echoes a valid custom range", () => {
    expect(rangeForPreset("custom", {
      now: NOW,
      timeZone: "UTC",
      custom: { from: "2026-08-01", to: "2026-08-15" },
    })).toEqual({ from: "2026-08-01", to: "2026-08-15" })
  })

  it("accepts a single-day custom range", () => {
    expect(rangeForPreset("custom", {
      now: NOW,
      timeZone: "UTC",
      custom: { from: "2026-08-01", to: "2026-08-01" },
    })).toEqual({ from: "2026-08-01", to: "2026-08-01" })
  })

  it("rejects a custom preset with no range", () => {
    expect(() => rangeForPreset("custom", { now: NOW, timeZone: "UTC" }))
      .toThrow('the "custom" preset needs a range in options.custom')
  })

  it("rejects a reversed custom range", () => {
    expect(() =>
      rangeForPreset("custom", {
        now: NOW,
        timeZone: "UTC",
        custom: { from: "2026-08-15", to: "2026-08-01" },
      })
    ).toThrow("expected an ordered range")
  })

  it("rejects an unknown preset at runtime", () => {
    expect(() => rangeForPreset("last-42-days" as DateRangePreset, { now: NOW, timeZone: "UTC" }))
      .toThrow("unknown date range preset")
  })

  it("ignores the custom range for every other preset", () => {
    expect(rangeForPreset("today", {
      now: NOW,
      timeZone: "UTC",
      custom: { from: "1999-01-01", to: "1999-12-31" },
    })).toEqual({ from: "2026-08-23", to: "2026-08-23" })
  })
})

describe("presetForRange", () => {
  it("names the preset a range came from", () => {
    expect(presetForRange({ from: "2026-08-01", to: "2026-08-31" }, { now: NOW, timeZone: "UTC" }))
      .toBe("this-month")
    expect(presetForRange({ from: "2026-08-17", to: "2026-08-23" }, { now: NOW, timeZone: "UTC" }))
      .toBe("last-7-days")
    expect(presetForRange({ from: "2026-08-23", to: "2026-08-23" }, { now: NOW, timeZone: "UTC" }))
      .toBe("today")
  })

  it("returns undefined for a range no preset describes", () => {
    expect(presetForRange({ from: "2026-08-05", to: "2026-08-09" }, { now: NOW, timeZone: "UTC" }))
      .toBeUndefined()
  })

  it("returns undefined for an invalid range", () => {
    expect(presetForRange({ from: "2026-08-31", to: "2026-08-01" }, { now: NOW, timeZone: "UTC" }))
      .toBeUndefined()
    expect(presetForRange({ from: "", to: "" }, { now: NOW, timeZone: "UTC" })).toBeUndefined()
  })

  it("never returns custom, which describes no range", () => {
    const presets = presetForRange(
      { from: "2026-08-01", to: "2026-08-15" },
      { now: NOW, timeZone: "UTC" },
    )

    expect(presets).toBeUndefined()
  })

  it("honours a caller-supplied candidate list", () => {
    const range = { from: "2026-08-01", to: "2026-08-31" }
    const options = { now: NOW, timeZone: "UTC", presets: ["today", "yesterday"] as const }

    expect(presetForRange(range, options)).toBeUndefined()
    expect(presetForRange({ from: "2026-08-23", to: "2026-08-23" }, options)).toBe("today")
  })

  it("resolves the candidates in the caller's zone", () => {
    const instant = new Date("2026-08-23T23:30:00Z")

    expect(presetForRange({ from: "2026-08-24", to: "2026-08-24" }, {
      now: instant,
      timeZone: "Asia/Tokyo",
    })).toBe("today")
    expect(presetForRange({ from: "2026-08-24", to: "2026-08-24" }, {
      now: instant,
      timeZone: "UTC",
    })).toBeUndefined()
  })

  it("resolves the preset whose range matches, at one instant", () => {
    // One instant in Q3, where no two presets coincide. That is all this establishes: precedence
    // between coinciding presets is a separate, pinned rule below.
    for (const preset of dateRangePresets.filter((entry) => entry !== "custom")) {
      const range = rangeForPreset(preset, { now: NOW, timeZone: "Europe/Paris" })

      expect(presetForRange(range, { now: NOW, timeZone: "Europe/Paris" })).toBe(preset)
    }
  })

  it("resolves a range two presets describe to the earlier one in the canonical order", () => {
    // Each row is one collision class: `later` and `earlier` return the same `range`, and the
    // earlier preset in `dateRangePresets` is the one `presetForRange` names.
    const coincidences: Array<[string, DateRangePreset, DateRangePreset, DateRange]> = [
      [
        "2024-04-30T12:00:00Z",
        "this-month",
        "last-30-days",
        { from: "2024-04-01", to: "2024-04-30" },
      ],
      [
        "2024-12-01T12:00:00Z",
        "this-year",
        "last-12-months",
        { from: "2024-01-01", to: "2024-12-31" },
      ],
      [
        "2025-03-31T12:00:00Z",
        "this-quarter",
        "last-90-days",
        { from: "2025-01-01", to: "2025-03-31" },
      ],
    ]

    for (const [instant, later, earlier, range] of coincidences) {
      const now = new Date(instant)

      expect(rangeForPreset(later, { now, timeZone: "UTC" })).toEqual(range)
      expect(rangeForPreset(earlier, { now, timeZone: "UTC" })).toEqual(range)
      expect(presetForRange(range, { now, timeZone: "UTC" })).toBe(earlier)
    }
  })

  it("never names a preset later than the one that produced the range", () => {
    // Every day of 2024–2027 × the 14 defined presets. 143 of these 20 454 pairs coincide with an
    // earlier preset, and the rule is the same for all of them: the winner describes the range and
    // never sits later in the canonical order.
    const presets: readonly DateRangePreset[] = dateRangePresets.filter((entry) =>
      entry !== "custom"
    )
    let coincidences = 0

    for (let day = 0; day < 1461; day++) {
      const options = { now: new Date(Date.UTC(2024, 0, 1 + day, 12)), timeZone: "UTC" }
      const ranges = presets.map((preset) => ({ preset, range: rangeForPreset(preset, options) }))

      for (const { preset, range } of ranges) {
        const winner = presetForRange(range, options)
        if (!winner) throw new Error(`no preset described ${preset}'s range from ${range.from}`)

        expect(ranges.find((entry) => entry.preset === winner)?.range).toEqual(range)
        expect(presets.indexOf(winner)).toBeLessThanOrEqual(presets.indexOf(preset))
        if (winner !== preset) coincidences++
      }
    }

    expect(coincidences).toBe(143)
  })
})
