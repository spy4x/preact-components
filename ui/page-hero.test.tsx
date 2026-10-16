import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
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

  it("draws the title at the heading level it is given, with the same look", () => {
    const html = render(<PageHero title="Features" headingLevel={4} />)
    expect(html).not.toContain("<h1")
    expect(html).toMatch(/<h4 class="[^"]*\btext-3xl\b[^"]*">Features<\/h4>/)
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
})
