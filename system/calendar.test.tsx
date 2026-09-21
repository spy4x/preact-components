import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Calendar, type CalendarProps } from "./calendar.tsx"
import { addDaysIso, weekdayLabels } from "./date.ts"

const MONTH = "2026-08-01"
const MIN = "2026-08-03"
const MAX = "2026-09-30"

/**
 * A month where every in-horizon day is bookable.
 *
 * Two days carry deliberate states: `full` (0 slots left) and `gone` (absent from the map, so no
 * availability at all).
 */
const slotsByDate: Record<string, number> = {}
for (let date = MIN; date <= MAX; date = addDaysIso(date, 1)) slotsByDate[date] = 3
slotsByDate["2026-08-12"] = 0
delete slotsByDate["2026-08-19"]

const base: CalendarProps = {
  monthAnchor: MONTH,
  minDate: MIN,
  maxDate: MAX,
  slotsByDate,
  today: "2026-08-10",
}

/**
 * Dates a reader can pick, in document order.
 *
 * Read off the element rather than off the accessible label, which is localised prose: a bookable
 * day is the one rendered as a link or a button, and a day that cannot be picked is a `<span>`.
 */
function bookableDates(html: string): string[] {
  return [...html.matchAll(/<(?:a|button)[^>]*data-calendar-date="(\d{4}-\d{2}-\d{2})"/g)]
    .map((match) => match[1])
}

/** The text of every column header, in column order. */
function columnHeaders(html: string): string[] {
  return [...html.matchAll(/role="columnheader"[^>]*>([^<]+)</g)].map((match) => match[1])
}

/**
 * Day numbers of the peek cells, in document order.
 *
 * Matched through the cell's own wrapper rather than on `aria-hidden` alone: the scarcity dot
 * carries that attribute too, and counting those instead is how this reads 39 cells in a
 * thirty-one-day month.
 */
function peekDays(html: string): string[] {
  return [...html.matchAll(/aria-hidden="true"[^>]*><div[^>]*>(\d\d)</g)].map((match) => match[1])
}

/**
 * Day numbers of the peek cells that lead the grid, before the 1st of the month.
 *
 * How many there are is the whole of the column alignment: it is the weekday the month opens on,
 * counted from the week's own first day, and a six-week grid always holds eleven peek cells for a
 * thirty-one-day month however they are split between the two ends.
 */
function leadingPeekDays(html: string): string[] {
  const firstOfMonth = html.indexOf("data-calendar-date=")
  return [...html.matchAll(/aria-hidden="true"[^>]*><div[^>]*>(\d\d)</g)]
    .filter((match) => (match.index ?? 0) < firstOfMonth)
    .map((match) => match[1])
}

describe("Calendar", () => {
  it("renders a six-week grid with a Monday-first header", () => {
    const html = render(<Calendar {...base} />)

    expect(html.match(/>\d\d</g)).toHaveLength(42) // six weeks of day cells
    expect(html).toContain("August 2026")
    expect(columnHeaders(html)[0]).toBe("Mon")
    expect(columnHeaders(html)[6]).toBe("Sun")
  })

  it("peeks into the previous month with hidden leading cells", () => {
    const html = render(<Calendar {...base} />)

    // 2026-08-01 is a Saturday: five July days lead the grid, six September days close it, and
    // none of the eleven are in the accessibility tree.
    const hidden = peekDays(html)
    expect(hidden).toHaveLength(11)
    expect(hidden.slice(0, 5).join(" ")).toBe("27 28 29 30 31")
    expect(hidden.slice(5).join(" ")).toBe("01 02 03 04 05 06")
  })

  it("puts the horizon boundary in the grid as the first bookable day", () => {
    const html = render(<Calendar {...base} />)

    // 08-01/08-02 are before `minDate`, so they are inert; bookable days are links or buttons.
    expect(bookableDates(html)[0]).toBe("2026-08-03")
  })

  it("renders bookable days as anchors without a select handler", () => {
    const html = render(<Calendar {...base} />)

    expect(html).toContain('<a href="?date=2026-08-10"')
    expect(html).not.toContain("<button")
  })

  it("renders bookable days as buttons when a select handler is supplied", () => {
    const html = render(<Calendar {...base} onSelectDate={() => {}} />)

    expect(html).toContain('<button type="button"')
    expect(html).not.toContain('href="?date=')
  })

  it("uses a custom href builder in link mode", () => {
    const html = render(
      <Calendar {...base} dateHref={(date) => `/book?date=${date}`} />,
    )

    expect(html).toContain('href="/book?date=2026-08-10"')
  })

  it("greys out days before the horizon and describes them as past", () => {
    const html = render(<Calendar {...base} />)

    expect(html).toContain('aria-label="2 August 2026 — past"')
    expect(html).not.toContain('href="?date=2026-08-02"')
  })

  it("greys out days after the horizon", () => {
    const html = render(<Calendar {...base} minDate="2026-08-03" maxDate="2026-08-15" />)

    expect(html).toContain('aria-label="16 August 2026 — outside the allowed range"')
    expect(html).not.toContain('href="?date=2026-08-16"')
    expect(html).toContain('href="?date=2026-08-15"')
  })

  it("distinguishes a day with no slots left from a day with no availability", () => {
    const html = render(<Calendar {...base} />)

    expect(html).toContain('aria-label="12 August 2026 — no slots left"')
    expect(html).toContain('aria-label="19 August 2026 — no times available"')
    expect(html).toContain("line-through")
  })

  it("counts the remaining slots in the accessible label", () => {
    const html = render(<Calendar {...base} slotsByDate={{ "2026-08-05": 1 }} />)

    expect(html).toContain('aria-label="5 August 2026 — 1 slot available"')
  })

  it("marks the selected day with aria-current and the accent", () => {
    const html = render(<Calendar {...base} selectedDate="2026-08-20" />)

    expect(html).toContain('aria-current="date"')
    expect(html).toContain("bg-purple-900")
    expect(html).toMatch(/aria-label="20 August 2026[^"]*"[^>]*aria-current="date"/)
  })

  it("lays out always six weeks, whatever the month's length", () => {
    for (const anchor of ["2026-02-01", "2026-08-01", "2028-02-01"]) {
      const html = render(<Calendar {...base} monthAnchor={anchor} />)
      const inGrid = html.match(/>\d\d</g) ?? []
      expect(inGrid.length).toBe(42)
    }
  })

  it("switches the month arrows to buttons with a handler", () => {
    const html = render(<Calendar {...base} onSelectMonth={() => {}} />)

    expect(html).toContain('aria-label="Previous month: July 2026"')
    expect(html).toContain('aria-label="Next month: September 2026"')
  })

  it("links the month arrows in link mode", () => {
    const html = render(<Calendar {...base} monthAnchor="2026-08-01" minDate="2026-07-01" />)

    expect(html).toContain('href="?month=2026-07-01"')
    expect(html).toContain('href="?month=2026-09-01"')
  })

  it("renders a dead month arrow as an inert span, not a navigable link", () => {
    const html = render(<Calendar {...base} />)

    // July 2026 is before the horizon and holds no slots, so the arrow is inert — a disabled
    // anchor would still be focusable and still navigable with Enter.
    expect(html).toContain('<span aria-disabled="true" aria-label="Previous month: July 2026"')
    expect(html).not.toContain('href="?month=2026-07-01"')
    expect(html).not.toContain('aria-label="Previous month: July 2026" disabled')
  })

  it("keeps an arrow live while its month still holds a stray slot", () => {
    const html = render(
      <Calendar
        {...base}
        monthAnchor="2026-11-01"
        minDate="2026-11-02"
        maxDate="2026-11-30"
        slotsByDate={{ "2026-10-30": 2 }}
      />,
    )

    expect(html).toContain('href="?month=2026-10-01"')
  })

  it("hides the forward arrow once the horizon is behind the anchor", () => {
    const html = render(
      <Calendar {...base} monthAnchor="2026-10-01" minDate="2026-08-03" maxDate="2026-09-30" />,
    )
    expect(html).toContain('<span aria-disabled="true" aria-label="Next month: November 2026"')
    expect(html).not.toContain('href="?month=2026-11-01"')
  })

  it("takes copy overrides", () => {
    const html = render(
      <Calendar
        {...base}
        labels={{
          day: (day) => `${day.date} ${day.disabled ? "no" : "yes"}`,
          previousMonth: "Zurück",
          nextMonth: "Weiter",
        }}
      />,
    )

    expect(html).toContain('aria-label="2026-08-10 yes"')
    expect(html).toContain("Zurück")
    expect(html).toContain("Weiter")
  })

  it("draws a scarcity dot only below the threshold", () => {
    const scarce = render(<Calendar {...base} slotsByDate={{ "2026-08-05": 2 }} />)
    const plenty = render(<Calendar {...base} slotsByDate={{ "2026-08-05": 9 }} />)

    expect(scarce).toContain("rounded-full")
    expect(plenty).not.toContain("rounded-full")
  })

  it("honours a custom scarcity threshold", () => {
    const html = render(
      <Calendar {...base} slotsByDate={{ "2026-08-05": 5 }} lowSlotsThreshold={5} />,
    )

    expect(html).toContain("rounded-full")
  })

  it("keeps the caller's utilities and lets them win over the frame", () => {
    const html = render(<Calendar {...base} class="rounded-none shadow-none" />)

    expect(html).toContain("shadow-none")
    expect(html).toContain("rounded-none")
    expect(html).not.toContain("rounded-2xl")
  })

  it("stays server-renderable without a today prop", () => {
    const html = render(
      <Calendar monthAnchor={MONTH} minDate={MIN} maxDate={MAX} slotsByDate={slotsByDate} />,
    )

    expect(html).toContain("August 2026")
    expect(bookableDates(html).length).toBeGreaterThan(0)
  })
})

describe("Calendar, as a screen reader is told about it", () => {
  it("announces the days as a grid of rows and cells", () => {
    const html = render(<Calendar {...base} />)

    expect(html).toContain('role="grid"')
    expect(html.match(/role="row"/g)).toHaveLength(7) // the header row and six weeks
    expect(html.match(/role="columnheader"/g)).toHaveLength(7)
    expect(html.match(/role="gridcell"/g)).toHaveLength(42)
  })

  it("names the grid after the month it is showing", () => {
    const html = render(<Calendar {...base} />)
    const headingId = html.match(/<h3 id="([^"]+)"/)?.[1]

    expect(headingId).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${headingId}"`)
  })

  it("gives every column header the weekday's full name", () => {
    const html = render(<Calendar {...base} />)

    expect(html).toContain('aria-label="Monday"')
    expect(html).toContain('aria-label="Sunday"')
  })

  it("says why a day cannot be picked, somewhere other than a title attribute", () => {
    const html = render(<Calendar {...base} />)

    expect(html).toContain('aria-label="19 August 2026 — no times available"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain("title=")
  })
})

describe("Calendar, as the locale shapes it", () => {
  it("starts the week on the day the locale starts it on", () => {
    // Monday in the United Kingdom, Sunday in the United States, Saturday in Egypt — the three
    // first days `Intl` reports, all for the same month.
    expect(columnHeaders(render(<Calendar {...base} locale="en-GB" />))[0]).toBe("Mon")
    expect(columnHeaders(render(<Calendar {...base} locale="en-US" />))[0]).toBe("Sun")
    expect(columnHeaders(render(<Calendar {...base} locale="ar-EG" />))[0])
      .toBe(weekdayLabels("ar-EG")[0].short)
  })

  it("aligns the first of the month under its own weekday, whatever the locale", () => {
    // 2026-08-01 is a Saturday: five leading cells in a Monday-first week, six in a Sunday-first
    // one, none at all in a Saturday-first one.
    const leading = (locale: string) =>
      leadingPeekDays(render(<Calendar {...base} locale={locale} />))
    expect(leading("en-GB")).toEqual(["27", "28", "29", "30", "31"])
    expect(leading("en-US")).toEqual(["26", "27", "28", "29", "30", "31"])
    expect(leading("ar-EG")).toEqual([])
  })

  it("writes out weekday names rather than cutting them to two characters", () => {
    // Every Arabic weekday abbreviation opens with the same two characters, so cutting is how six
    // of seven columns came to read alike.
    const headers = columnHeaders(render(<Calendar {...base} locale="ar-EG" />))

    expect(headers).toHaveLength(7)
    expect(new Set(headers).size).toBe(7)
    expect(headers).toEqual(weekdayLabels("ar-EG").map((weekday) => weekday.short))
  })

  it("writes the day labels in the locale's language", () => {
    const html = render(<Calendar {...base} locale="fr-FR" slotsByDate={{ "2026-08-05": 1 }} />)

    expect(html).toContain("5 août 2026")
  })
})

describe("Calendar, given input it cannot use", () => {
  it("falls back to UTC for a time zone the platform does not know", () => {
    const html = render(<Calendar {...base} today={undefined} timeZone="Mars/Phobos" />)

    expect(html).toContain("August 2026")
    expect(bookableDates(html).length).toBeGreaterThan(0)
  })

  it("refuses a month anchor that is not a date the calendar has", () => {
    expect(() => render(<Calendar {...base} monthAnchor="2026-02-30" />))
      .toThrow("expected a date the calendar has")
  })

  it("refuses a month anchor that is not a date at all", () => {
    expect(() => render(<Calendar {...base} monthAnchor="30/02/2026" />))
      .toThrow("expected a YYYY-MM-DD date")
  })
})

describe("Calendar, before it is hydrated", () => {
  it("leaves every day in the natural tab order", () => {
    // The roving tabindex is applied by an effect, because taking Tab away from the cells is only
    // safe once a key handler is there to give the movement back.
    expect(render(<Calendar {...base} />)).not.toContain("tabindex")
  })
})
