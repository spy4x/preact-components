import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DashboardGrid, dashboardRows, WidgetCard, WidgetStat } from "./widget-card.tsx"

const card = (props: Partial<Parameters<typeof WidgetCard>[0]> = {}) =>
  render(
    <WidgetCard
      title="Notes"
      status="ready"
      loadingLabel="Loading the note count"
      errorMessage="We could not load the note count."
      onRetry={() => {}}
      emptyLabel="No notes yet"
      {...props}
    >
      <WidgetStat value={31} lines={["In the group now"]} />
    </WidgetCard>,
  )

describe("WidgetCard", () => {
  it("names its card by its heading and draws the widget when ready", () => {
    const html = card({ caption: "Last 30 days" })
    expect(html).toMatch(
      /<div role="group" tabindex="-1" aria-labelledby="(widget-[^"]+)"[^>]*><div[^>]*><div[^>]*><h2 id="\1"/,
    )
    expect(html).toContain(">31</p>")
    expect(html).toContain('<p class="text-sm text-muted">Last 30 days</p>')
  })

  it("says it is loading to a screen reader and draws no skeleton before its delay", () => {
    const html = card({ status: "loading" })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('<span class="sr-only" role="status">Loading the note count</span>')
    expect(html).not.toContain("data-widget-skeleton")
    expect(html).not.toContain(">31</p>")
  })

  it("shows its error with a retry button in place of the widget", () => {
    const html = card({ status: "error" })
    expect(html).toContain('role="alert"')
    expect(html).toContain("We could not load the note count.")
    expect(html).toContain(">Try again</button>")
    expect(html).not.toContain(">31</p>")
  })

  it("can hold focus without being a Tab stop, so Try again can hand focus to it", () => {
    expect(card({ status: "error" })).toMatch(/role="group" tabindex="-1"/)
  })

  it("draws the library's card surface and radius", () => {
    expect(card()).toContain('class="pc-card ')
  })

  it("shows one line when it has nothing to show", () => {
    const html = card({ status: "empty" })
    expect(html).toContain(">No notes yet</p>")
    expect(html).not.toContain(">31</p>")
  })

  it("links its title and names its menu after it", () => {
    const html = card({ href: "/notes", menu: <li>Hide</li> })
    expect(html).toMatch(/<h2[^>]*><a href="\/notes"/)
    expect(html).toContain('aria-label="Actions for Notes"')
  })

  it("keeps a chart's height in every state", () => {
    expect(card({ size: "full", status: "error" })).toContain("min-h-60")
    expect(card({ status: "error" })).toContain("min-h-16")
  })
})

describe("WidgetStat", () => {
  it("gives a shortened number its full value as its name", () => {
    const html = render(<WidgetStat value="1.2M" valueLabel="1,234,567" />)
    expect(html).toContain('aria-label="1,234,567">1.2M</p>')
  })

  const valueClass = (value: string | number) =>
    render(<WidgetStat value={value} />).match(/<p class="([^"]*)"/)?.[1] ?? ""

  it("draws a short value at text-3xl at every width", () => {
    expect(valueClass(9)).toMatch(/(^| )text-3xl$/)
    expect(valueClass("1.2M")).toMatch(/(^| )text-3xl$/)
  })

  it("gives a longer value smaller size steps for narrower boxes", () => {
    expect(valueClass("$12,345")).toContain(
      "text-xl @min-[6.5rem]:text-2xl @min-[8rem]:text-3xl",
    )
    expect(valueClass("₫27,000,000")).toContain(
      "text-lg @min-[7.5rem]:text-xl @min-[9rem]:text-2xl @min-[11.25rem]:text-3xl",
    )
    expect(valueClass("₫1,234,567,890")).toContain(
      "text-base @min-[8.875rem]:text-lg @min-[9.75rem]:text-xl @min-[11.75rem]:text-2xl @min-[14.75rem]:text-3xl",
    )
  })

  it("counts a separator as half a character", () => {
    // A comma counts: "1,234" is 4.5 units, past the short step that "1234" fits.
    expect(valueClass("1234")).toMatch(/(^| )text-3xl$/)
    expect(valueClass("1,234")).toContain("text-xl @min-[6.5rem]:text-2xl")
    // But only half: "₫1,234,567,890" is 14 characters and 12.5 units, inside the 13-unit step.
    expect(valueClass("₫1,234,567,890")).toContain("text-base @min-[8.875rem]:text-lg")
  })

  it("draws a value too long for every step at text-base, free to wrap", () => {
    const value = valueClass("₫123,456,789,012,345")
    expect(value).toMatch(/(^| )text-base$/)
    expect(value).toContain("wrap-anywhere")
  })
})

describe("dashboardRows", () => {
  const item = (id: string, size: "stat" | "full") => ({ id, size, content: id })

  it("puts consecutive stats in one row and each full widget in its own", () => {
    const rows = dashboardRows([
      item("a", "stat"),
      item("b", "stat"),
      item("c", "full"),
      item("d", "stat"),
      item("e", "full"),
      item("f", "full"),
    ])
    expect(rows.map((row) => row.items.map((each) => each.id).join(""))).toEqual([
      "ab",
      "c",
      "d",
      "e",
      "f",
    ])
  })

  it("draws a labelled region with a grid row for the stats", () => {
    const html = render(
      <DashboardGrid label="Widgets" items={[item("a", "stat"), item("b", "stat")]} />,
    )
    expect(html).toContain('role="region" aria-label="Widgets"')
    expect(html.split('class="min-w-0"').length - 1).toBe(2)
    expect(html).toContain("grid-template-columns:repeat(auto-fit")
  })
})
