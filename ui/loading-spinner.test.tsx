import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LoadingSpinner } from "./loading-spinner.tsx"

describe("LoadingSpinner", () => {
  it("renders a spinning glyph inside a live status region", () => {
    const html = render(<LoadingSpinner />)

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("animate-spin")
  })

  it("hides the glyph from assistive tech", () => {
    expect(render(<LoadingSpinner />)).toContain('aria-hidden="true"')
  })

  it("shows the label when given one", () => {
    const html = render(<LoadingSpinner label="Fetching invoices" />)

    expect(html).toContain("Fetching invoices")
    expect(html).not.toContain("sr-only")
  })

  it("falls back to a screen-reader-only label with no visible text", () => {
    const html = render(<LoadingSpinner />)

    expect(html).toContain('class="sr-only"')
    expect(html).toContain(">Loading<")
  })

  it("scales the glyph with size", () => {
    expect(render(<LoadingSpinner size="sm" />)).toContain("size-5")
    expect(render(<LoadingSpinner size="lg" />)).toContain("size-12")
  })

  it("lets the caller override the default padding", () => {
    const html = render(<LoadingSpinner class="py-0" />)

    expect(html).toContain("py-0")
    expect(html).not.toContain("py-10")
  })
})
