import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  groupSlotsByPeriod,
  periodFor,
  type TimeSlot,
  timeSlotPeriodLabels,
  TimeSlots,
} from "./time-slots.tsx"

const DATE = "2026-08-27"

const SLOTS: TimeSlot[] = [
  { time: "09:00", available: true },
  { time: "13:00", available: false },
  { time: "18:30", available: true },
]

/** The chip labels, in document order. */
function chips(html: string): string[] {
  return [...html.matchAll(/<span[^>]*>(\d\d:\d\d)<\/span>|<(?:a|button)[^>]*>(\d\d:\d\d)</g)]
    .map((match) => match[1] ?? match[2])
}

describe("periodFor", () => {
  it("buckets the morning window", () => {
    expect(periodFor("05:00")).toBe("morning")
    expect(periodFor("11:59")).toBe("morning")
  })

  it("buckets the afternoon window", () => {
    expect(periodFor("12:00")).toBe("afternoon")
    expect(periodFor("16:59")).toBe("afternoon")
  })

  it("buckets the evening window", () => {
    expect(periodFor("17:00")).toBe("evening")
    expect(periodFor("23:59")).toBe("evening")
  })

  it("wraps the small hours into the evening bucket", () => {
    expect(periodFor("00:00")).toBe("evening")
    expect(periodFor("04:59")).toBe("evening")
  })

  it("moves 04:59 → 05:00 across the boundary", () => {
    expect(periodFor("04:59")).toBe("evening")
    expect(periodFor("05:00")).toBe("morning")
  })

  it("rejects a string that is not a time", () => {
    expect(() => periodFor("morning")).toThrow("expected an HH:MM time")
  })
})

describe("groupSlotsByPeriod", () => {
  it("returns non-empty periods in morning → afternoon → evening order", () => {
    const groups = groupSlotsByPeriod([
      { time: "19:00", available: true },
      { time: "09:00", available: true },
      { time: "13:00", available: true },
    ])

    expect(groups.map((group) => group.period)).toEqual(["morning", "afternoon", "evening"])
  })

  it("keeps insertion order inside a period", () => {
    const groups = groupSlotsByPeriod([
      { time: "11:00", available: true },
      { time: "09:00", available: true },
    ])

    expect(groups[0].slots.map((slot) => slot.time)).toEqual(["11:00", "09:00"])
  })

  it("groups by displayTime when the visitor's zone is known", () => {
    const groups = groupSlotsByPeriod([{ time: "23:00", displayTime: "08:00", available: true }])

    expect(groups).toHaveLength(1)
    expect(groups[0].period).toBe("morning")
  })

  it("drops empty periods entirely", () => {
    const groups = groupSlotsByPeriod([{ time: "13:00", available: true }])

    expect(groups).toHaveLength(1)
    expect(groups[0].period).toBe("afternoon")
  })

  it("returns nothing for no slots", () => {
    expect(groupSlotsByPeriod([])).toEqual([])
  })
})

describe("TimeSlots", () => {
  it("renders the empty state with the date label", () => {
    const html = render(<TimeSlots date={DATE} dateLabel="Thursday, 27 August 2026" slots={[]} />)

    expect(html).toContain("No available times on Thursday, 27 August 2026.")
    expect(html).not.toContain("Morning")
  })

  it("takes a custom empty message", () => {
    const html = render(
      <TimeSlots
        date={DATE}
        dateLabel="Thursday"
        slots={[]}
        emptyMessage="Nothing free that day."
      />,
    )

    expect(html).toContain("Nothing free that day.")
  })

  it("groups chips under period headings", () => {
    const html = render(<TimeSlots date={DATE} dateLabel="Thursday" slots={SLOTS} />)

    expect(html).toContain(timeSlotPeriodLabels.morning)
    expect(html).toContain(timeSlotPeriodLabels.afternoon)
    expect(html).toContain(timeSlotPeriodLabels.evening)
    expect(chips(html)).toEqual(["09:00", "13:00", "18:30"])
  })

  it("renders available chips as anchors without a select handler", () => {
    const html = render(
      <TimeSlots date={DATE} dateLabel="Thursday" slots={[{ time: "09:00", available: true }]} />,
    )

    // `&` is attribute-escaped by the renderer, `:` percent-encoded by the default href builder.
    expect(html).toContain('<a href="?date=2026-08-27&amp;slot=09%3A00"')
    expect(html).not.toContain("<button")
  })

  it("renders available chips as buttons with a select handler", () => {
    const html = render(
      <TimeSlots
        date={DATE}
        dateLabel="Thursday"
        slots={[{ time: "09:00", available: true }]}
        onSelectSlot={() => {}}
      />,
    )

    expect(html).toContain('<button type="button"')
    expect(html).not.toContain("<a ")
  })

  it("takes a custom href builder", () => {
    const html = render(
      <TimeSlots
        date={DATE}
        dateLabel="Thursday"
        slots={[{ time: "09:00", available: true }]}
        slotHref={(date, slot) => `/book/${date}/${slot}`}
      />,
    )

    expect(html).toContain('href="/book/2026-08-27/09:00"')
  })

  it("renders a booked chip as a non-interactive span", () => {
    const html = render(
      <TimeSlots date={DATE} dateLabel="Thursday" slots={[{ time: "13:00", available: false }]} />,
    )

    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('title="Already booked"')
    expect(html).not.toContain("<a ")
    expect(html).not.toContain("<button")
  })

  it("renders the selected chip as marked and non-interactive", () => {
    const html = render(
      <TimeSlots
        date={DATE}
        dateLabel="Thursday"
        slots={[{ time: "09:00", available: true }]}
        selectedSlot="09:00"
      />,
    )

    expect(html).toContain('aria-current="true"')
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<a ")
  })

  it("shows the visitor-zone time when the caller supplies one", () => {
    const html = render(
      <TimeSlots
        date={DATE}
        dateLabel="Thursday"
        slots={[{ time: "23:00", displayTime: "08:00", available: true }]}
      />,
    )

    expect(chips(html)).toEqual(["08:00"])
    expect(html).not.toContain("23:00")
  })

  it("takes period label overrides", () => {
    const html = render(
      <TimeSlots
        date={DATE}
        dateLabel="Thursday"
        slots={[{ time: "09:00", available: true }]}
        periodLabels={{ morning: "Vormittag" }}
      />,
    )

    expect(html).toContain("Vormittag")
    expect(html).not.toContain("Morning")
  })

  it("keeps the caller's utilities alongside the frame", () => {
    const html = render(
      <TimeSlots date={DATE} dateLabel="Thursday" slots={SLOTS} class="rounded-none" />,
    )

    expect(html).toContain("rounded-none")
    expect(html).not.toContain("rounded-2xl")
  })
})
