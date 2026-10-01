import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { StatusMark, type StatusMarkStatus } from "./status-mark.tsx"

/** Every status paired with its default word; `Record` stops compiling when a status is missing. */
const LABELS: Record<StatusMarkStatus, string> = {
  ready: "Ready",
  "in-use": "In use",
  beta: "Beta",
  wip: "WIP",
  paused: "Paused",
  archived: "Archived",
  "known-issue": "Known issue",
  outcome: "Outcome",
  live: "Live",
  offline: "Offline",
}

const STATUSES = Object.keys(LABELS) as StatusMarkStatus[]

describe("StatusMark", () => {
  it("renders the default English label for every status", () => {
    for (const status of STATUSES) {
      expect(render(<StatusMark status={status} />)).toContain(`>${LABELS[status]}</span>`)
    }
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
      expect(outer).not.toMatch(/text-(success|muted|warning|danger|foreground)/)
    }
  })

  it("tones every status's shape with its own theme token class, never a raw palette class", () => {
    // Fixed on purpose: a raw palette class (`text-green-600`) ignores an app's repainted theme,
    // and a different token silently changes what a status means (#443).
    const expected: Record<StatusMarkStatus, string> = {
      ready: "text-success",
      "in-use": "text-success",
      beta: "text-muted",
      wip: "text-warning",
      paused: "text-muted",
      archived: "text-muted",
      "known-issue": "text-danger",
      outcome: "text-foreground",
      live: "text-success",
      offline: "text-muted",
    }
    const actual = Object.fromEntries(STATUSES.map((status) => {
      const html = render(<StatusMark status={status} />)
      const shapeWrapper = html.match(/<span aria-hidden="true" class="([^"]*)"/)
      if (!shapeWrapper) throw new Error(`no aria-hidden shape wrapper for "${status}"`)
      const tones = shapeWrapper[1].split(/\s+/).filter((name) => name.startsWith("text-"))
      return [status, tones.join(" ")]
    }))
    expect(actual).toEqual(expected)
  })

  it("renders a different SVG for every status, so the shapes are distinct", () => {
    const svgs = STATUSES.map((status) => {
      const html = render(<StatusMark status={status} />)
      return html.slice(html.indexOf("<svg"), html.indexOf("</svg>"))
    })
    expect(new Set(svgs).size).toBe(STATUSES.length)
  })

  it("draws every shape in the tone's colour or a theme token, never a literal colour", () => {
    for (const status of STATUSES) {
      const html = render(<StatusMark status={status} />)
      const svg = html.slice(html.indexOf("<svg"), html.indexOf("</svg>"))
      // A literal inside a token's fallback (`var(--color-surface, oklch(1 0 0))`) is allowed.
      const outsideTokens = svg.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, "")
      expect({ status, literal: outsideTokens.match(/#[0-9a-f]{3,8}\b|oklch\(|rgb|hsl/i) })
        .toEqual({ status, literal: null })
    }
  })

  it("passes the caller's class through", () => {
    expect(render(<StatusMark status="ready" class="ml-2" />)).toContain("ml-2")
  })
})
