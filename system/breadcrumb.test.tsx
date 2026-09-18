import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Breadcrumb } from "./breadcrumb.tsx"
import { breadcrumbsFromCanonical, type Crumb } from "./head.ts"

const TRAIL: Crumb[] = breadcrumbsFromCanonical("https://acme.example/blog/post", "A Post")

describe("Breadcrumb", () => {
  it("renders nothing for an empty trail", () => {
    expect(render(<Breadcrumb items={[]} />)).toBe("")
  })

  it("renders nothing for a trail of exactly one crumb", () => {
    expect(render(<Breadcrumb items={[{ name: "Home", href: "/" }]} />)).toBe("")
  })

  it("renders a labelled nav with an ordered list for two or more crumbs", () => {
    const html = render(<Breadcrumb items={TRAIL} />)

    expect(html).toContain('<nav aria-label="Breadcrumb"')
    expect(html).toContain("<ol")
    expect(html.match(/<li/g)).toHaveLength(TRAIL.length)
  })

  it("marks the last crumb as the current page and leaves it unlinked", () => {
    const html = render(<Breadcrumb items={TRAIL} />)
    const lastItem = html.slice(html.lastIndexOf("<li"))

    expect(lastItem).toContain('aria-current="page"')
    expect(lastItem).not.toContain("<a ")
    expect(lastItem).toContain("A Post")
  })

  it("links every crumb before the last", () => {
    const html = render(<Breadcrumb items={TRAIL} />)

    expect(html).toContain('<a href="/"')
    expect(html).toContain(">Home</a>")
    expect(html).toContain('<a href="/blog"')
    expect(html).toContain(">Blog</a>")
  })

  it("ignores an href on the last crumb", () => {
    const html = render(
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Now", href: "/now" }]} />,
    )
    const lastItem = html.slice(html.lastIndexOf("<li"))

    expect(lastItem).not.toContain('href="/now"')
    expect(lastItem).toContain('aria-current="page"')
  })

  it("renders a crumb without href in the middle as plain text", () => {
    const html = render(
      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Gap" }, { name: "End" }]} />,
    )

    expect(html).toContain("Gap")
    expect(html).not.toContain('href="/Gap"')
    expect(html).toContain('aria-current="page"')
  })

  it("hides the separators from assistive tech and skips one after the last crumb", () => {
    const html = render(<Breadcrumb items={TRAIL} />)

    expect(html.match(/aria-hidden="true"/g)).toHaveLength(TRAIL.length - 1)
    expect(html.match(/>\/</g) ?? []).toHaveLength(TRAIL.length - 1)
  })

  it("takes a custom accessible name and separator", () => {
    const html = render(<Breadcrumb items={TRAIL} label="You are here" separator="›" />)

    expect(html).toContain('aria-label="You are here"')
    expect(html.match(/›/g)).toHaveLength(TRAIL.length - 1)
  })

  it("keeps the caller's utilities and lets them win over the default", () => {
    const html = render(<Breadcrumb items={TRAIL} class="mb-0 print:hidden" />)

    expect(html).toContain("mb-0")
    expect(html).toContain("print:hidden")
    expect(html).not.toContain("mb-6")
  })
})
