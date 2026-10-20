import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createFormatters } from "@spy4x/time/format"
import { FormatContext } from "./format.tsx"
import { PageHero } from "./page-hero.tsx"

describe("PageHero", () => {
  it("draws the eyebrow, the page's only h1, the lead and the buttons, in that order", () => {
    const html = render(
      <PageHero eyebrow="Pricing" title="Pay for what you use" lead="One price per seat.">
        <a href="/sign-up">Start free</a>
      </PageHero>,
    )
    expect(html.match(/<h1[ >]/g)?.length).toBe(1)
    const order = ["Pricing", "<h1", "Pay for what you use", "One price per seat.", "Start free"]
      .map((part) => html.indexOf(part))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("leaves out the eyebrow and the lead when they are not given", () => {
    const html = render(<PageHero title="Features" />)
    expect(html.match(/<p[ >]/g)).toBeNull()
  })

  it("sets the title and lead in the design language's marketing sizes, in the max-w-6xl column", () => {
    const html = render(<PageHero title="Features" lead="Everything in one place." />)
    expect(html).toMatch(/<h1 class="[^"]*\btext-3xl\b[^"]*\blg:text-5xl\b/)
    expect(html).toMatch(/<h1 class="[^"]*\bfont-semibold\b/)
    expect(html).toMatch(/<p class="[^"]*\btext-lg\b[^"]*\blg:text-xl\b/)
    expect(html).toMatch(/class="[^"]*\bmax-w-6xl\b[^"]*\bpy-12\b[^"]*\blg:py-16\b/)
  })

  it("draws no header landmark, and merges the caller's class onto the band", () => {
    const html = render(<PageHero title="Features" class="bg-surface" />)
    expect(html).not.toContain("<header")
    expect(html).toMatch(/^<div class="[^"]*\bbg-surface\b/)
  })

  it("adds a muted meta line after the buttons with the author's link and the day as <time datetime>", () => {
    const html = render(
      <PageHero
        title="Features"
        author={{ name: "Anton Shubin", href: "/about" }}
        updated="2026-10-19"
      >
        <a href="/sign-up">Start free</a>
      </PageHero>,
    )
    const meta = html.match(/<p class="([^"]*)" data-e2e="page-hero-meta">(.*?)<\/p>/)
    expect(meta?.[1]).toMatch(/\btext-sm\b.*\btext-muted\b/)
    expect(meta?.[2]).toMatch(/By <a [^>]*href="\/about"[^>]*>Anton Shubin<\/a>/)
    expect(meta?.[2]).toMatch(/Updated <time datetime="2026-10-19">[^<]*19[^<]*2026<\/time>/)
    expect(html.indexOf("Start free")).toBeLessThan(html.indexOf("page-hero-meta"))
  })

  it("shows the updated day itself in a zone west of UTC, where midnight UTC is the day before", () => {
    const html = render(
      <FormatContext.Provider
        value={createFormatters({ locale: "en-GB", timeZone: "America/Los_Angeles" })}
      >
        <PageHero title="Features" updated="2026-10-19" />
      </FormatContext.Provider>,
    )
    expect(html).toContain(`<time datetime="2026-10-19">19 Oct 2026</time>`)
  })

  it("names an author without a link as plain text, and takes the caller's words", () => {
    const html = render(
      <PageHero
        title="Features"
        author={{ name: "Anton Shubin" }}
        labels={{ by: "Von" }}
      />,
    )
    expect(html).toContain("Von <span")
    expect(html).toContain("Anton Shubin")
    expect(html).not.toContain("<a ")
    expect(html).not.toContain("<time")
  })

  it("draws no meta line without an author or a date", () => {
    const html = render(<PageHero title="Features" />)
    expect(html).not.toContain("page-hero-meta")
  })

  it("refuses an updated value that is not a calendar day", () => {
    expect(() => render(<PageHero title="Features" updated="19 Oct 2026" />)).toThrow(
      "YYYY-MM-DD",
    )
  })
})
