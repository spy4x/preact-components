import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DocsNav, type DocsNavGroup } from "./docs-nav.tsx"

const GROUPS: DocsNavGroup[] = [
  {
    title: "Use",
    items: [
      { href: "/docs/apps", title: "The three apps" },
      { href: "/docs/deploy", title: "Deploy and operate" },
    ],
  },
  { title: "Build", items: [{ href: "/docs/development", title: "Development" }] },
]

describe("DocsNav", () => {
  it("renders nothing for no groups", () => {
    expect(render(<DocsNav groups={[]} />)).toBe("")
  })

  it("is a navigation landmark named Docs with every guide under its group", () => {
    const html = render(<DocsNav groups={GROUPS} current="/docs/deploy" />)
    expect(html).toMatch(/^<nav aria-label="Docs"/)
    expect(html.indexOf(">Use</p>")).toBeLessThan(html.indexOf(">The three apps</a>"))
    expect(html.indexOf(">Deploy and operate</a>")).toBeLessThan(html.indexOf(">Build</p>"))
  })

  it("marks only the current guide as the page, with the bar colour on its start edge", () => {
    const html = render(<DocsNav groups={GROUPS} current="/docs/deploy" />)
    const current = html.match(/<a href="\/docs\/deploy"[^>]*>/g) ?? []
    expect(current.length).toBe(2)
    for (const tag of current) {
      expect(tag).toContain('aria-current="page"')
      expect(tag).toContain("border-s-2")
      expect(tag).toContain("border-primary")
    }
    for (const tag of html.match(/<a href="\/docs\/apps"[^>]*>/g) ?? []) {
      expect(tag).not.toContain("aria-current")
      expect(tag).toContain("border-transparent")
    }
  })

  it("folds into a details below lg whose summary names the current guide", () => {
    const html = render(<DocsNav groups={GROUPS} current="/docs/deploy" />)
    expect(html).toMatch(
      /<details class="[^"]*lg:hidden[^"]*"><summary[^>]*>Guides: Deploy and operate<\/summary>/,
    )
    expect(html).toContain('<div class="hidden lg:block">')
  })

  it("says only Guides in the summary when no guide is current, and takes the caller's words", () => {
    expect(render(<DocsNav groups={GROUPS} />)).toMatch(/<summary[^>]*>Guides<\/summary>/)
    const html = render(
      <DocsNav
        groups={GROUPS}
        current="/docs/apps"
        labels={{ label: "Guides", summary: (title) => `Reading: ${title}` }}
      />,
    )
    expect(html).toMatch(/^<nav aria-label="Guides"/)
    expect(html).toContain(">Reading: The three apps</summary>")
  })
})
