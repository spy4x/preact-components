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
    expect(html.match(/<li /g)?.length).toBe(3)
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

  it("lowers every second look in two columns and the middle column in three, leaving room under them", () => {
    const html = render(
      <LookGrid>
        <p>Look</p>
      </LookGrid>,
    )
    expect(html).toContain(
      '<li class="md:max-lg:even:translate-y-16 lg:nth-[3n+2]:translate-y-16 lg:has-[[data-lead]]:col-span-2">',
    )
    expect(html).toContain("md:pb-16")
  })

  it("renders nothing for no looks, so the page draws its own empty state", () => {
    expect(render(<LookGrid>{[]}</LookGrid>)).toBe("")
  })
})
