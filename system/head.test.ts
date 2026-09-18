import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  breadcrumbFromCanonical,
  breadcrumbListJsonLd,
  breadcrumbsFromCanonical,
  canonicalUrl,
  createHeadStore,
  humanizeSlug,
  type PageHead,
  pathSegments,
} from "./head.ts"

const DEFAULTS: PageHead = {
  title: "Acme — Widgets",
  description: "Widgets for teams.",
  canonical: "https://acme.example/",
  ogImage: "https://acme.example/og.png",
  ogType: "website",
}

describe("pathSegments", () => {
  it("strips a trailing slash", () => {
    expect(pathSegments("https://acme.example/blog/")).toEqual(["blog"])
  })

  it("treats a slash-less and a slash-suffixed path as the same trail", () => {
    expect(pathSegments("https://acme.example/blog/post")).toEqual(
      pathSegments("https://acme.example/blog/post/"),
    )
  })

  it("ignores query, hash, port and protocol", () => {
    expect(pathSegments("http://acme.example:8080/a/b?x=1#frag")).toEqual(["a", "b"])
  })

  it("returns no segments for the root", () => {
    expect(pathSegments("https://acme.example/")).toEqual([])
  })

  it("decodes percent-escaped segments", () => {
    expect(pathSegments("https://acme.example/hello%20world/two")).toEqual(["hello world", "two"])
  })
})

describe("canonicalUrl", () => {
  it("throws a readable error for a relative canonical", () => {
    expect(() => canonicalUrl("/blog")).toThrow("canonical must be an absolute URL")
  })
})

describe("humanizeSlug", () => {
  it("title-cases each hyphenated word", () => {
    expect(humanizeSlug("how-i-work")).toBe("How I Work")
  })

  it("handles underscores and already-capitalised words", () => {
    expect(humanizeSlug("FAQ_page")).toBe("FAQ Page")
  })

  it("returns an empty string for an empty slug", () => {
    expect(humanizeSlug("")).toBe("")
  })
})

describe("breadcrumbsFromCanonical", () => {
  it("returns root plus one crumb per segment, last one linkless", () => {
    expect(breadcrumbsFromCanonical("https://acme.example/blog/2024/post", "A Post")).toEqual([
      { name: "Home", href: "/" },
      { name: "Blog", href: "/blog" },
      { name: "2024", href: "/blog/2024" },
      { name: "A Post" },
    ])
  })

  it("produces the same trail with and without a trailing slash", () => {
    expect(breadcrumbsFromCanonical("https://acme.example/blog/post", "Post")).toEqual(
      breadcrumbsFromCanonical("https://acme.example/blog/post/", "Post"),
    )
  })

  it("returns only the root for the site root", () => {
    expect(breadcrumbsFromCanonical("https://acme.example/", "Acme")).toEqual([
      { name: "Home", href: "/" },
    ])
  })

  it("honours a custom home label and href", () => {
    expect(
      breadcrumbsFromCanonical("https://acme.example/docs", "Docs", {
        homeLabel: "Start",
        homeHref: "/app",
      }),
    ).toEqual([{ name: "Start", href: "/app" }, { name: "Docs" }])
  })

  it("keeps an intermediate crumb even when it is the current page's parent", () => {
    const trail = breadcrumbsFromCanonical("https://acme.example/a/b", "B")

    expect(trail[1]).toEqual({ name: "A", href: "/a" })
    expect(trail[2]).toEqual({ name: "B" })
  })
})

describe("breadcrumbFromCanonical", () => {
  it("positions items from 1 and builds absolute item URLs", () => {
    expect(breadcrumbFromCanonical("https://acme.example/blog/post", "A Post")).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://acme.example/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://acme.example/blog" },
      { "@type": "ListItem", position: 3, name: "A Post", item: "https://acme.example/blog/post" },
    ])
  })

  it("is identical for the trailing-slash and slash-less form", () => {
    expect(breadcrumbFromCanonical("https://acme.example/a/b/", "B")).toEqual(
      breadcrumbFromCanonical("https://acme.example/a/b", "B"),
    )
  })

  it("keeps a subpath mount point out of the item URLs", () => {
    const items = breadcrumbFromCanonical("https://acme.example/app/reports/daily", "Daily")

    expect(items.at(-1)?.item).toBe("https://acme.example/app/reports/daily")
    expect(items[1].item).toBe("https://acme.example/app")
  })

  it("returns just the root for the site root", () => {
    expect(breadcrumbFromCanonical("https://acme.example/", "Acme")).toHaveLength(1)
  })
})

describe("breadcrumbListJsonLd", () => {
  it("anchors the node to the page it describes", () => {
    const node = breadcrumbListJsonLd("https://acme.example/blog", "Blog")

    expect(node["@type"]).toBe("BreadcrumbList")
    expect(node["@id"]).toBe("https://acme.example/blog#breadcrumb")
    expect(node.itemListElement).toHaveLength(2)
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

  it("gives each store its own signal", () => {
    const one = createHeadStore(DEFAULTS)
    const two = createHeadStore(DEFAULTS)
    one.setHead({ title: "One" })

    expect(two.head.value.title).toBe(DEFAULTS.title)
  })
})
