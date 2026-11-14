import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Timeline, type TimelineItem } from "./timeline.tsx"

const ITEMS: TimelineItem[] = [
  {
    id: 2,
    title: "Blocked by an operator",
    at: "2026-03-04T10:15:00.000Z",
    when: "Mar 4, 10:15",
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

  it("marks each time with its exact instant and prints the caller's words", () => {
    const html = render(<Timeline items={ITEMS} />)
    expect(html).toContain('datetime="2026-03-04T10:15:00.000Z">Mar 4, 10:15</time>')
    expect(html).toContain('datetime="2026-03-03T08:00:00.000Z">yesterday</time>')
  })

  it("shows a description only for an entry that has one", () => {
    const html = render(<Timeline items={ITEMS} />)
    expect(html).toContain("from 203.0.113.7")
    expect(html.match(/wrap-anywhere/g)?.length).toBe(1)
  })

  it("shows a description of 0, which is a value and not a missing one", () => {
    const html = render(<Timeline items={[{ ...ITEMS[1], description: 0 }]} />)
    expect(html).toContain('<div class="text-sm text-muted wrap-anywhere">0</div>')
  })

  it("colours each dot by its tone, neutral by default, hidden from assistive tech", () => {
    const html = render(<Timeline items={ITEMS} />)
    expect(html).toMatch(/aria-hidden="true" data-timeline-dot="danger" class="[^"]*bg-danger/)
    expect(html).toMatch(
      /aria-hidden="true" data-timeline-dot="neutral" class="[^"]*bg-track/,
    )
  })

  it("joins the entries with a line hidden from assistive tech that stops at the last one", () => {
    const html = render(<Timeline items={ITEMS} />)
    expect(html.match(/data-timeline-line/g)?.length).toBe(1)
    expect(html).toContain('<span aria-hidden="true" data-timeline-line class=')
    expect(render(<Timeline items={[ITEMS[0]]} />)).not.toContain("data-timeline-line")
  })

  it("shows the empty text and no list when there is nothing", () => {
    const html = render(<Timeline items={[]} empty="Nothing recorded." dataE2E="audits" />)
    expect(html).not.toContain("<ol")
    expect(html).toContain('data-e2e="audits">Nothing recorded.</p>')
    expect(render(<Timeline items={[]} />)).toContain(">Nothing yet.</p>")
  })
})

describe("Timeline live", () => {
  it("starts following on its own: the Following state with a dot that pulses only when motion is allowed, and Pause", () => {
    const html = render(<Timeline live items={ITEMS} />)
    expect(html).toContain(`data-timeline-state="following"`)
    expect(html).toMatch(
      /<span aria-hidden="true" class="[^"]*motion-safe:animate-pulse[^"]*"><\/span>Following<\/span>/,
    )
    expect(html).not.toMatch(/ animate-pulse/)
    expect(html).toMatch(/<button[^>]*>Pause<\/button>/)
  })

  it("shows the caller's following state over its own: Paused, no dot, and Follow", () => {
    const html = render(<Timeline live following={false} items={ITEMS} />)
    expect(html).toContain(`data-timeline-state="paused"`)
    expect(html).not.toContain("animate-pulse")
    expect(html).toMatch(/>Paused<\/span>/)
    expect(html).toMatch(/<button[^>]*>Follow<\/button>/)
  })

  it("makes the toolbar button 44 px tall on a phone and 36 px from sm", () => {
    const html = render(<Timeline live items={ITEMS} />)
    expect(html).toMatch(/<button[^>]*class="[^"]*min-h-9 max-sm:min-h-11[^"]*"[^>]*>Pause/)
  })

  it("renders an empty polite live region from the start, so the first announcement is heard", () => {
    const html = render(<Timeline live items={ITEMS} />)
    expect(html).toContain(`<div aria-live="polite" class="sr-only" data-timeline-announcer></div>`)
    expect(render(<Timeline items={ITEMS} />)).not.toContain("aria-live")
  })

  it("lists the entries in a named list with an end marker, and no new-events button yet", () => {
    const html = render(<Timeline live label="Run" items={ITEMS} dataE2E="run" />)
    expect(html).toMatch(/<div class="flex flex-col gap-3" data-e2e="run">/)
    expect(html).toContain(`aria-label="Run"`)
    expect(html).toContain(`data-timeline-end`)
    expect(html).not.toContain("data-timeline-jump")
  })

  it("shows the empty text with the toolbar when there is nothing yet, and no list", () => {
    const html = render(<Timeline live items={[]} empty="Waiting for the run." />)
    expect(html).not.toContain("<ol")
    expect(html).toContain(">Waiting for the run.</p>")
    expect(html).toMatch(/>Pause<\/button>/)
    expect(html).toContain("data-timeline-end")
  })

  it("takes each word from its labels prop", () => {
    const html = render(
      <Timeline live items={ITEMS} labels={{ following: "Läuft", pause: "Anhalten" }} />,
    )
    expect(html).toContain(">Läuft</span>")
    expect(html).toMatch(/>Anhalten<\/button>/)
  })
})
