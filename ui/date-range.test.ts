import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type DateRange, parseIsoDate } from "@spy4x/time/date"
import { isoDateInTz } from "@spy4x/time/tz"
import {
  type DateRangePreset,
  dateRangePresets,
  type DateTimeRange,
  isValidDateTimeRange,
  presetForRange,
  presetForTimeRange,
  rangeForPreset,
  rangeForTimePreset,
  timeRangePresets,
} from "./date-range.ts"

/** Fixed instant every range assertion resolves against: 2026-08-23, a Sunday. */
const NOW = new Date("2026-08-23T12:00:00Z")

/** One hour, in milliseconds. */
const HOUR = 3_600_000

/**
 * The earliest instant a `YYYY-MM-DDTHH:mm` wall-clock string names in a zone.
 *
 * That is what a standard conversion returns for a time the zone's fall-back repeats — Temporal's
 * default disambiguation picks the earlier of the two — so it is how a caller's round trip reads a
 * timed range back. Throws for a time the zone skips, which none of these tests converts.
 */
function earliestInstant(wall: string, timeZone: string): number {
  const asUtc = Date.parse(`${wall}:00Z`)
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const readsAs = (ms: number) => {
    const parts = Object.fromEntries(format.formatToParts(ms).map((p) => [p.type, p.value]))
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
  }
  const matches: number[] = []
  for (let minutes = -14 * 60; minutes <= 14 * 60; minutes += 15) {
    const ms = asUtc - minutes * 60_000
    if (readsAs(ms) === wall) matches.push(ms)
  }
  if (matches.length === 0) throw new Error(`${wall} does not happen in ${timeZone}`)
  return Math.min(...matches)
}

/** How many hours a caller's standard conversion reads a timed range as. */
function roundTripHours(range: { from: string; to: string }, timeZone: string): number {
  return (earliestInstant(range.to, timeZone) - earliestInstant(range.from, timeZone)) / HOUR
}

/** Day count of an inclusive range. */
function dayCount(range: DateRange): number {
  return (parseIsoDate(range.to) - parseIsoDate(range.from)) / 86_400_000 + 1
}

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

  it("throws in December 9999 for the presets that need a day past the window", () => {
    // 9999 is inside the documented window; `this-month` and `this-quarter` still throw, because
    // the end of that month or quarter is 10000-01-01, which is not a date. Same class of message
    // as any other unusable value — the module has one loud-failure convention, not three — and the
    // window wording is `addDays`'s, because `shiftMonth` now rejects the step itself rather than
    // handing `parseIsoDate` a five-digit year to reject one call later.
    //
    // `last-12-months` is here as its own regression: it asks for `endOfMonth(today)`, not for a
    // shifted month, so it reaches the same boundary through the other of the two callers.
    const options = { now: new Date("9999-12-15T12:00:00Z"), timeZone: "UTC" }

    for (const preset of ["this-month", "this-quarter", "last-12-months"] as const) {
      expect(() => rangeForPreset(preset, options))
        .toThrow("expected a date in the 0001-9999 window, received: +010000-01")
    }
  })

  it("resolves the other presets in December 9999", () => {
    // The boundary is per preset, not per year: `this-year` ends on 9999-12-31, which exists.
    const options = { now: new Date("9999-12-15T12:00:00Z"), timeZone: "UTC" }

    expect(rangeForPreset("today", options)).toEqual({ from: "9999-12-15", to: "9999-12-15" })
    expect(rangeForPreset("last-7-days", options))
      .toEqual({ from: "9999-12-09", to: "9999-12-15" })
    expect(rangeForPreset("this-year", options)).toEqual({ from: "9999-01-01", to: "9999-12-31" })
    expect(rangeForPreset("last-year", options)).toEqual({ from: "9998-01-01", to: "9998-12-31" })
    expect(rangeForPreset("last-month", options)).toEqual({ from: "9999-11-01", to: "9999-11-30" })
  })

  it("fails every arithmetic preset for a year-10000 instant, but echoes it from today", () => {
    // The documented escape: `today` is a pass-through and returns the five-digit string
    // `isoDateInTz` produced, while the presets that do arithmetic reject it.
    const options = { now: new Date("+010000-01-01T00:00:00Z"), timeZone: "UTC" }

    expect(rangeForPreset("today", options)).toEqual({ from: "10000-01-01", to: "10000-01-01" })
    expect(() => rangeForPreset("yesterday", options))
      .toThrow("expected a YYYY-MM-DD date, received: 10000-01-01")
    expect(() => rangeForPreset("this-month", options))
      .toThrow("expected a YYYY-MM-DD date, received: 10000-01-01")
  })

  it("keeps a preset inside the year 0 the window excludes, rather than failing", () => {
    // No failure here, and that is the point worth pinning: `last-year` from 0001 builds the year
    // "0000" by string arithmetic, and a rolling window walks straight past 0001-01-01. Both land
    // in a year the doc calls unsupported and neither is flagged, because `Date` — unlike `Intl` —
    // keeps year 0000 as the caller wrote it. Documented, not fixed; unreachable from a UI clock.
    const midYear = { now: new Date("0001-06-15T12:00:00Z"), timeZone: "UTC" }

    expect(rangeForPreset("today", midYear)).toEqual({ from: "0001-06-15", to: "0001-06-15" })
    expect(rangeForPreset("this-year", midYear)).toEqual({ from: "0001-01-01", to: "0001-12-31" })
    expect(rangeForPreset("yesterday", midYear)).toEqual({ from: "0001-06-14", to: "0001-06-14" })
    expect(rangeForPreset("last-year", midYear)).toEqual({ from: "0000-01-01", to: "0000-12-31" })
    expect(rangeForPreset("last-7-days", {
      now: new Date("0001-01-05T12:00:00Z"),
      timeZone: "UTC",
    })).toEqual({ from: "0000-12-30", to: "0001-01-05" })
  })

  it("shifts a preset's date for an instant in 1 BC, where Intl reports year 1", () => {
    // The wrong date the module's doc calls out: 0000-06-15 is 1 BC, `isoDateInTz` pads the
    // era's year to "0001-06-15", and `last-year` then answers with the nonexistent year 0000.
    // Both are pinned as current behaviour — unreachable from a UI clock, and fixing them needs an
    // era-aware date model, which this module does not have.
    const options = { now: new Date("0000-06-15T00:00:00Z"), timeZone: "UTC" }

    expect(rangeForPreset("today", options)).toEqual({ from: "0001-06-15", to: "0001-06-15" })
    expect(rangeForPreset("last-year", options)).toEqual({ from: "0000-01-01", to: "0000-12-31" })
    expect(rangeForPreset("yesterday", options)).toEqual({ from: "0001-06-14", to: "0001-06-14" })
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
          expect(range.to).toBe(isoDateInTz(now, timeZone))
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

describe("rangeForTimePreset", () => {
  it("resolves last-hour and last-24-hours to real elapsed windows, minute precision", () => {
    const now = new Date("2026-08-23T15:45:00Z") // 17:45 CEST — an ordinary Berlin day, no DST edge

    expect(rangeForTimePreset("last-hour", { now, timeZone: "Europe/Berlin" }))
      .toEqual({ from: "2026-08-23T16:45", to: "2026-08-23T17:45" })
    expect(rangeForTimePreset("last-24-hours", { now, timeZone: "Europe/Berlin" }))
      .toEqual({ from: "2026-08-22T17:45", to: "2026-08-23T17:45" })
  })

  it("covers every declared preset, so a new one cannot land untested", () => {
    const now = new Date("2026-08-23T12:00:00Z")

    for (const preset of timeRangePresets) {
      expect(() => rangeForTimePreset(preset, { now, timeZone: "UTC" })).not.toThrow()
    }
  })

  it("is a pure function of its arguments", () => {
    const now = new Date("2026-08-23T12:00:00Z")
    const options = { now, timeZone: "Europe/Berlin" } as const

    expect(rangeForTimePreset("last-hour", options)).toEqual(
      rangeForTimePreset("last-hour", options),
    )
  })

  it("truncates seconds rather than rounding them into the next minute", () => {
    const now = new Date("2026-08-23T15:45:59Z")

    expect(rangeForTimePreset("last-hour", { now, timeZone: "UTC" }))
      .toEqual({ from: "2026-08-23T14:45", to: "2026-08-23T15:45" })
  })

  it("reads midnight as 00:00 of the new day, never as 24:00", () => {
    const now = new Date("2026-08-23T22:00:00Z") // 00:00 CEST on the 24th

    expect(rangeForTimePreset("last-hour", { now, timeZone: "Europe/Berlin" }))
      .toEqual({ from: "2026-08-23T23:00", to: "2026-08-24T00:00" })
  })

  it("keeps last-24-hours a real 24 hours across the Berlin spring-forward day, not 24 wall hours", () => {
    // 2026-03-29 is spring-forward in Europe/Berlin: the day itself is 23 wall-clock hours long
    // (02:00–03:00 does not happen), so 24 *real* hours back lands 25 wall-clock hours earlier.
    const now = new Date("2026-03-29T12:00:00Z") // 14:00 CEST

    expect(rangeForTimePreset("last-24-hours", { now, timeZone: "Europe/Berlin" }))
      .toEqual({ from: "2026-03-28T13:00", to: "2026-03-29T14:00" })
  })

  it("keeps last-24-hours a real 24 hours across the Berlin fall-back day, not 24 wall hours", () => {
    // 2026-10-25 is fall-back in Europe/Berlin: the day is 25 wall-clock hours long (02:00–03:00
    // happens twice), so 24 real hours back lands only 23 wall-clock hours earlier.
    const now = new Date("2026-10-25T12:00:00Z") // 13:00 CET

    expect(rangeForTimePreset("last-24-hours", { now, timeZone: "Europe/Berlin" }))
      .toEqual({ from: "2026-10-24T14:00", to: "2026-10-25T13:00" })
  })

  it("crosses the Berlin spring-forward gap without landing on the skipped wall-clock hour", () => {
    // now is 30 minutes into the day's 03:00 CEST (the jump from 02:00 CET happened at UTC 01:00,
    // 30 minutes earlier), so the real hour before it starts 30 minutes into 01:00 CET — the two
    // ends read 01:30 and 03:30, two nominal hours apart for one real hour, and 02:00–03:00 (the
    // hour that never happened that day) appears in neither string.
    const now = new Date("2026-03-29T01:30:00Z")

    const range = rangeForTimePreset("last-hour", { now, timeZone: "Europe/Berlin" })

    expect(range).toEqual({ from: "2026-03-29T01:30", to: "2026-03-29T03:30" })
    expect(range.from >= "2026-03-29T02:00" && range.from < "2026-03-29T03:00").toBe(false)
    expect(range.to >= "2026-03-29T02:00" && range.to < "2026-03-29T03:00").toBe(false)
  })

  it("prints the same wall-clock minute for from and to across the Berlin fall-back's ambiguous hour", () => {
    // now falls in the *second* 02:30 of the day (CET, after the fall-back at UTC 01:00); the real
    // hour before it falls in the *first* 02:30 (CEST, before the fall-back). Both are correct
    // readings of their own instant, and both print "2026-10-25T02:30" — a real hour apart, an
    // identical wall-clock string, documented on DateTimeRange rather than special-cased away.
    const now = new Date("2026-10-25T01:30:00Z")

    const range = rangeForTimePreset("last-hour", { now, timeZone: "Europe/Berlin" })

    expect(range).toEqual({ from: "2026-10-25T02:30", to: "2026-10-25T02:30" })
    expect(isValidDateTimeRange(range)).toBe(true)
    expect(roundTripHours(range, "Europe/Berlin")).toBe(0)
  })

  it("reads from a real hour later than it is when only from lands in the Berlin fall-back's second pass", () => {
    // now is UTC 02:10, an hour after the UTC 01:00 fall-back — unambiguously CET, 03:10 local, the
    // repeated hour already behind it. The real hour before it, UTC 01:10, is still past the UTC
    // 01:00 transition too, so it reads the *second* (CET) pass of the repeated hour: from prints
    // "02:10". A standard conversion of "02:10" defaults to its *first* pass (CEST, the earlier
    // instant) — one real hour before where this from actually was — so a caller's round trip reads
    // this range as 2 hours long, not 1.
    const now = new Date("2026-10-25T02:10:00Z")

    const range = rangeForTimePreset("last-hour", { now, timeZone: "Europe/Berlin" })

    expect(range).toEqual({ from: "2026-10-25T02:10", to: "2026-10-25T03:10" })
    expect(isValidDateTimeRange(range)).toBe(true)
    expect(roundTripHours(range, "Europe/Berlin")).toBe(2)
  })

  it("reads back as 23 hours when only to lands in the Berlin fall-back's second pass", () => {
    // now is UTC 01:30 on the fall-back day: CET, the second 02:30. Twenty-four real hours before it
    // is UTC 01:30 the day before, 03:30 CEST. A standard conversion reads "02:30" as its first,
    // earlier pass, an hour before where to really was, so the round trip is 23 hours.
    const now = new Date("2026-10-25T01:30:00Z")

    const range = rangeForTimePreset("last-24-hours", { now, timeZone: "Europe/Berlin" })

    expect(range).toEqual({ from: "2026-10-24T03:30", to: "2026-10-25T02:30" })
    expect(roundTripHours(range, "Europe/Berlin")).toBe(23)
  })

  it("reads back as 25 hours when only from lands in the Berlin fall-back's second pass", () => {
    // now is UTC 01:30 the day after the fall-back, 02:30 CET. Twenty-four real hours before it is
    // UTC 01:30 on the fall-back day: the second 02:30. The conversion reads from as the first pass,
    // an hour earlier than it was, so the round trip is 25 hours.
    const now = new Date("2026-10-26T01:30:00Z")

    const range = rangeForTimePreset("last-24-hours", { now, timeZone: "Europe/Berlin" })

    expect(range).toEqual({ from: "2026-10-25T02:30", to: "2026-10-26T02:30" })
    expect(roundTripHours(range, "Europe/Berlin")).toBe(25)
  })
})

describe("isValidDateTimeRange", () => {
  it("accepts an ordered range and a range whose ends read the same minute", () => {
    expect(isValidDateTimeRange({ from: "2026-08-01T09:00", to: "2026-08-01T18:00" })).toBe(true)
    expect(isValidDateTimeRange({ from: "2026-08-01T09:00", to: "2026-08-01T09:00" })).toBe(true)
  })

  it("rejects a reversed range", () => {
    expect(isValidDateTimeRange({ from: "2026-08-01T18:00", to: "2026-08-01T09:00" })).toBe(false)
  })

  it("rejects a value with no time of day, or malformed", () => {
    expect(isValidDateTimeRange({ from: "2026-08-01", to: "2026-08-01T18:00" })).toBe(false)
    expect(isValidDateTimeRange({ from: "2026-08-01T9:00", to: "2026-08-01T18:00" })).toBe(false)
    expect(isValidDateTimeRange({ from: "", to: "" })).toBe(false)
  })

  it("rejects a day the calendar does not have", () => {
    expect(isValidDateTimeRange({ from: "2026-02-31T09:00", to: "2026-02-31T18:00" })).toBe(false)
  })

  it("rejects an hour or minute the clock does not have", () => {
    expect(isValidDateTimeRange({ from: "2026-08-01T24:00", to: "2026-08-01T23:00" })).toBe(false)
    expect(isValidDateTimeRange({ from: "2026-08-01T09:60", to: "2026-08-01T23:00" })).toBe(false)
  })

  it("accepts a wall time that never occurs, the hour a zone skips in spring", () => {
    // 2026-03-29T02:30 never happens in Europe/Berlin — the clock jumps straight from 01:59:59 to
    // 03:00:00 — but this function is never told which zone a value is meant for, so it has no way
    // to know that and does not try: it checks the string's shape and the calendar date only.
    expect(isValidDateTimeRange({ from: "2026-03-29T02:30", to: "2026-03-29T04:00" })).toBe(true)
  })
})

describe("presetForTimeRange", () => {
  const now = new Date("2026-08-23T12:00:00Z")

  it("names the preset a range came from", () => {
    expect(
      presetForTimeRange({ from: "2026-08-23T11:00", to: "2026-08-23T12:00" }, {
        now,
        timeZone: "UTC",
      }),
    )
      .toBe("last-hour")
    expect(
      presetForTimeRange({ from: "2026-08-22T12:00", to: "2026-08-23T12:00" }, {
        now,
        timeZone: "UTC",
      }),
    ).toBe("last-24-hours")
  })

  it("returns undefined for a range neither preset describes", () => {
    expect(
      presetForTimeRange({ from: "2026-08-23T10:00", to: "2026-08-23T12:00" }, {
        now,
        timeZone: "UTC",
      }),
    ).toBeUndefined()
  })

  it("returns undefined for an invalid range", () => {
    expect(
      presetForTimeRange({ from: "2026-08-23T12:00", to: "2026-08-23T11:00" }, {
        now,
        timeZone: "UTC",
      }),
    ).toBeUndefined()
  })

  it("honours a caller-supplied candidate list", () => {
    const range: DateTimeRange = { from: "2026-08-22T12:00", to: "2026-08-23T12:00" }
    const options = { now, timeZone: "UTC", presets: ["last-hour"] as const }

    expect(presetForTimeRange(range, options)).toBeUndefined()
  })

  it("resolves the candidates in the caller's zone", () => {
    const range: DateTimeRange = { from: "2026-08-23T20:00", to: "2026-08-23T21:00" }

    expect(presetForTimeRange(range, { now, timeZone: "Asia/Tokyo" })).toBe("last-hour")
    expect(presetForTimeRange(range, { now, timeZone: "UTC" })).toBeUndefined()
  })

  it("resolves the preset whose range matches, for every declared preset", () => {
    for (const preset of timeRangePresets) {
      const range = rangeForTimePreset(preset, { now, timeZone: "Europe/Berlin" })

      expect(presetForTimeRange(range, { now, timeZone: "Europe/Berlin" })).toBe(preset)
    }
  })
})
