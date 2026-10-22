import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { TldrBox } from "./tldr-box.tsx"

describe("TldrBox", () => {
  it("lists the points in order under an In short heading that names the section", () => {
    const html = render(<TldrBox id="tldr" items={["First point.", "Second point."]} />)
    expect(html).toContain('<section aria-labelledby="tldr"')
    expect(html).toContain(
      '<h2 id="tldr" class="text-base font-semibold text-foreground">In short</h2>',
    )
    expect(html.indexOf("First point.")).toBeLessThan(html.indexOf("Second point."))
    expect(html.match(/<li/g)?.length).toBe(2)
  })

  it("takes its own heading text and level", () => {
    const html = render(<TldrBox id="k" title="TL;DR" headingLevel={3} items={["One."]} />)
    expect(html).toContain('<h3 id="k"')
    expect(html).toContain(">TL;DR</h3>")
  })

  it("generates a heading id when none is given, so the section still has a name", () => {
    const html = render(<TldrBox items={["One."]} />)
    const id = /<h2 id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${id}"`)
  })

  it("renders nothing for a post without points", () => {
    expect(render(<TldrBox items={[]} />)).toBe("")
  })
})
