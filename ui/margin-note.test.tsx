import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { MarginNote } from "./margin-note.tsx"

describe("MarginNote", () => {
  it("renders as an aside named Note by default", () => {
    const html = render(<MarginNote>A short observation.</MarginNote>)
    expect(html).toContain("<aside")
    expect(html).toContain('aria-label="Note"')
    expect(html).toContain("A short observation.")
  })

  it("renders no source link or checked line when neither is given", () => {
    const html = render(<MarginNote>Plain note.</MarginNote>)
    expect(html).not.toContain("href=")
    expect(html).not.toContain("<time")
  })

  it("renders a source link when sourceHref is given", () => {
    const html = render(
      <MarginNote sourceHref="https://example.com/report" sourceLabel="The report">
        Cross-checked against the source.
      </MarginNote>,
    )
    expect(html).toContain('href="https://example.com/report"')
    expect(html).toContain("The report")
  })

  it("renders a real <time> with a machine-readable datetime and a formatted label", () => {
    const html = render(<MarginNote checkedOn="2026-09-25">Still true.</MarginNote>)
    expect(html).toContain('<time datetime="2026-09-25"')
    expect(html).toContain("September 25, 2026")
  })

  it("renders both the source link and the checked date together", () => {
    const html = render(
      <MarginNote sourceHref="https://example.com" checkedOn="2026-01-01">
        Both.
      </MarginNote>,
    )
    expect(html).toContain("<a")
    expect(html).toContain("<time")
  })

  it("passes the caller's class through", () => {
    expect(render(<MarginNote class="mt-4">Note.</MarginNote>)).toContain("mt-4")
  })
})
