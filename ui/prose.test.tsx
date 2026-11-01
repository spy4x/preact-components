import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Prose } from "./prose.tsx"

/** The theme's stylesheet, which holds `.pc-prose`. Read-only. */
const presetCss = await Deno.readTextFile(new URL("../theme/preset.css", import.meta.url))

/** The body of the `pc-prose` utility, up to the next top-level rule. */
const proseCss = /@utility pc-prose \{([\s\S]*?)\n\}/.exec(presetCss)?.[1] ?? ""

describe("Prose", () => {
  it("renders the article HTML it is given inside one wrapper with the prose class", () => {
    const html = render(<Prose html='<h2 id="why">Why</h2><p>Because.</p>' />)
    expect(html).toBe('<div class="pc-prose" data-prose><h2 id="why">Why</h2><p>Because.</p></div>')
  })

  it("renders children when no html is given, in an article when asked", () => {
    const html = render(
      <Prose as="article" class="mx-auto">
        <p>Hello</p>
      </Prose>,
    )
    expect(html).toBe('<article class="pc-prose mx-auto" data-prose><p>Hello</p></article>')
  })

  it("styles every element a Markdown renderer emits, from the theme's tokens", () => {
    expect(proseCss).toContain("max-w-2xl")
    for (
      const selector of [
        ":where(h2)",
        ":where(h3)",
        ":where(h4)",
        ":where(ul)",
        ":where(ol)",
        ":where(a)",
        ":where(a:focus-visible)",
        ":where(:not(pre) > code)",
        ":where(pre)",
        ":where(blockquote)",
        ":where(table)",
        ":where(th, td)",
        ":where(img, video)",
        ":where(hr)",
      ]
    ) expect(proseCss).toContain(`& ${selector} {`)
    expect(proseCss).not.toMatch(/(?:text|bg|border)-(?:gray|slate|zinc|neutral|black|white)\b/)
    expect(proseCss).not.toContain("dark:")
  })

  it("wraps long code lines instead of scrolling them, so no code block needs a tab stop", () => {
    const pre = /& :where\(pre\) \{([^}]*)\}/.exec(proseCss)?.[1] ?? ""
    expect(pre).toContain("whitespace-pre-wrap")
    // Only the table region scrolls; it is the one focusable block.
    expect(proseCss.match(/overflow-x-auto/g)).toEqual(["overflow-x-auto"])
    expect(/& :where\(\[data-prose-table\]\) \{([^}]*)\}/.exec(proseCss)?.[1]).toContain(
      "overflow-x-auto",
    )
  })

  it("puts each table in a focusable region named by the heading before it", () => {
    const html = render(
      <Prose html='<h2 id="limits">Limits</h2><table><tr><td>A</td></tr></table>' />,
    )
    expect(html).toContain(
      '<div data-prose-table="" role="region" tabindex="0" aria-labelledby="limits"><table><tr><td>A</td></tr></table></div>',
    )
  })

  it("names a table's region with the table label when no heading comes before it", () => {
    const html = render(
      <Prose html="<table><tr><td>A</td></tr></table>" labels={{ table: 'Plans "A"' }} />,
    )
    expect(html).toContain('role="region" tabindex="0" aria-label="Plans &quot;A&quot;"><table>')
  })

  it("adds a link to itself beside each h2 and h3 with an id, outside the heading, when asked", () => {
    const article = '<h2 id="why">Why</h2><p>x</p><h3 id="how">How</h3><h4 id="more">More</h4>'
    const html = render(<Prose html={article} anchors />)
    expect(html).toContain(
      '<div data-prose-heading=""><h2 id="why">Why</h2><a data-prose-anchor="" href="#why" aria-label="Link to this section"><span aria-hidden="true">#</span></a></div>',
    )
    expect(html).toContain('<h3 id="how">How</h3><a data-prose-anchor="" href="#how"')
    expect(html).toContain('<h4 id="more">More</h4>')
    expect(html).not.toContain('href="#more"')
  })

  it("leaves headings alone without anchors, and a heading with no id even with them", () => {
    const article = '<h2 id="why">Why</h2><h2>No id</h2>'
    expect(render(<Prose html={article} />)).not.toContain("data-prose-anchor")
    const html = render(<Prose html={article} anchors />)
    expect(html.match(/data-prose-anchor/g)?.length).toBe(1)
    expect(html).toContain("<h2>No id</h2>")
  })

  it("shows a heading's anchor on hover and on focus, and always where there is no hover", () => {
    expect(proseCss).toContain("& [data-prose-heading]:hover [data-prose-anchor],")
    expect(proseCss).toContain("& [data-prose-anchor]:focus-visible {")
    expect(proseCss).toMatch(
      /@media \(hover: none\) \{\s*& \[data-prose-anchor\] \{\s*@apply opacity-100/,
    )
  })
})
