import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  addDaysIso,
  dayInMonth,
  dayLabel,
  daysInMonth,
  localeFirstWeekday,
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

  it("rejects a day the calendar does not have, rather than rolling it over", () => {
    // `Date.parse` answers 2 March for this and says nothing, which is how a grid anchored on it
    // used to draw a month nobody asked for.
    expect(() => addDaysIso("2026-02-30", 1)).toThrow("expected a date the calendar has")
    expect(() => addDaysIso("2026-04-31", 1)).toThrow("expected a date the calendar has")
    expect(() => addDaysIso("2026-13-01", 1)).toThrow("expected a date the calendar has")
    expect(() => addDaysIso("2026-02-00", 1)).toThrow("expected a date the calendar has")
  })

  it("accepts the leap day of a leap year and refuses it in a common one", () => {
    expect(addDaysIso("2028-02-29", 0)).toBe("2028-02-29")
    expect(() => addDaysIso("2026-02-29", 0)).toThrow("expected a date the calendar has")
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

  it("counts from whichever day the week starts on", () => {
    // 2026-08-01 is a Saturday: five cells lead it in a Monday-first week, six in a Sunday-first
    // one, and none at all when the week itself starts on Saturday.
    expect(monthFirstWeekday("2026-08-01", 1)).toBe(5)
    expect(monthFirstWeekday("2026-08-01", 7)).toBe(6)
    expect(monthFirstWeekday("2026-08-01", 6)).toBe(0)
  })
})

describe("daysInMonth", () => {
  it("counts the days of the month a date falls in", () => {
    expect(daysInMonth("2026-08-23")).toBe(31)
    expect(daysInMonth("2026-04-01")).toBe(30)
    expect(daysInMonth("2026-02-10")).toBe(28)
    expect(daysInMonth("2028-02-10")).toBe(29)
  })
})

describe("dayInMonth", () => {
  it("keeps the day number when the target month has it", () => {
    expect(dayInMonth("2026-08-01", 23)).toBe("2026-08-23")
  })

  it("clips to the last day the month has", () => {
    expect(dayInMonth("2026-02-01", 31)).toBe("2026-02-28")
    expect(dayInMonth("2028-02-01", 31)).toBe("2028-02-29")
  })

  it("clips a day number below the first", () => {
    expect(dayInMonth("2026-08-15", 0)).toBe("2026-08-01")
  })
})

describe("localeFirstWeekday", () => {
  it("reads the first day of the week out of the locale", () => {
    expect(localeFirstWeekday("en-GB")).toBe(1) // Monday
    expect(localeFirstWeekday("en-US")).toBe(7) // Sunday
    expect(localeFirstWeekday("ar-EG")).toBe(6) // Saturday
  })

  it("falls back to Monday for a tag it cannot read", () => {
    expect(localeFirstWeekday("not a locale")).toBe(1)
  })
})

describe("dayLabel", () => {
  it("writes the date the way the locale writes it", () => {
    expect(dayLabel("2026-08-23")).toBe("23 August 2026")
    expect(dayLabel("2026-08-23", "fr-FR")).toBe("23 août 2026")
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
  it("returns seven labels starting on the locale's first day", () => {
    const labels = weekdayLabels()

    expect(labels).toHaveLength(7)
    expect(labels[0]).toEqual({ short: "Mon", long: "Monday" })
    expect(labels[6]).toEqual({ short: "Sun", long: "Sunday" })
  })

  it("follows the locale's language", () => {
    expect(weekdayLabels("de-DE")[0].long).toBe("Montag")
  })

  it("reorders the week for a locale that does not start it on Monday", () => {
    expect(weekdayLabels("en-US")[0]).toEqual({ short: "Sun", long: "Sunday" })
    expect(weekdayLabels("en-US")[6]).toEqual({ short: "Sat", long: "Saturday" })
  })

  it("abbreviates the way the locale does, leaving seven distinguishable columns", () => {
    // Every Arabic weekday opens with the same two characters, so a two-character cut leaves one
    // label repeated seven times; Vietnamese leaves six of seven reading `Th`.
    for (const locale of ["ar-EG", "he-IL", "vi-VN", "en-GB"]) {
      const shorts = weekdayLabels(locale).map((weekday) => weekday.short)
      expect(new Set(shorts).size).toBe(7)
    }
  })
})
