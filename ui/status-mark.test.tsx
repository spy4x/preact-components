import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { StatusMark, type StatusMarkStatus } from "./status-mark.tsx"

/** Every status paired with its default word; `Record` stops compiling when a status is missing. */
const LABELS: Record<StatusMarkStatus, string> = {
  ready: "Ready",
  "in-use": "In use",
  beta: "Beta",
  wip: "In progress",
  paused: "Paused",
  archived: "Archived",
  "known-issue": "Known issue",
  outcome: "Outcome",
  live: "Live",
  offline: "Offline",
  running: "Running",
  done: "Done",
  parked: "Parked",
  blocked: "Blocked",
  waiting: "Waiting",
  failed: "Failed",
  "out-of-time": "Out of time",
  "out-of-budget": "Out of budget",
  "out-of-turns": "Out of turns",
  stopped: "Stopped",
  queued: "Queued",
  claimed: "Claimed",
}

const STATUSES = Object.keys(LABELS) as StatusMarkStatus[]

/** A project's lifecycle states, shown side by side and told apart by shape. */
const PROJECT_STATUSES: StatusMarkStatus[] = [
  "ready",
  "in-use",
  "beta",
  "wip",
  "paused",
  "archived",
  "known-issue",
  "outcome",
  "live",
  "offline",
]

/** A job's and a queued task's states, shown side by side and told apart by shape. */
const JOB_STATUSES: StatusMarkStatus[] = [
  "running",
  "done",
  "parked",
  "blocked",
  "waiting",
  "failed",
  "out-of-time",
  "out-of-budget",
  "out-of-turns",
  "stopped",
  "queued",
  "claimed",
]

/** The SVG markup a status draws. */
function shapeOf(status: StatusMarkStatus): string {
  const html = render(<StatusMark status={status} />)
  return html.slice(html.indexOf("<svg"), html.indexOf("</svg>"))
}

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
    expect(hiddenWrapper).not.toContain("In progress")
    expect(html.slice(pos)).toContain("In progress")
  })

  it("colours only the shape, so the word keeps the page's text colour", () => {
    for (const status of STATUSES) {
      const html = render(<StatusMark status={status} />)
      const outer = html.slice(0, html.indexOf(">") + 1)
      expect(outer).not.toMatch(/text-(success|muted|warning|danger|foreground|info)/)
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
      running: "text-info animate-pulse motion-reduce:animate-none",
      done: "text-success",
      parked: "text-muted",
      blocked: "text-warning",
      waiting: "text-warning",
      failed: "text-danger",
      "out-of-time": "text-danger",
      "out-of-budget": "text-danger",
      "out-of-turns": "text-danger",
      stopped: "text-muted",
      queued: "text-muted",
      claimed: "text-muted",
    }
    const actual = Object.fromEntries(STATUSES.map((status) => {
      const html = render(<StatusMark status={status} />)
      const shapeWrapper = html.match(/<span aria-hidden="true" class="([^"]*)"/)
      if (!shapeWrapper) throw new Error(`no aria-hidden shape wrapper for "${status}"`)
      // The whole class string, so a raw class with a variant (`dark:text-green-400`) or of
      // another kind (`fill-yellow-500`) beside the token fails too.
      return [status, shapeWrapper[1].replace(/^shrink-0 /, "")]
    }))
    expect(actual).toEqual(expected)
  })

  it("splits every status into the project set or the job set, never both", () => {
    expect([...PROJECT_STATUSES, ...JOB_STATUSES].sort()).toEqual([...STATUSES].sort())
  })

  it("renders a different SVG for every project status, so the shapes are distinct", () => {
    expect(new Set(PROJECT_STATUSES.map(shapeOf)).size).toBe(PROJECT_STATUSES.length)
  })

  it("renders a different SVG for every job status, so the shapes are distinct", () => {
    expect(new Set(JOB_STATUSES.map(shapeOf)).size).toBe(JOB_STATUSES.length)
  })

  it("gives only the running shape the pulse class and its reduced-motion switch", () => {
    for (const status of STATUSES) {
      const html = render(<StatusMark status={status} />)
      const pulses = html.includes("animate-pulse motion-reduce:animate-none")
      expect({ status, pulses }).toEqual({ status, pulses: status === "running" })
    }
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
