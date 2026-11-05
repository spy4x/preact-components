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

  it("scrolls a long code line inside its block, which is a Tab stop, instead of wrapping it", () => {
    const pre = /& :where\(pre\) \{([^}]*)\}/.exec(proseCss)?.[1] ?? ""
    expect(pre).toContain("overflow-x-auto")
    expect(pre).toContain("whitespace-pre;")
    expect(pre).not.toContain("wrap")
    expect(proseCss).toContain("& :where(pre:focus-visible) {")
    const html = render(<Prose html="<pre><code>deno task check</code></pre>" />)
    expect(html).toContain('<pre dir="ltr" tabindex="0"><code>deno task check</code></pre>')
    // A block that is a Tab stop already, as a highlighter draws it, keeps its own.
    expect(render(<Prose html='<pre class="shiki" tabindex="-1"><code>x</code></pre>' />))
      .toContain('<pre class="shiki" tabindex="-1" dir="ltr"><code>x</code></pre>')
  })

  it("lays a code block out left to right on a right-to-left page, unless it names its own dir", () => {
    const html = render(
      <div dir="rtl">
        <Prose html="<p>نص</p><pre><code>const a = f(b)</code></pre>" />
      </div>,
    )
    expect(html).toContain('<pre dir="ltr" tabindex="0"><code>const a = f(b)</code></pre>')
    expect(render(<Prose html='<pre dir="rtl"><code>x</code></pre>' />))
      .toContain('<pre dir="rtl" tabindex="0"><code>x</code></pre>')
  })

  it("draws no copy button without copyCode", () => {
    const html = render(<Prose html="<pre><code>deno task check</code></pre>" />)
    expect(html).not.toContain("data-prose-copy")
    expect(html).not.toContain("<button")
  })

  it("renders each code block's copy button hidden, named, with its words and a live region", () => {
    const html = render(
      <Prose
        html='<pre><code>a</code></pre><p>x</p><pre class="b"><code>b</code></pre>'
        copyCode
        labels={{ copy: 'Copy "code"', copied: "Done", copyFailed: "No luck" }}
      />,
    )
    const blocks = [...html.matchAll(/<div data-prose-code="">([\s\S]*?)<\/div>/g)]
    expect(blocks.length).toBe(2)
    for (const [, block] of blocks) {
      expect(block).toMatch(/^<pre[^>]* tabindex="0">[\s\S]*<\/pre><button /)
      expect(block).toContain(
        '<button type="button" data-prose-copy="" hidden aria-label="Copy &quot;code&quot;" ' +
          'title="Copy &quot;code&quot;" data-copied="Done" data-failed="No luck">',
      )
      // A clipboard, a checkmark and a cross, in the order the stylesheet picks them by.
      expect(block.match(/<svg /g)?.length).toBe(3)
      expect(block).toMatch(
        /<\/button><span data-prose-copy-status="" role="status" aria-live="polite"><\/span>$/,
      )
    }
    // Without JavaScript the stylesheet keeps the hidden button out, even past a reset.
    expect(proseCss).toContain("& [data-prose-copy][hidden] {")
    expect(proseCss).toMatch(/& \[data-prose-copy-status\] \{\s*@apply sr-only;/)
  })

  it("gives the copy button a focus ring and the English words by default", () => {
    const html = render(<Prose html="<pre><code>a</code></pre>" copyCode />)
    expect(html).toContain('aria-label="Copy" title="Copy" data-copied="Copied"')
    expect(html).toContain(`data-failed="Couldn't copy"`)
    expect(/& \[data-prose-copy\]:focus-visible \{([^}]*)\}/.exec(proseCss)?.[1]).toContain(
      "ring-2 ring-focus",
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
