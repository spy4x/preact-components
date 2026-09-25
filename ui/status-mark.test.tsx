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
    // Hiding the whole mark (word included) would still contain aria-hidden="true", so this finds
    // the aria-hidden <span>'s own matching close tag — balanced against any <span> nested inside
    // it, not just the first "</span>" textually after it, which would under-count if the mark's
    // outer wrapper were the one hidden — and requires the visible word to sit outside that range.
    const ariaIndex = html.indexOf('aria-hidden="true"')
    const tagStart = html.lastIndexOf("<span", ariaIndex)
    let pos = html.indexOf(">", ariaIndex) + 1
    let depth = 1
    while (depth > 0) {
      const nextOpen = html.indexOf("<span", pos)
      const nextClose = html.indexOf("</span>", pos)
      if (nextClose === -1) throw new Error("unbalanced <span> in rendered StatusMark output")
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        pos = nextOpen + "<span".length
      } else {
        depth--
        pos = nextClose + "</span>".length
      }
    }
    const hiddenWrapper = html.slice(tagStart, pos)
    expect(hiddenWrapper).not.toContain("WIP")
    expect(html.slice(pos)).toContain("WIP")
  })

  it("colours only the shape, so the word keeps the page's text colour", () => {
    for (const status of STATUSES) {
      const html = render(<StatusMark status={status} />)
      const outer = html.slice(0, html.indexOf(">") + 1)
      expect(outer).not.toMatch(/text-(success|muted|warning|danger)/)
    }
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
