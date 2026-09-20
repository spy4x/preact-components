import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Calendar, type CalendarProps } from "./calendar.tsx"
import { addDaysIso } from "./date.ts"

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

/** Day cells carrying an accessible label, in document order. */
function labelledDates(html: string): string[] {
  return [...html.matchAll(/aria-label="(\d{4}-\d{2}-\d{2})/g)].map((match) => match[1])
}

describe("Calendar", () => {
  it("renders a six-week grid with a Monday-first header", () => {
    const html = render(<Calendar {...base} />)

    expect(html.match(/>\d\d</g)).toHaveLength(42) // six weeks of day cells
    expect(html).toContain("August 2026")
    expect(html).toMatch(/>Mo</)
    expect(html).toMatch(/>Su</)
  })

  it("peeks into the previous month with hidden leading cells", () => {
    const html = render(<Calendar {...base} />)

    // 2026-08-01 is a Saturday: five July days lead the grid, six September days close it, and
    // none of the eleven are in the accessibility tree.
    const hidden = [...html.matchAll(/aria-hidden="true"[^>]*>(\d\d)</g)].map((match) => match[1])
    expect(hidden).toHaveLength(11)
    expect(hidden.slice(0, 5).join(" ")).toBe("27 28 29 30 31")
    expect(hidden.slice(5).join(" ")).toBe("01 02 03 04 05 06")
  })

  it("puts the horizon boundary in the grid as the first bookable day", () => {
    const html = render(<Calendar {...base} />)

    // 08-01/08-02 are before `minDate`, so they are inert and described through `title`;
    // bookable days carry the accessible label.
    expect(labelledDates(html)[0]).toBe("2026-08-03")
    expect(html).toContain('title="2026-08-02 — past"')
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

    expect(html).toContain('title="2026-08-02 — past"')
    expect(html).not.toContain('href="?date=2026-08-02"')
  })

  it("greys out days after the horizon", () => {
    const html = render(<Calendar {...base} minDate="2026-08-03" maxDate="2026-08-15" />)

    expect(html).toContain('title="2026-08-16 — outside the allowed range"')
    expect(html).not.toContain('href="?date=2026-08-16"')
    expect(html).toContain('href="?date=2026-08-15"')
  })

  it("distinguishes a day with no slots left from a day with no availability", () => {
    const html = render(<Calendar {...base} />)

    expect(html).toContain('title="2026-08-12 — no slots left"')
    expect(html).toContain('title="2026-08-19 — no times available"')
    expect(html).toContain("line-through")
  })

  it("counts the remaining slots in the accessible label", () => {
    const html = render(<Calendar {...base} slotsByDate={{ "2026-08-05": 1 }} />)

    expect(html).toContain('aria-label="2026-08-05 — 1 slot available"')
  })

  it("marks the selected day with aria-current and the accent", () => {
    const html = render(<Calendar {...base} selectedDate="2026-08-20" />)

    expect(html).toContain('aria-current="date"')
    expect(html).toContain("bg-purple-900")
    expect(html).toMatch(/aria-label="2026-08-20[^"]*"[^>]*aria-current="date"/)
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
    expect(labelledDates(html).length).toBeGreaterThan(0)
  })
})
