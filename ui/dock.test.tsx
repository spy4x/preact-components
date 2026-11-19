import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Dock, type DockProps } from "./dock.tsx"

/** Renders a dock labelled Decisions with a body line, plus whatever `props` add or replace. */
function dock(props: Partial<DockProps> = {}): string {
  return render(
    <Dock open={false} onOpenChange={() => {}} label="Decisions" {...props}>
      <p>Release the fix?</p>
    </Dock>,
  )
}

/** The toggle's opening tag. */
function toggleTag(html: string): string {
  return html.match(/<button[^>]*>/)?.[0] ?? ""
}

describe("Dock", () => {
  it("collapsed, is one toggle with the label and the count, and no region or body", () => {
    const html = dock({ count: 3 })
    const toggle = toggleTag(html)
    expect(toggle).toContain(`aria-expanded="false"`)
    expect(toggle).toContain(`aria-label="Decisions: 3"`)
    expect(toggle).not.toContain("aria-controls")
    expect(html).not.toContain(`role="region"`)
    expect(html).not.toContain("Release the fix?")
  })

  it("expanded, is a region named by the label whose toggle controls the body", () => {
    const html = dock({ open: true, count: 3, header: <span>1 of 3</span> })
    expect(html).toContain(`role="region" aria-label="Decisions"`)
    const toggle = toggleTag(html)
    expect(toggle).toContain(`aria-expanded="true"`)
    const controls = toggle.match(/aria-controls="([^"]+)"/)?.[1]
    expect(html).toContain(`id="${controls}"`)
    expect(html.indexOf("1 of 3")).toBeLessThan(html.indexOf("Release the fix?"))
  })

  it("shows the count as a badge for 0, 1 and many, and no badge or extra name without one", () => {
    for (const count of [0, 1, 12]) {
      const html = dock({ count })
      expect(toggleTag(html)).toContain(`aria-label="Decisions: ${count}"`)
      expect(html).toContain(`>${count}</span>`)
    }
    const none = dock()
    expect(toggleTag(none)).not.toContain("aria-label")
    expect(none).not.toMatch(/>\d+<\/span>/)
  })

  it("names the toggle with the caller's words", () => {
    const html = dock({ count: 2, labels: { toggle: (label, count) => `${count} ${label}` } })
    expect(toggleTag(html)).toContain(`aria-label="2 Decisions"`)
  })

  it("marks itself a hotkey scope, so a page's single keys skip it", () => {
    expect(dock()).toMatch(/<div [^>]*data-hotkey-scope[ =>]/)
  })

  it("slides its body in only without reduced motion", () => {
    const body = dock({ open: true }).match(/<div id="[^"]+" class="([^"]*)"/)?.[1] ?? ""
    const slide = body.split(" ").filter((name) => name.includes("starting:"))
    expect(slide.length).toBeGreaterThan(0)
    expect(slide.every((name) => name.startsWith("motion-safe:"))).toBe(true)
  })
})
