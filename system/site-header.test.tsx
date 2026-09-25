import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { IconBars3 } from "@spy4x/preact-icons"
import { isCurrentLink, SiteHeader, type SiteHeaderLink } from "./site-header.tsx"

const links: SiteHeaderLink[] = [
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs", Icon: IconBars3 },
]

/** One attribute's value off an already-extracted tag, or `undefined`. */
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1]
}

/** The `<summary>` tag, whole. */
function summaryTag(html: string): string {
  return html.match(/<summary[^>]*>/)?.[0] ?? ""
}

/** Every `<a href="…">…</a>` for one `href`, whole tag included — a link appears twice (desktop and
 * mobile), so a test that cares about one instance reads this list rather than assuming a count. */
function linksTo(html: string, href: string): string[] {
  return [...html.matchAll(new RegExp(`<a[^>]*href="${href}"[^>]*>.*?</a>`, "g"))].map((m) => m[0])
}

describe("isCurrentLink", () => {
  it("matches a link whose href equals currentPath", () => {
    expect(isCurrentLink("/docs", "/docs")).toBe(true)
  })

  it("does not match a different href", () => {
    expect(isCurrentLink("/docs", "/pricing")).toBe(false)
  })

  it("matches nothing when currentPath is undefined", () => {
    expect(isCurrentLink("/docs", undefined)).toBe(false)
  })
})

describe("SiteHeader", () => {
  it("renders every link's href, once inline and once in the mobile panel", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    expect(linksTo(html, "/pricing")).toHaveLength(2)
    expect(linksTo(html, "/docs")).toHaveLength(2)
  })

  it("marks the link matching currentPath as the current page, and no other", () => {
    const html = render(<SiteHeader links={links} brand="Acme" currentPath="/docs" />)
    for (const tag of linksTo(html, "/docs")) expect(tag).toContain('aria-current="page"')
    for (const tag of linksTo(html, "/pricing")) expect(tag).not.toContain("aria-current")
  })

  it("marks no link current when currentPath is not given", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    expect(html).not.toContain("aria-current")
  })

  it("renders an icon for a link that has one, and none for a link that does not", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    for (const tag of linksTo(html, "/docs")) expect(tag).toContain("<svg")
    for (const tag of linksTo(html, "/pricing")) expect(tag).not.toContain("<svg")
  })

  it("renders brand exactly as given, with no anchor of the component's own around it", () => {
    const html = render(<SiteHeader links={[]} brand={<span data-e2e="my-brand">Acme</span>} />)
    expect(html).toContain('<span data-e2e="my-brand">Acme</span>')
    expect(html).not.toMatch(/<a[^>]*>\s*<span data-e2e="my-brand"/)
  })

  it("writes no href, link label or brand text of its own", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    // The only distinct hrefs on the page — each link appears once inline and once in the panel —
    // are the caller's own two links.
    const hrefs = new Set([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]))
    expect([...hrefs].sort()).toEqual(["/docs", "/pricing"])
  })

  it("renders actions exactly once, never duplicated into the mobile panel", () => {
    const html = render(
      <SiteHeader
        links={links}
        brand="Acme"
        actions={<button type="button" data-e2e="cta">Book a call</button>}
      />,
    )
    expect([...html.matchAll(/data-e2e="cta"/g)]).toHaveLength(1)
  })

  it("renders nothing extra when actions is not given", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    expect(html).not.toContain('data-e2e="cta"')
  })

  it(
    "omits aria-expanded on the server, rather than a hard-coded value that could go stale " +
      "before hydration reads the disclosure's real state, and names the button either way",
    () => {
      const html = render(<SiteHeader links={links} brand="Acme" />)
      const summary = summaryTag(html)
      expect(attr(summary, "aria-expanded")).toBeUndefined()
      expect(attr(summary, "aria-label")).toBe("Menu")
    },
  )

  it("points the menu button's aria-controls at the panel it opens", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    const controls = attr(summaryTag(html), "aria-controls")
    expect(controls).toBeTruthy()
    expect(html).toContain(`id="${controls}"`)
    expect(html).toContain('data-e2e="site-header-panel"')
  })

  it("builds the mobile panel on <details>, so its links exist with no separate mount", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    expect(html).toContain("<details")
    expect(html).toContain("<summary")
  })

  it("takes a labels override for the menu button and the nav", () => {
    const html = render(
      <SiteHeader
        links={links}
        brand="Acme"
        labels={{ menu: "Ouvrir le menu", nav: "Navigation principale" }}
      />,
    )
    expect(attr(summaryTag(html), "aria-label")).toBe("Ouvrir le menu")
    expect(html).toContain('aria-label="Navigation principale"')
    expect(html).not.toContain('Menu"')
    expect(html).not.toContain("Main navigation")
  })

  it("positions the panel to overlay the header instead of sitting in its own flow", () => {
    const html = render(<SiteHeader links={links} brand="Acme" />)
    const headerTag = html.match(/<header class="[^"]*">/)?.[0] ?? ""
    const panelTag = html.match(/<div id="[^"]*" class="[^"]*" data-e2e="site-header-panel">/)
      ?.[0] ?? ""
    expect(headerTag).toContain("relative")
    expect(panelTag).toContain("absolute")
    expect(panelTag).toContain("inset-x-0")
  })

  it("prints no visible text beyond the caller's own brand, link labels and actions", () => {
    const html = render(
      <SiteHeader
        links={[{ label: "Zzyzx", href: "/zzyzx" }]}
        brand={<span data-e2e="brand">Qwerty Corp</span>}
        actions={<button type="button">Frobnicate</button>}
      />,
    )
    // Every tag is stripped with its attributes, so an aria-label never shows up here — the menu
    // button's own name has no visible text at all, only the two SVG icons this component draws.
    const words = new Set(
      html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean),
    )
    expect(words).toEqual(new Set(["Qwerty", "Corp", "Zzyzx", "Frobnicate"]))
  })

  it("reports the accessible names the caller asked for, not a hard-coded pair", () => {
    const html = render(
      <SiteHeader
        links={links}
        brand="Acme"
        labels={{ menu: "Site menu", nav: "Header links" }}
      />,
    )
    expect([...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1])).toEqual([
      "Header links",
      "Site menu",
      "Header links",
    ])
  })

  it("merges a caller's class onto the header without losing its own", () => {
    const html = render(<SiteHeader links={links} brand="Acme" class="shadow-lg" />)
    const headerTag = html.match(/<header class="[^"]*">/)?.[0] ?? ""
    expect(headerTag).toContain("shadow-lg")
    expect(headerTag).toContain("border-b")
  })
})
