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
  crumbs: [
    { name: "Home", href: "/" },
    { name: "Products", href: "/products" },
    { name: "Widgets" },
  ],
}

/**
 * A canonical address carrying every part that must not be published: credentials, a mixed-case
 * host, the default port and a fragment. Its cleaned form differs visibly from what is handed in.
 */
const DIRTY_CANONICAL = "https://user:pw@ACME.Example:443/products/widgets?page=2#reviews"
const CLEAN_CANONICAL = "https://acme.example/products/widgets?page=2"

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
    // twitter:card itself is covered below, by the "derives …" and "lets a caller force …" tests.
    const tags = tagMap(PAGE)

    expect(tags.get("twitter:site")).toBe("@acme")
    expect(tags.get("twitter:title")).toBe("Widgets — Acme")
    expect(tags.get("twitter:description")).toBe("Widgets for teams.")
    expect(tags.get("twitter:image")).toBe("https://acme.example/og/widgets.png")
  })

  it("derives summary_large_image when an ogImage is given", () => {
    expect(tagMap(PAGE).get("twitter:card")).toBe("summary_large_image")
  })

  it("derives summary when no ogImage is given", () => {
    const tags = tagMap({ ...PAGE, ogImage: undefined })

    expect(tags.get("twitter:card")).toBe("summary")
  })

  it("lets a caller force summary despite an ogImage", () => {
    const tags = tagMap({ ...PAGE, twitterCard: "summary" })

    expect(tags.get("twitter:card")).toBe("summary")
  })

  it("lets a caller force summary_large_image with no ogImage", () => {
    const tags = tagMap({ ...PAGE, ogImage: undefined, twitterCard: "summary_large_image" })

    expect(tags.get("twitter:card")).toBe("summary_large_image")
  })

  it("never emits twitter:card twice, across every image/override combination", () => {
    const cardTagCount = (head: PageHead) =>
      seoHeadTags(head).filter((tag) => tag.tag === "meta" && tag.attrs.name === "twitter:card")
        .length

    expect(cardTagCount(PAGE)).toBe(1)
    expect(cardTagCount({ ...PAGE, ogImage: undefined })).toBe(1)
    expect(cardTagCount({ ...PAGE, twitterCard: "summary" })).toBe(1)
    expect(cardTagCount({ ...PAGE, ogImage: undefined, twitterCard: "summary_large_image" })).toBe(
      1,
    )
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
  })

  it("does not emit an empty og:image when only the social image is missing", () => {
    const tags = tagMap({ ...PAGE, ogImage: undefined })

    expect(tags.get("og:image")).toBeUndefined()
    expect(tags.get("twitter:image")).toBeUndefined()
  })

  it("emits one script tag, last, for the JSON-LD graph", () => {
    const tags = seoHeadTags(PAGE)
    const last = tags.at(-1)

    expect(last?.tag).toBe("script")
    expect(last?.attrs.type).toBe("application/ld+json")
    expect(tags.filter((tag) => tag.tag === "script")).toHaveLength(1)
  })
})

describe("the canonical address seoHeadTags publishes", () => {
  it("rejects a relative canonical before emitting anything", () => {
    expect(() => seoHeadTags({ ...PAGE, canonical: "/products/widgets" })).toThrow(
      "canonical must be an absolute URL",
    )
  })

  it("rejects a javascript: canonical before emitting anything", () => {
    expect(() => seoHeadTags({ ...PAGE, canonical: "javascript:alert(1)" })).toThrow(
      "canonical must be an http or https URL",
    )
  })

  it("rejects a scheme that is not the web, such as ftp", () => {
    expect(() => seoHeadTags({ ...PAGE, canonical: "ftp://acme.example/widgets" })).toThrow(
      "canonical must be an http or https URL",
    )
  })

  it("puts the cleaned address in rel=canonical, not the string it was handed", () => {
    const tags = tagMap({ ...PAGE, canonical: DIRTY_CANONICAL })

    expect(tags.get("canonical")).toBe(CLEAN_CANONICAL)
  })

  it("puts the cleaned address in og:url too", () => {
    const tags = tagMap({ ...PAGE, canonical: DIRTY_CANONICAL })

    expect(tags.get("og:url")).toBe(CLEAN_CANONICAL)
  })

  it("prints no credentials anywhere in the tag set", () => {
    const printed = JSON.stringify(seoHeadTags({ ...PAGE, canonical: DIRTY_CANONICAL }))

    expect(printed).not.toContain("user:pw")
    expect(printed).not.toContain("pw@")
  })

  it("accepts a plain http canonical rather than insisting on https", () => {
    const tags = tagMap({ ...PAGE, canonical: "http://acme.example/products/widgets" })

    expect(tags.get("canonical")).toBe("http://acme.example/products/widgets")
  })
})

describe("seoHeadJsonLd", () => {
  it("emits the caller's crumbs as the BreadcrumbList", () => {
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
        name: "Widgets",
        item: "https://acme.example/products/widgets",
      },
    ])
  })

  it("invents no breadcrumb for a deep path when the caller stated none", () => {
    const graph = seoHeadJsonLd({
      title: "A Post",
      description: "A post.",
      canonical: "https://acme.example/section/24/title",
    })

    expect(graph).toEqual([])
  })

  it("names a crumb what the caller called it, not what the path segment says", () => {
    const graph = graphOf({
      ...PAGE,
      canonical: "https://acme.example/section/24/title",
      crumbs: [
        { name: "Field reports", href: "/section" },
        { name: "August 2026", href: "/section/24" },
        { name: "How I work" },
      ],
    })
    const breadcrumb = graph.at(-1) as { itemListElement: { name: string }[] }

    expect(breadcrumb.itemListElement.map((item) => item.name)).toEqual([
      "Field reports",
      "August 2026",
      "How I work",
    ])
  })

  it("puts caller entities ahead of the breadcrumb", () => {
    const entity = { "@type": "Organization", "@id": "https://acme.example/#org" }
    const graph = graphOf({ ...PAGE, jsonLd: [entity] })

    expect(graph[0]).toEqual(entity)
    expect((graph[1] as Record<string, unknown>)["@type"]).toBe("BreadcrumbList")
  })

  it("anchors the breadcrumb to the cleaned address, with one fragment marker", () => {
    const graph = graphOf({ ...PAGE, canonical: DIRTY_CANONICAL })
    const breadcrumb = graph.at(-1) as { "@id": string }

    expect(breadcrumb["@id"]).toBe(`${CLEAN_CANONICAL}#breadcrumb`)
    expect(breadcrumb["@id"].match(/#/g)).toHaveLength(1)
  })

  it("skips a one-entry trail, which is noise in a rich result", () => {
    const graph = seoHeadJsonLd({ ...PAGE, crumbs: [{ name: "Widgets" }] })

    expect(graph).toEqual([])
  })

  it("skips the breadcrumb when the caller states no crumbs", () => {
    const entity = { "@type": "WebSite" }
    const graph = seoHeadJsonLd({ ...PAGE, crumbs: undefined, jsonLd: [entity] })

    expect(graph).toEqual([entity])
  })

  it("omits the script tag entirely when the graph is empty", () => {
    const tags = seoHeadTags({
      title: "Acme",
      description: "Home.",
      canonical: "https://acme.example/",
    })

    expect(tags.some((tag) => tag.tag === "script")).toBe(false)
  })

  it("still emits the script for a page that supplies its own entities", () => {
    const tags = seoHeadTags({
      title: "Acme",
      description: "Home.",
      canonical: "https://acme.example/",
      jsonLd: [{ "@type": "WebSite" }],
    })

    expect(tags.at(-1)?.tag).toBe("script")
  })

  it("refuses a javascript: crumb href", () => {
    expect(() =>
      seoHeadJsonLd({
        ...PAGE,
        crumbs: [{ name: "Trap", href: "javascript:alert(1)" }, { name: "Widgets" }],
      })
    ).toThrow("crumb href must be an http or https URL")
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

  it("renders the cleaned canonical address, not the one it was handed", () => {
    const html = render(<SEOHead {...PAGE} canonical={DIRTY_CANONICAL} />)

    expect(html).toContain(`href="${CLEAN_CANONICAL}"`)
    expect(html).not.toContain("pw@")
    expect(html).not.toContain("#reviews")
  })

  it("renders a caller entity carrying a closing tag escaped in the markup", () => {
    const html = render(
      <SEOHead {...PAGE} jsonLd={[{ "@type": "Organization", name: "a </script> trick" }]} />,
    )
    const body = html.slice(html.indexOf('type="application/ld+json"'))

    expect(body).toContain("\\u003c/script")
    // Only the element's own closing tag survives.
    expect(body.indexOf("</script>")).toBe(body.lastIndexOf("</script>"))
  })

  it("renders a crumb name carrying a closing tag escaped too", () => {
    const html = render(
      <SEOHead
        {...PAGE}
        crumbs={[{ name: "</script><script>alert(1)</script>", href: "/" }, { name: "Widgets" }]}
      />,
    )
    const body = html.slice(html.indexOf('type="application/ld+json"'))

    expect(body).toContain("\\u003c/script")
    expect(body.indexOf("</script>")).toBe(body.lastIndexOf("</script>"))
  })

  it("renders nothing but markup — no wrapper element of its own", () => {
    const html = render(<SEOHead {...PAGE} />)

    expect(html.startsWith("<title>")).toBe(true)
  })
})
