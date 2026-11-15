import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LookGrid } from "./look-grid.tsx"

describe("LookGrid", () => {
  it("puts each look in its own list item, in order, under the list's name", () => {
    const html = render(
      <LookGrid label="New in">
        <p key="a">First</p>
        <p key="b">Second</p>
        <p key="c">Third</p>
      </LookGrid>,
    )
    expect(html).toMatch(/^<ul aria-label="New in" class="grid /)
    expect(html.match(/<li\b/g)?.length).toBe(3)
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"))
    expect(html.indexOf("Second")).toBeLessThan(html.indexOf("Third"))
    expect(html).not.toContain("<script")
  })

  it("lays one column on a phone, two from md and three from lg", () => {
    const html = render(
      <LookGrid>
        <p>Look</p>
      </LookGrid>,
    )
    expect(html).toContain("grid-cols-1")
    expect(html).toContain("md:grid-cols-2")
    expect(html).toContain("lg:grid-cols-3")
  })

  it("lowers no look, so every row's looks start at the same height", () => {
    const html = render(
      <LookGrid>
        <p>Look</p>
        <p>Look</p>
        <p>Look</p>
      </LookGrid>,
    )
    expect(html).not.toMatch(/translate-y|pb-16|mt-|pt-/)
    expect(html.match(/<li>/g)?.length).toBe(3)
  })

  it("renders nothing for no looks, so the page draws its own empty state", () => {
    expect(render(<LookGrid>{[]}</LookGrid>)).toBe("")
  })
})
