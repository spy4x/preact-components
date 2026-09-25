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

  it("names the landmark by the caller's label instead of the default Note", () => {
    const html = render(<MarginNote label="Benchmark note">A note.</MarginNote>)
    expect(html).toContain('aria-label="Benchmark note"')
    expect(html).not.toContain('aria-label="Note"')
  })

  it("formats checkedOn in the caller's own locale", () => {
    const html = render(
      <MarginNote checkedOn="2026-09-25" locale="fr">
        Still true.
      </MarginNote>,
    )
    expect(html).toContain("septembre 2026")
  })

  it("reads checkedOn as the UTC calendar date, not shifted by the local time zone", () => {
    // 2026-01-01 parses as UTC midnight; a time zone west of UTC reads that back as
    // "December 31, 2025" unless the formatter pins UTC. CI runs in UTC, so the test pins a
    // western zone itself rather than depending on where it runs.
    const previous = Deno.env.get("TZ")
    Deno.env.set("TZ", "America/Los_Angeles")
    try {
      const html = render(<MarginNote checkedOn="2026-01-01">Boundary date.</MarginNote>)
      expect(html).toContain("January 1, 2026")
      expect(html).not.toContain("December 31, 2025")
    } finally {
      if (previous === undefined) Deno.env.delete("TZ")
      else Deno.env.set("TZ", previous)
    }
  })
})
