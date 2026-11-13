import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { PrevNext } from "./prev-next.tsx"

const PREVIOUS = { href: "/docs/apps", title: "The three apps" }
const NEXT = { href: "/docs/guests", title: "Guest accounts" }

describe("PrevNext", () => {
  it("renders nothing without a neighbour", () => {
    expect(render(<PrevNext />)).toBe("")
  })

  it("draws a whole-card link for each neighbour, previous first, in a named navigation", () => {
    const html = render(<PrevNext previous={PREVIOUS} next={NEXT} />)
    expect(html).toMatch(/^<nav aria-label="Previous and next"/)
    expect(html).toMatch(
      /<a href="\/docs\/apps" rel="prev"[^>]*>.*Previous<\/span><span[^>]*>The three apps<\/span><\/a>/,
    )
    expect(html).toMatch(
      /<a href="\/docs\/guests" rel="next"[^>]*>.*Next<svg.*<\/span><span[^>]*>Guest accounts<\/span><\/a>/,
    )
    expect(html.indexOf("/docs/apps")).toBeLessThan(html.indexOf("/docs/guests"))
  })

  it("keeps the next card on the end side even when it is alone", () => {
    const html = render(<PrevNext next={NEXT} />)
    expect(html).not.toContain('rel="prev"')
    expect(html).toMatch(/rel="next" class="[^"]*sm:col-start-2/)
  })

  it("turns its arrows with the reading direction", () => {
    const html = render(<PrevNext previous={PREVIOUS} next={NEXT} />)
    expect(html.match(/rtl:-scale-x-100/g)?.length).toBe(2)
  })

  it("takes the caller's words", () => {
    const html = render(
      <PrevNext previous={PREVIOUS} labels={{ label: "More guides", previous: "Back" }} />,
    )
    expect(html).toMatch(/^<nav aria-label="More guides"/)
    expect(html).toContain("Back</span>")
  })
})
