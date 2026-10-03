import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Notice, type NoticeTone } from "./notice.tsx"

/** The root element's opening tag, where the role, the tone classes and caller attributes sit. */
function rootTag(html: string): string {
  return html.slice(0, html.indexOf(">") + 1)
}

describe("Notice", () => {
  it("renders nothing without a title, a body or an action", () => {
    expect(render(<Notice />)).toBe("")
    const empty = ""
    expect(render(<Notice tone="warning">{empty}</Notice>)).toBe("")
    expect(render(<Notice>{null}</Notice>)).toBe("")
  })

  it("renders nothing for a body that is an empty list", () => {
    const rows: string[] = []
    expect(render(<Notice>{rows.map((row) => <p key={row}>{row}</p>)}</Notice>)).toBe("")
    expect(render(<Notice>{[[], null, false]}</Notice>)).toBe("")
  })

  it("renders a body list that holds an item", () => {
    expect(render(<Notice>{[null, <p key="plan">Plan ends</p>]}</Notice>)).toContain(
      "<p>Plan ends</p>",
    )
  })

  it("announces itself politely as a status by default", () => {
    const html = render(<Notice title="Trial ends soon" />)

    expect(rootTag(html)).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })

  it("announces itself as an alert only when urgent", () => {
    const html = render(<Notice urgent title="Payment failed" />)

    expect(rootTag(html)).toContain('role="alert"')
    expect(html).not.toContain('role="status"')
  })

  it("draws each tone with its own theme token, never a fixed palette colour", () => {
    const tones: Record<NoticeTone, string> = {
      info: "border-info bg-info-soft",
      warning: "border-warning bg-warning-soft",
      success: "border-success bg-success-soft",
    }
    for (const [tone, classes] of Object.entries(tones) as [NoticeTone, string][]) {
      const html = render(<Notice tone={tone} title="Heads up" />)
      expect(rootTag(html)).toContain(classes)
      expect(html).toContain(`text-${tone}`)
      expect(html).not.toMatch(/(amber|orange|green|blue|red)-\d/)
    }
  })

  it("defaults to the info tone", () => {
    expect(rootTag(render(<Notice title="Heads up" />))).toContain("border-info bg-info-soft")
  })

  it("shows a different glyph per tone, hidden from assistive tech", () => {
    const glyphs = (["info", "warning", "success"] as const).map((tone) => {
      const html = render(<Notice tone={tone} title="Heads up" />)
      const svg = html.match(/<svg[^>]*>.*?<\/svg>/)?.[0] ?? ""
      expect(svg).toContain('aria-hidden="true"')
      // The drawing alone: the tone's colour class differs even when the glyph is the same.
      return [...svg.matchAll(/ d="([^"]*)"/g)].map(([, d]) => d).join(" ")
    })

    expect(glyphs.every((drawing) => drawing.length > 0)).toBe(true)
    expect(new Set(glyphs).size).toBe(3)
  })

  it("keeps body text in the foreground colour so it reads on every tint", () => {
    const html = render(<Notice tone="warning" title="Plan ends">On 12 October.</Notice>)

    expect(rootTag(html)).toContain("text-foreground")
  })

  it("renders the title as text, not a heading", () => {
    const html = render(<Notice title="Plan ends">On 12 October.</Notice>)

    expect(html).toContain('<p class="font-medium">Plan ends</p>')
    expect(html).not.toMatch(/<h\d/)
  })

  it("renders the body under the title, and alone without one", () => {
    const both = render(<Notice title="Plan ends">On 12 October.</Notice>)
    expect(both.indexOf("Plan ends")).toBeLessThan(both.indexOf("On 12 October."))
    expect(both).toContain('<div class="mt-1">On 12 October.</div>')

    const alone = render(<Notice>On 12 October.</Notice>)
    expect(alone).toContain("<div>On 12 October.</div>")
    expect(alone).not.toContain("font-medium")
  })

  it("renders the caller's action after the text", () => {
    const html = render(
      <Notice title="Plan ends" action={<a href="/billing">Renew</a>}>On 12 October.</Notice>,
    )

    expect(html).toContain('<div class="shrink-0"><a href="/billing">Renew</a></div>')
    expect(html.indexOf("On 12 October.")).toBeLessThan(html.indexOf("Renew"))
  })

  it("renders with an action alone", () => {
    expect(render(<Notice action={<a href="/billing">Renew</a>} />)).toContain("Renew")
  })

  it("passes caller attributes to the root and appends a caller class", () => {
    const html = render(
      <Notice
        title="Plan ends"
        id="notice"
        data-e2e="plan-notice"
        data-kind="ending"
        class="mb-4"
      />,
    )
    const root = rootTag(html)

    expect(root).toContain('id="notice"')
    expect(root).toContain('data-e2e="plan-notice"')
    expect(root).toContain('data-kind="ending"')
    expect(root).toContain("mb-4")
  })

  it("keeps its role when a caller passes one in an attribute spread", () => {
    const attrs = { role: "note" } as Record<string, string>
    expect(rootTag(render(<Notice title="Plan ends" {...attrs} />))).toContain('role="status"')
  })
})
