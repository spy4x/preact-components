import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import type { PageHead } from "./head.ts"
import { jsonLdText, SEOHead, seoHeadJsonLd, seoHeadTags } from "./seo-head.tsx"

const PAGE: PageHead = {
  title: "Widgets — Acme",
  description: "Widgets for teams.",
  canonical: "https://acme.example/products/widgets",
  ogImage: "https://acme.example/og/widgets.png",
  siteName: "Acme",
  twitterSite: "@acme",
  locale: "en_US",
}

/** Every tag as a flat `key=value` bag, for order-insensitive lookups by name/property. */
function tagMap(head: PageHead): Map<string, string> {
  const map = new Map<string, string>()
  for (const tag of seoHeadTags(head)) {
    const key = tag.attrs.name ?? tag.attrs.property ?? tag.attrs.rel ?? tag.tag
    map.set(key, tag.attrs.content ?? tag.attrs.href ?? tag.text ?? "")
  }
  return map
}

/** The JSON-LD `@graph` a page emits, parsed back out of the rendered markup. */
function graphOf(head: PageHead): unknown[] {
  const script = seoHeadTags(head).find((tag) => tag.tag === "script")?.text
  if (!script) throw new Error("no JSON-LD script for this page")
  return JSON.parse(script)["@graph"] as unknown[]
}

describe("seoHeadTags", () => {
  it("emits the primary meta set in document order", () => {
    const tags = seoHeadTags(PAGE)

    expect(tags.slice(0, 4)).toEqual([
      { tag: "title", attrs: {}, text: "Widgets — Acme" },
      { tag: "meta", attrs: { name: "description", content: "Widgets for teams." } },
      { tag: "link", attrs: { rel: "canonical", href: "https://acme.example/products/widgets" } },
      { tag: "meta", attrs: { name: "robots", content: "index, follow" } },
    ])
  })

  it("emits the twitter card set", () => {
    const tags = tagMap(PAGE)

    expect(tags.get("twitter:card")).toBe("summary_large_image")
    expect(tags.get("twitter:site")).toBe("@acme")
    expect(tags.get("twitter:title")).toBe("Widgets — Acme")
    expect(tags.get("twitter:description")).toBe("Widgets for teams.")
    expect(tags.get("twitter:image")).toBe("https://acme.example/og/widgets.png")
  })

  it("emits the open graph set", () => {
    const tags = tagMap(PAGE)

    expect(tags.get("og:type")).toBe("website")
    expect(tags.get("og:title")).toBe("Widgets — Acme")
    expect(tags.get("og:url")).toBe("https://acme.example/products/widgets")
    expect(tags.get("og:image")).toBe("https://acme.example/og/widgets.png")
    expect(tags.get("og:site_name")).toBe("Acme")
    expect(tags.get("og:locale")).toBe("en_US")
  })

  it("defaults og:type to website and honours an override", () => {
    expect(tagMap(PAGE).get("og:type")).toBe("website")

    const article = tagMap({ ...PAGE, ogType: "article" })
    expect(article.get("og:type")).toBe("article")
  })

  it("switches robots to noindex, nofollow", () => {
    expect(tagMap({ ...PAGE, noindex: true }).get("robots")).toBe("noindex, nofollow")
  })

  it("omits every optional tag a caller did not supply", () => {
    const tags = tagMap({
      title: "Bare",
      description: "Bare page.",
      canonical: "https://acme.example/bare",
    })

    for (const key of ["og:image", "og:site_name", "og:locale", "twitter:site", "twitter:image"]) {
      expect(tags.has(key)).toBe(false)
    }
    // The card type stays: a Twitter card without an image is still a summary.
    expect(tags.get("twitter:card")).toBe("summary_large_image")
  })

  it("does not emit an empty og:image when only the social image is missing", () => {
    const tags = tagMap({ ...PAGE, ogImage: undefined })

    expect(tags.get("og:image")).toBeUndefined()
    expect(tags.get("twitter:image")).toBeUndefined()
  })

  it("rejects a relative canonical before emitting anything", () => {
    expect(() => seoHeadTags({ ...PAGE, canonical: "/products/widgets" })).toThrow(
      "canonical must be an absolute URL",
    )
  })

  it("emits one script tag, last, for the JSON-LD graph", () => {
    const tags = seoHeadTags(PAGE)
    const last = tags.at(-1)

    expect(last?.tag).toBe("script")
    expect(last?.attrs.type).toBe("application/ld+json")
    expect(tags.filter((tag) => tag.tag === "script")).toHaveLength(1)
  })
})

describe("seoHeadJsonLd", () => {
  it("derives a BreadcrumbList from the canonical and the page title", () => {
    const graph = graphOf(PAGE)
    const breadcrumb = graph.at(-1) as Record<string, unknown>

    expect(breadcrumb["@type"]).toBe("BreadcrumbList")
    expect(breadcrumb["@id"]).toBe("https://acme.example/products/widgets#breadcrumb")
    expect(breadcrumb.itemListElement).toEqual([
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
        name: "Widgets — Acme",
        item: "https://acme.example/products/widgets",
      },
    ])
  })

  it("puts caller entities ahead of the breadcrumb", () => {
    const entity = { "@type": "Organization", "@id": "https://acme.example/#org" }
    const graph = graphOf({ ...PAGE, jsonLd: [entity] })

    expect(graph[0]).toEqual(entity)
    expect((graph[1] as Record<string, unknown>)["@type"]).toBe("BreadcrumbList")
  })

  it("honours a custom root label", () => {
    const graph = graphOf({ ...PAGE, homeLabel: "Start" })
    const breadcrumb = graph.at(-1) as { itemListElement: { name: string }[] }

    expect(breadcrumb.itemListElement[0].name).toBe("Start")
  })

  it("skips the breadcrumb on a one-entry trail, such as the site root", () => {
    const graph = seoHeadJsonLd({ ...PAGE, canonical: "https://acme.example/" })

    expect(graph).toEqual([])
  })

  it("skips the breadcrumb when the caller opts out", () => {
    const entity = { "@type": "WebSite" }
    const graph = seoHeadJsonLd({ ...PAGE, breadcrumbs: false, jsonLd: [entity] })

    expect(graph).toEqual([entity])
  })

  it("omits the script tag entirely when the graph is empty", () => {
    const tags = seoHeadTags({
      title: "Acme",
      description: "Home.",
      canonical: "https://acme.example/",
      breadcrumbs: false,
    })

    expect(tags.some((tag) => tag.tag === "script")).toBe(false)
  })

  it("still emits the script for a root page that supplies its own entities", () => {
    const tags = seoHeadTags({
      title: "Acme",
      description: "Home.",
      canonical: "https://acme.example/",
      jsonLd: [{ "@type": "WebSite" }],
    })

    expect(tags.at(-1)?.tag).toBe("script")
  })
})

describe("jsonLdText", () => {
  it("escapes < so a description cannot close the script element", () => {
    const text = jsonLdText({ description: "</script><script>alert(1)</script>" })

    expect(text).not.toContain("</script")
    expect(text).toContain("\\u003c/script")
  })

  it("still parses back to the original value", () => {
    const value = { name: "</script>", nested: { list: [1, "<b>"] } }

    expect(JSON.parse(jsonLdText(value))).toEqual(value)
  })
})

describe("SEOHead", () => {
  it("renders the whole tag set as markup", () => {
    const html = render(<SEOHead {...PAGE} />)

    expect(html).toContain("<title>Widgets — Acme</title>")
    expect(html).toContain('name="description"')
    expect(html).toContain('rel="canonical"')
    expect(html).toContain('href="https://acme.example/products/widgets"')
    expect(html).toContain('property="og:url"')
    expect(html).toContain('name="twitter:card"')
    expect(html).toContain('type="application/ld+json"')
  })

  it("renders the JSON-LD body escaped in the markup", () => {
    const html = render(<SEOHead {...PAGE} title="a </script> trick" />)
    const body = html.slice(html.indexOf('type="application/ld+json"'))

    expect(body).toContain("\\u003c/script")
    // Only the element's own closing tag survives.
    expect(body.indexOf("</script>")).toBe(body.lastIndexOf("</script>"))
  })

  it("renders nothing but markup — no wrapper element of its own", () => {
    const html = render(<SEOHead {...PAGE} />)

    expect(html.startsWith("<title>")).toBe(true)
  })
})
