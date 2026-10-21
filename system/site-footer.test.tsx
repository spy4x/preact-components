import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { SiteFooter, type SiteFooterGroup } from "./site-footer.tsx"

const groups: SiteFooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Community",
    links: [{ label: "Source code", href: "https://code.example/acme", external: true }],
  },
]

/** Each `<nav …>…</nav>`, whole. */
function navs(html: string): string[] {
  return [...html.matchAll(/<nav[^>]*>.*?<\/nav>/g)].map((m) => m[0])
}

/** The `<a>` for one `href`, whole. */
function linkTo(html: string, href: string): string {
  return html.match(new RegExp(`<a[^>]*href="${href}"[^>]*>.*?</a>`))?.[0] ?? ""
}

/** The root `<footer>`'s opening tag. */
function footerTag(html: string): string {
  return html.match(/<footer[^>]*>/)?.[0] ?? ""
}

describe("SiteFooter", () => {
  it("renders each group as a nav named by its title, holding its heading and its links", () => {
    const html = render(<SiteFooter groups={groups} />)
    const [product, community] = navs(html)

    expect(navs(html)).toHaveLength(2)
    expect(product).toContain('aria-label="Product"')
    expect(product).toContain("<h2")
    expect(product).toContain(">Product</h2>")
    expect(product).toContain('href="/pricing"')
    expect(product).toContain('href="/changelog"')
    expect(product).not.toContain("code.example")
    expect(community).toContain('aria-label="Community"')
    expect(community).toContain('href="https://code.example/acme"')
  })

  it("puts the links of a group in a list, one item each", () => {
    const html = render(<SiteFooter groups={groups} />)
    const product = navs(html)[0]

    expect(product).toContain("<ul")
    expect([...product.matchAll(/<li>/g)]).toHaveLength(2)
  })

  it("marks an external link with a hidden icon after its label, and opens it in the same tab", () => {
    const html = render(<SiteFooter groups={groups} />)
    const external = linkTo(html, "https://code.example/acme")

    expect(external).toMatch(/Source code<svg[^>]*aria-hidden="true"/)
    expect(external).not.toContain("target=")
  })

  it("tells a screen reader where an external link goes, with the caller's words", () => {
    const html = render(
      <SiteFooter
        groups={[{
          title: "More",
          links: [
            {
              label: "Blog",
              href: "https://me.example",
              external: true,
              externalHint: "(opens me.example)",
            },
            { label: "Docs", href: "/docs", externalHint: "(opens docs)" },
          ],
        }]}
      />,
    )
    expect(linkTo(html, "https://me.example")).toMatch(
      /Blog<svg.*?<\/svg><span class="sr-only">\(opens me\.example\)<\/span><\/a>/,
    )
    expect(linkTo(html, "/docs")).not.toContain("sr-only")
  })

  it("draws no icon on a link that is not external", () => {
    const html = render(<SiteFooter groups={groups} />)

    expect(linkTo(html, "/pricing")).not.toContain("<svg")
  })

  it("gives every link 44 px of height on a phone and less from lg up", () => {
    const html = render(<SiteFooter groups={groups} />)
    const link = linkTo(html, "/pricing")

    expect(link).toMatch(/class="[^"]*\bpy-3\b/)
    expect(link).toMatch(/class="[^"]*\btext-sm\b/)
    expect(link).toMatch(/class="[^"]*\blg:py-1\b/)
  })

  it("renders the brand, aside and bottom slots as given", () => {
    const html = render(
      <SiteFooter
        groups={groups}
        brand={<span data-e2e="brand">Acme</span>}
        aside={<form data-e2e="newsletter" />}
        bottom={<p data-e2e="copyright">© Acme</p>}
      />,
    )

    expect(html).toContain('<span data-e2e="brand">Acme</span>')
    expect(html).toContain('<form data-e2e="newsletter"></form>')
    expect(html).toContain('<p data-e2e="copyright">© Acme</p>')
  })

  it("puts the bottom slot under a top border", () => {
    const html = render(<SiteFooter groups={groups} bottom="© Acme" />)

    expect(html).toMatch(/<div class="[^"]*\bborder-t\b[^"]*">© Acme<\/div>/)
  })

  it("gives the groups the last third to the aside from lg up, and the full row without one", () => {
    const withAside = render(<SiteFooter groups={groups} aside="Subscribe" />)
    const withoutAside = render(<SiteFooter groups={groups} />)

    expect(withAside).toContain("lg:col-span-2")
    expect(withAside).toContain("<div>Subscribe</div>")
    expect(withoutAside).toContain("lg:col-span-3")
    expect(withoutAside).not.toContain("lg:col-span-2")
  })

  it("renders nothing empty when no slot is given", () => {
    const html = render(<SiteFooter groups={groups} />)

    expect(html).not.toContain("<div></div>")
    expect(html).not.toMatch(/<div class="[^"]*"><\/div>/)
    // The footer's top border is on the root; no second one is drawn for an absent bottom slot.
    expect([...html.matchAll(/\bborder-t\b/g)]).toHaveLength(1)
  })

  it("treats a slot given as false like a missing one, as in aside={show && <Form />}", () => {
    const html = render(<SiteFooter groups={groups} brand={false} aside={false} bottom={false} />)

    expect(html).not.toContain("<div></div>")
    expect(html).not.toContain("lg:col-span-2")
    expect([...html.matchAll(/\bborder-t\b/g)]).toHaveLength(1)
  })

  it("prints no visible text beyond the caller's own titles, labels and slots", () => {
    const html = render(
      <SiteFooter
        groups={[{ title: "Zzyzx", links: [{ label: "Qwerty", href: "/q", external: true }] }]}
        bottom="Frobnicate"
      />,
    )
    const words = new Set(
      html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean),
    )

    expect(words).toEqual(new Set(["Zzyzx", "Qwerty", "Frobnicate"]))
  })

  it("merges a caller's class onto the footer without losing its own", () => {
    const html = render(<SiteFooter groups={groups} class="mt-16" />)
    const tag = footerTag(html)

    expect(tag).toContain("mt-16")
    expect(tag).toContain("border-t")
    expect(tag).toContain("bg-surface")
  })

  it("balances each group title's lines, so a wrapped title leaves no word alone", () => {
    const html = render(<SiteFooter groups={groups} />)
    expect(html.match(/<h2 class="[^"]*\btext-balance\b[^"]*">/g)?.length).toBe(2)
  })
})
