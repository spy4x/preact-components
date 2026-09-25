import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { StatusMark, type StatusMarkStatus } from "./status-mark.tsx"

const STATUSES: StatusMarkStatus[] = [
  "ready",
  "beta",
  "wip",
  "paused",
  "archived",
  "known-issue",
]

describe("StatusMark", () => {
  it("renders the default English label for every status", () => {
    const labels = ["Ready", "Beta", "WIP", "Paused", "Archived", "Known issue"]
    STATUSES.forEach((status, index) => {
      expect(render(<StatusMark status={status} />)).toContain(labels[index])
    })
  })

  it("renders a caller-supplied label instead of the default", () => {
    expect(render(<StatusMark status="ready" label="Shipped" />)).toContain("Shipped")
    expect(render(<StatusMark status="ready" label="Shipped" />)).not.toContain("Ready")
  })

  it("hides the shape from assistive tech, and only the shape — the word sits outside it", () => {
    const html = render(<StatusMark status="wip" />)
    expect(html).toContain('aria-hidden="true"')
    // Hiding the whole mark (word included) would still contain aria-hidden="true", so this reads
    // the hidden wrapper's own content and requires the visible word not be inside it: the wrapper
    // opens at aria-hidden="true" and, since it holds only the SVG, closes at the first </span>
    // that follows.
    const start = html.indexOf('aria-hidden="true"')
    const end = html.indexOf("</span>", start)
    const hiddenWrapper = html.slice(start, end)
    expect(hiddenWrapper).not.toContain("WIP")
    expect(html.slice(end)).toContain("WIP")
  })

  it("renders a different SVG for every status, so the shapes are distinct", () => {
    const svgs = STATUSES.map((status) => {
      const html = render(<StatusMark status={status} />)
      return html.slice(html.indexOf("<svg"), html.indexOf("</svg>"))
    })
    expect(new Set(svgs).size).toBe(STATUSES.length)
  })

  it("passes the caller's class through", () => {
    expect(render(<StatusMark status="ready" class="ml-2" />)).toContain("ml-2")
  })
})
