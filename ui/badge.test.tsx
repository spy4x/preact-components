import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Badge } from "./badge.tsx"

describe("Badge", () => {
  it("fills with the purple palette by default", () => {
    const html = render(<Badge text="paid" />)

    expect(html).toContain("bg-purple-900")
    expect(html).toContain("text-purple-50")
    expect(html).toContain("paid")
  })

  it("uses only the border and text colours in outline mode", () => {
    const html = render(<Badge text="draft" color="red" type="outline" />)

    expect(html).toContain("border-red-600")
    expect(html).toContain("text-red-600")
    expect(html).not.toContain("bg-red-600")
  })

  it("renders a filled colour by name", () => {
    const html = render(<Badge text="open" color="green" />)

    expect(html).toContain("bg-green-600")
    expect(html).toContain("text-green-50")
  })

  it("keeps the caller's class alongside the palette", () => {
    const html = render(<Badge text="vip" class="uppercase tracking-wide" />)

    expect(html).toContain("uppercase tracking-wide")
    expect(html).toContain("bg-purple-900")
  })

  it("lets the caller's class win over a conflicting default", () => {
    const html = render(<Badge text="tiny" class="text-sm" />)

    expect(html).toContain("text-sm")
    expect(html).not.toContain("text-xs")
  })

  it("renders the badge as a span", () => {
    expect(render(<Badge text="x" />)).toMatch(/^<span/)
  })
})
