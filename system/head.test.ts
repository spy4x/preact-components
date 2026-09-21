import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  breadcrumbItems,
  breadcrumbListJsonLd,
  canonicalUrl,
  createHeadStore,
  normalizeCanonical,
  type PageHead,
} from "./head.ts"

const DEFAULTS: PageHead = {
  title: "Acme — Widgets",
  description: "Widgets for teams.",
  canonical: "https://acme.example/",
  ogImage: "https://acme.example/og.png",
  ogType: "website",
}

/** The trail a route states for `/products/widgets`, root first, current page last. */
const TRAIL = [
  { name: "Home", href: "/" },
  { name: "Products", href: "/products" },
  { name: "Widgets" },
]

describe("canonicalUrl", () => {
  it("throws a readable error for a relative canonical", () => {
    expect(() => canonicalUrl("/blog")).toThrow("canonical must be an absolute URL")
  })

  it("refuses a javascript: canonical", () => {
    expect(() => canonicalUrl("javascript:alert(1)")).toThrow(
      "canonical must be an http or https URL",
    )
  })

  it("refuses a data: canonical", () => {
    expect(() => canonicalUrl("data:text/html,hello")).toThrow(
      "canonical must be an http or https URL",
    )
  })

  it("refuses a scheme that is not the web, such as ftp", () => {
    expect(() => canonicalUrl("ftp://acme.example/file")).toThrow(
      "canonical must be an http or https URL",
    )
  })

  it("accepts a plain http canonical unchanged", () => {
    expect(canonicalUrl("http://acme.example/a").href).toBe("http://acme.example/a")
  })

  it("accepts a plain https canonical unchanged", () => {
    expect(canonicalUrl("https://acme.example/a").href).toBe("https://acme.example/a")
  })
})

describe("normalizeCanonical", () => {
  it("drops a user name and password", () => {
    expect(normalizeCanonical("https://user:pw@acme.example/a")).toBe("https://acme.example/a")
  })

  it("drops a fragment", () => {
    expect(normalizeCanonical("https://acme.example/a#reviews")).toBe("https://acme.example/a")
  })

  it("keeps the query string, which identifies the page", () => {
    expect(normalizeCanonical("https://acme.example/a?page=2")).toBe(
      "https://acme.example/a?page=2",
    )
  })

  it("drops the default port and keeps a non-default one", () => {
    expect(normalizeCanonical("https://acme.example:443/a")).toBe("https://acme.example/a")
    expect(normalizeCanonical("http://acme.example:8080/a")).toBe("http://acme.example:8080/a")
  })

  it("lower-cases the host and leaves the path's case alone", () => {
    expect(normalizeCanonical("https://ACME.Example/Products/Widgets")).toBe(
      "https://acme.example/Products/Widgets",
    )
  })

  it("gives an origin with no path its root slash", () => {
    expect(normalizeCanonical("https://acme.example")).toBe("https://acme.example/")
  })

  it("produces one clean address from everything at once", () => {
    expect(normalizeCanonical("https://user:pw@ACME.Example:443/a/b?x=1#frag")).toBe(
      "https://acme.example/a/b?x=1",
    )
  })

  it("is unchanged by a second pass", () => {
    const once = normalizeCanonical("https://user:pw@ACME.Example:443/a/b?x=1#frag")

    expect(normalizeCanonical(once)).toBe(once)
  })
})

describe("breadcrumbItems", () => {
  it("numbers the caller's crumbs from 1 and keeps their order", () => {
    expect(breadcrumbItems("https://acme.example/products/widgets", TRAIL)).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://acme.example/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: "https://acme.example/products",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Widgets",
        item: "https://acme.example/products/widgets",
      },
    ])
  })

  it("uses the caller's name verbatim, never a name read out of the path", () => {
    const items = breadcrumbItems("https://acme.example/section/24/title", [
      { name: "Field reports", href: "/section" },
      { name: "August 2026", href: "/section/24" },
      { name: "How I work" },
    ])

    expect(items.map((item) => item.name)).toEqual(["Field reports", "August 2026", "How I work"])
  })

  it("resolves a root-relative crumb href against the canonical origin", () => {
    const items = breadcrumbItems("https://acme.example/a/b", [
      { name: "A", href: "/a" },
      { name: "B" },
    ])

    expect(items[0].item).toBe("https://acme.example/a")
  })

  it("resolves a crumb href relative to the page, not to the origin", () => {
    const items = breadcrumbItems("https://acme.example/a/b/c", [
      { name: "Sibling", href: "../sibling" },
      { name: "C" },
    ])

    expect(items[0].item).toBe("https://acme.example/a/sibling")
  })

  it("keeps an absolute crumb href on another host", () => {
    const items = breadcrumbItems("https://acme.example/a", [
      { name: "Docs", href: "https://docs.example/start" },
      { name: "A" },
    ])

    expect(items[0].item).toBe("https://docs.example/start")
  })

  it("gives the last crumb the page's own cleaned address", () => {
    const items = breadcrumbItems("https://user:pw@acme.example/a?x=1#frag", [
      { name: "Home", href: "/" },
      { name: "A" },
    ])

    expect(items.at(-1)?.item).toBe("https://acme.example/a?x=1")
  })

  it("refuses a javascript: crumb href", () => {
    expect(() =>
      breadcrumbItems("https://acme.example/a", [
        { name: "Trap", href: "javascript:alert(1)" },
        { name: "A" },
      ])
    ).toThrow("crumb href must be an http or https URL")
  })

  it("drops a user name and password from a crumb href", () => {
    const items = breadcrumbItems("https://acme.example/a", [
      { name: "Admin", href: "https://user:pw@acme.example/admin" },
      { name: "A" },
    ])

    expect(items[0].item).toBe("https://acme.example/admin")
  })

  it("returns nothing for an empty trail", () => {
    expect(breadcrumbItems("https://acme.example/a", [])).toEqual([])
  })
})

describe("breadcrumbListJsonLd", () => {
  it("anchors the node to the page it describes", () => {
    const node = breadcrumbListJsonLd("https://acme.example/blog", TRAIL)

    expect(node["@type"]).toBe("BreadcrumbList")
    expect(node["@id"]).toBe("https://acme.example/blog#breadcrumb")
    expect(node.itemListElement).toHaveLength(3)
  })

  it("anchors a canonical carrying a fragment with one fragment marker, not two", () => {
    const node = breadcrumbListJsonLd("https://acme.example/a/b?x=1#frag", TRAIL)

    expect(node["@id"]).toBe("https://acme.example/a/b?x=1#breadcrumb")
    expect(node["@id"].match(/#/g)).toHaveLength(1)
  })

  it("refuses a canonical that is not an http or https address", () => {
    expect(() => breadcrumbListJsonLd("javascript:alert(1)", TRAIL)).toThrow(
      "canonical must be an http or https URL",
    )
  })
})

describe("createHeadStore", () => {
  it("starts from the defaults it was given", () => {
    const store = createHeadStore(DEFAULTS)

    expect(store.head.value).toEqual(DEFAULTS)
  })

  it("merges a patch without dropping the other fields", () => {
    const store = createHeadStore(DEFAULTS)

    const next = store.setHead({ title: "Pricing", canonical: "https://acme.example/pricing" })

    expect(next.title).toBe("Pricing")
    expect(next.description).toBe(DEFAULTS.description)
  })

  it("resets to the defaults, including after a patch", () => {
    const store = createHeadStore(DEFAULTS)
    store.setHead({ title: "Pricing", noindex: true })

    expect(store.resetHead()).toEqual(DEFAULTS)
  })

  it("does not hand out a store that mutates the defaults object", () => {
    const defaults: PageHead = { ...DEFAULTS }
    const store = createHeadStore(defaults)
    store.setHead({ title: "Pricing" })

    expect(defaults.title).toBe(DEFAULTS.title)
  })

  it("gives each store its own signal, so one request cannot write another's head", () => {
    const one = createHeadStore(DEFAULTS)
    const two = createHeadStore(DEFAULTS)
    one.setHead({ title: "One" })

    expect(two.head.value.title).toBe(DEFAULTS.title)
  })
})
