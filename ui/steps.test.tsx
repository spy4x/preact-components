import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Steps } from "./steps.tsx"

const ITEMS = [
  { title: "Sign up", text: "Use your email." },
  { title: "Import", text: <a href="/import">Bring your data</a> },
  { title: "Invite" },
] as const

describe("Steps", () => {
  it("renders an ordered list with one list item per step", () => {
    const html = render(<Steps items={ITEMS} />)
    expect(html).toMatch(/^<ol role="list" class="[^"]*\[counter-reset:step\]/)
    expect(html.match(/<li /g)?.length).toBe(3)
    expect(html).toContain('<a href="/import">Bring your data</a>')
  })

  it("draws the number with a CSS counter in a circle hidden from screen readers", () => {
    const html = render(<Steps items={ITEMS} />)
    expect(html.match(/\[counter-increment:step\]/g)?.length).toBe(3)
    expect(html.match(/<span aria-hidden="true" class="[^"]*content-\[counter\(step\)\]/g)?.length)
      .toBe(3)
    // No digit is written as text: the list position is announced once, by the list itself.
    expect(html.replace(/<[^>]*>/g, "")).not.toMatch(/\d/)
  })

  it("draws a hidden connector between steps, none after the last", () => {
    const html = render(<Steps items={ITEMS} />)
    expect(html.match(/<span aria-hidden="true" class="[^"]*border-l border-subtle/g)?.length)
      .toBe(2)
  })

  it("renders each title at the heading level it is given", () => {
    expect(render(<Steps items={ITEMS} />).match(/<h3 /g)?.length).toBe(3)
    const html = render(<Steps items={ITEMS} headingLevel={4} />)
    expect(html.match(/<h4 /g)?.length).toBe(3)
    expect(html).not.toContain("<h3")
  })

  it("lays the steps out in a row from lg up only when horizontal", () => {
    expect(render(<Steps items={ITEMS} />)).not.toContain("lg:flex-row")
    const html = render(<Steps items={ITEMS} orientation="horizontal" />)
    expect(html).toMatch(/^<ol role="list" class="[^"]*flex-col[^"]*lg:flex-row/)
    expect(html).toContain("lg:border-t")
  })

  it("leaves the text block out when a step has none", () => {
    const html = render(<Steps items={[{ title: "Invite" }]} />)
    expect(html).not.toContain("text-muted")
  })
})
