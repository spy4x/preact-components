import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { parseQuickAdd, QuickAddPriority } from "@spy4x/platform/universal/quick-add"
import { render } from "preact-render-to-string"
import { quickAddDueLabel, quickAddParts } from "./quick-add-internals.ts"
import { defaultQuickAddLabels, QuickAdd, type QuickAddLabels } from "./quick-add.tsx"

const ZONE = "Asia/Ho_Chi_Minh"
// 01:00 on Sunday 11 October 2026 in Ho Chi Minh (UTC+7), still Saturday the 10th in UTC.
const NOW = new Date("2026-10-10T18:00:00Z")
const parts = (
  line: string,
  options: { labels?: Partial<QuickAddLabels>; dueLabel?: (date: string) => string } = {},
) =>
  quickAddParts(parseQuickAdd(line, { now: NOW, timeZone: ZONE }), {
    now: NOW,
    zone: ZONE,
    labels: { ...defaultQuickAddLabels, ...options.labels },
    dueLabel: options.dueLabel,
  })

describe("quickAddDueLabel", () => {
  it("words the viewer's own today and tomorrow, which are not UTC's", () => {
    expect(quickAddDueLabel("2026-10-11", NOW, ZONE)).toBe("Today")
    expect(quickAddDueLabel("2026-10-12", NOW, ZONE)).toBe("Tomorrow")
    expect(quickAddDueLabel("2026-10-11", NOW, "UTC")).toBe("Tomorrow")
  })

  it("words a day further off as a short weekday, day and month", () => {
    expect(quickAddDueLabel("2026-10-15", NOW, ZONE)).toBe("Thu 15 Oct")
  })
})

describe("quickAddParts", () => {
  it("lists the tags, then the contexts, the due day with its time, and the priority", () => {
    expect(parts("Call Anna !high tomorrow 3pm @phone #work")).toEqual([
      "Tag work",
      "Context phone",
      "Due Tomorrow 15:00",
      "High priority",
    ])
  })

  it("leaves the time out of a due day typed without one", () => {
    expect(parts("Call Anna tomorrow")).toEqual(["Due Tomorrow"])
  })

  it("finds nothing in a plain title", () => {
    expect(parts("Buy oat milk")).toStrictEqual([])
  })

  it("names each priority", () => {
    expect(parts("a !high")).toEqual(["High priority"])
    expect(parts("a !medium")).toEqual(["Medium priority"])
    expect(parts("a !low")).toEqual(["Low priority"])
  })

  it("words the due day with the caller's formatter, given the date, the clock and the zone", () => {
    const seen: unknown[] = []
    const result = quickAddParts(parseQuickAdd("Call tomorrow 3pm", { now: NOW, timeZone: ZONE }), {
      now: NOW,
      zone: ZONE,
      labels: defaultQuickAddLabels,
      dueLabel: (date, now, zone) => {
        seen.push(date, now, zone)
        return "soon"
      },
    })

    expect(result).toEqual(["Due soon 15:00"])
    expect(seen).toEqual(["2026-10-12", NOW, ZONE])
  })

  it("words every kind of part with the caller's labels", () => {
    const result = parts("x #work @phone tomorrow 3pm !low", {
      labels: {
        tag: (name) => `#${name}`,
        context: (name) => `@${name}`,
        due: (day, time) => `${day} at ${time}`,
        priority: (priority) => priority === QuickAddPriority.Low ? "Later" : "Sooner",
      },
    })

    expect(result).toEqual(["#work", "@phone", "Tomorrow at 15:00", "Later"])
  })

  it("shows a time inside a spring-forward gap as typed, not the shifted hour", () => {
    const now = new Date("2027-03-27T12:00:00Z")
    const parsed = parseQuickAdd("Call tomorrow 2:30am", { now, timeZone: "Europe/Berlin" })

    expect(parsed.due).toEqual({ date: "2027-03-28", time: "02:30" })
    expect(quickAddParts(parsed, { now, zone: "Europe/Berlin", labels: defaultQuickAddLabels }))
      .toEqual(["Due Tomorrow 02:30"])
  })
})

describe("QuickAdd", () => {
  it("names the field and the button with the English defaults", () => {
    const html = render(<QuickAdd onAdd={() => {}} zone={ZONE} />)

    expect(html).toContain(`aria-label="New item"`)
    expect(html).toContain(`placeholder="Add an item"`)
    expect(html).toContain(`<span class="sr-only">Add</span>`)
  })

  it("names the field and the button with the caller's wording", () => {
    const html = render(
      <QuickAdd
        onAdd={() => {}}
        zone={ZONE}
        label="Nouvelle note"
        placeholder="Ajouter une note"
        labels={{ submit: "Ajouter" }}
      />,
    )

    expect(html).toContain(`aria-label="Nouvelle note"`)
    expect(html).toContain(`placeholder="Ajouter une note"`)
    expect(html).toContain(`<span class="sr-only">Ajouter</span>`)
  })

  it("starts valid, with no badges and an empty polite live region", () => {
    const html = render(<QuickAdd onAdd={() => {}} zone={ZONE} />)

    expect(html).not.toContain(`data-e2e="quick-add-chips"`)
    expect(html).not.toContain("aria-invalid")
    expect(html).toContain(
      `<p class="sr-only" role="status" aria-live="polite" data-e2e="quick-add-live"></p>`,
    )
  })

  it("shows the hint and points the field at it", () => {
    const html = render(<QuickAdd onAdd={() => {}} zone={ZONE} hint="Added to Errands" />)
    const id = html.match(/aria-describedby="([^"]+)"/)?.[1]

    expect(id).toBeTruthy()
    expect(html).toContain(`<p id="${id}" class="text-sm text-muted">Added to Errands</p>`)
  })

  it("hands a hint function the parsed line", () => {
    const html = render(
      <QuickAdd
        onAdd={() => {}}
        zone={ZONE}
        hint={(parsed) => parsed.due ? "dated" : "undated"}
      />,
    )

    expect(html).toContain(">undated</p>")
  })

  it("points the field at nothing when there is no hint", () => {
    expect(render(<QuickAdd onAdd={() => {}} zone={ZONE} />)).not.toContain("aria-describedby")
  })

  it("gives two quick adds on a page their own hint ids", () => {
    const html = render(
      <div>
        <QuickAdd onAdd={() => {}} zone={ZONE} hint="One" />
        <QuickAdd onAdd={() => {}} zone={ZONE} hint="Two" />
      </div>,
    )
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1])

    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it("makes the field read-only and turns the button off while busy", () => {
    const idle = render(<QuickAdd onAdd={() => {}} zone={ZONE} />)
    const busy = render(<QuickAdd onAdd={() => {}} zone={ZONE} busy />)

    expect(idle).not.toMatch(/<input[^>]* readonly[ >]/)
    expect(idle).not.toMatch(/<button[^>]* disabled[ >]/)
    expect(busy).toMatch(/<input[^>]* readonly[ >]/)
    expect(busy).toMatch(/<button[^>]* disabled[ >]/)
  })

  it("prefixes every hook with the caller's data-e2e", () => {
    const html = render(<QuickAdd onAdd={() => {}} zone={ZONE} dataE2E="note-add" />)

    for (const hook of ["note-add", "note-add-input", "note-add-submit", "note-add-live"]) {
      expect(html).toContain(`data-e2e="${hook}"`)
    }
    expect(html).not.toContain(`data-e2e="quick-add`)
  })
})
