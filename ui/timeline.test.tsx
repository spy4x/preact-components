import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Timeline, type TimelineItem, timelineTime } from "./timeline.tsx"

const ITEMS: TimelineItem[] = [
  {
    id: 2,
    title: "Blocked by an operator",
    at: "2026-03-04T10:15:00.000Z",
    description: "from 203.0.113.7",
    tone: "danger",
    dataE2E: "event-blocked",
  },
  { id: 1, title: "Signed in", at: "2026-03-03T08:00:00.000Z", when: "yesterday" },
]

describe("Timeline", () => {
  it("lists every entry in order in a named ordered list", () => {
    const html = render(<Timeline items={ITEMS} label="Activity" />)
    expect(html).toContain('<ol aria-label="Activity"')
    expect(html.indexOf("Blocked by an operator")).toBeLessThan(html.indexOf("Signed in"))
    expect(html.match(/<li /g)?.length).toBe(2)
    expect(html).toContain('data-e2e="event-blocked"')
  })

  it("names the list Timeline when the caller gives no name", () => {
    expect(render(<Timeline items={ITEMS} />)).toContain('<ol aria-label="Timeline"')
  })

  it("marks each time with its exact instant, and prints the caller's words or the date", () => {
    const html = render(<Timeline items={ITEMS} />)
    expect(html).toContain('datetime="2026-03-04T10:15:00.000Z">Mar 4, 2026, 10:15 AM</time>')
    expect(html).toContain('datetime="2026-03-03T08:00:00.000Z">yesterday</time>')
  })

  it("prints a default time in the zone it is given", () => {
    const html = render(<Timeline items={[ITEMS[0]]} timeZone="Asia/Bangkok" />)
    expect(html).toContain(">Mar 4, 2026, 5:15 PM</time>")
  })

  it("shows a description only for an entry that has one", () => {
    const html = render(<Timeline items={ITEMS} />)
    expect(html).toContain("from 203.0.113.7")
    expect(html.match(/wrap-anywhere/g)?.length).toBe(1)
  })

  it("colours each dot by its tone, neutral by default, hidden from assistive tech", () => {
    const html = render(<Timeline items={ITEMS} />)
    expect(html).toMatch(/aria-hidden="true" data-timeline-dot="danger" class="[^"]*bg-danger/)
    expect(html).toMatch(
      /aria-hidden="true" data-timeline-dot="neutral" class="[^"]*bg-track/,
    )
  })

  it("joins the entries with a line that stops at the last one", () => {
    expect(render(<Timeline items={ITEMS} />).match(/data-timeline-line/g)?.length).toBe(1)
    expect(render(<Timeline items={[ITEMS[0]]} />)).not.toContain("data-timeline-line")
  })

  it("shows the empty text and no list when there is nothing", () => {
    const html = render(<Timeline items={[]} empty="Nothing recorded." dataE2E="audits" />)
    expect(html).not.toContain("<ol")
    expect(html).toContain('data-e2e="audits">Nothing recorded.</p>')
    expect(render(<Timeline items={[]} />)).toContain(">Nothing yet.</p>")
  })
})

describe("timelineTime", () => {
  it("prints an instant as a medium date and a short time, in UTC by default", () => {
    expect(timelineTime("2026-03-04T23:30:00Z")).toBe("Mar 4, 2026, 11:30 PM")
    expect(timelineTime("2026-03-04T23:30:00Z", "Asia/Bangkok")).toBe("Mar 5, 2026, 6:30 AM")
  })

  it("prints a value that is no date as it came", () => {
    expect(timelineTime("soon")).toBe("soon")
  })
})
