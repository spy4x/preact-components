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

  it("wraps long code lines instead of scrolling them, so no block needs a tab stop", () => {
    const pre = /& :where\(pre\) \{([^}]*)\}/.exec(proseCss)?.[1] ?? ""
    expect(pre).toContain("whitespace-pre-wrap")
    expect(proseCss).not.toContain("overflow-x-auto")
  })
})
