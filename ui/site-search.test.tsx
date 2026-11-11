import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createIndex, loadIndex } from "@spy4x/search"
import { CommandPalette } from "./command-palette.tsx"
import { defaultSiteSearchLabels, SiteSearch } from "./site-search.tsx"
import {
  isSiteHref,
  MAX_REPORTED_QUERY,
  orderGroups,
  parseSiteIndex,
  reportedQuery,
  searchSite,
} from "./site-search-index.ts"

const BASE = "https://site.example/blog/post"
/** A fetch port the string renders never call. */
const noFetch = () => Promise.reject(new Error("not in a string render"))

describe("isSiteHref", () => {
  it("allows paths, fragments and addresses on the page's own origin, and mailto", () => {
    for (
      const href of [
        "/blog/stripe",
        "/pricing#plans",
        "#heading",
        "notes",
        "https://site.example/about",
        "mailto:hello@example.com",
        "MAILTO:hello@example.com",
      ]
    ) expect(isSiteHref(href, BASE), href).toBe(true)
  })

  it("refuses javascript, data, other sites and paths that turn into another site", () => {
    for (
      const href of [
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        " javascript:alert(1)",
        "java\tscript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "https://other.example/",
        "http://site.example/",
        "//other.example/path",
        "/\\other.example/path",
        "/\t/other.example/path",
        "ftp://site.example/file",
      ]
    ) expect(isSiteHref(href, BASE), href).toBe(false)
  })

  it("refuses an entry without an href", () => {
    expect(isSiteHref(undefined, BASE)).toBe(false)
  })
})

describe("parseSiteIndex", () => {
  it("accepts what an index serialises to", () => {
    const json = JSON.parse(JSON.stringify(createIndex([{ label: "Pricing", href: "/pricing" }])))
    expect(loadIndex(parseSiteIndex(json)).search("pric").hits[0].entry.href).toBe("/pricing")
  })

  it("rejects a payload without an index, an entry without a label, or a wrong type", () => {
    expect(() => parseSiteIndex({ entries: [] })).toThrow("Not a site search index")
    expect(() => parseSiteIndex({ entries: [{ href: "/a" }], index: {} })).toThrow(
      "Not a site search index",
    )
    expect(() => parseSiteIndex({ entries: [{ label: "A", href: 1 }], index: {} })).toThrow(
      "Not a site search index",
    )
    expect(() => parseSiteIndex("nope")).toThrow("Not a site search index")
  })
})

describe("searchSite", () => {
  const entries = [
    { label: "Pricing trap", href: "javascript:alert(1)" },
    { label: "Pricing elsewhere", href: "https://other.example/pricing" },
    { label: "Pricing", href: "/pricing" },
    { label: "Pricing plans", href: "/pricing#plans", text: "Plans for a team of any size." },
    { label: "Pricing help", href: "mailto:help@example.com" },
  ]
  const site = { index: createIndex(entries), blocked: 2 }

  it("never lists an entry whose link isSiteHref refuses, even when it ranks first", () => {
    const hits = searchSite(site, "pricing", 10, BASE)
    expect(hits.entries.map((entry) => entry.href)).toEqual([
      "/pricing",
      "/pricing#plans",
      "mailto:help@example.com",
    ])
  })

  it("still fills the rows it is asked for when refused entries rank first", () => {
    expect(searchSite(site, "pricing", 2, BASE).entries.map((entry) => entry.label)).toEqual([
      "Pricing",
      "Pricing plans",
    ])
  })

  it("returns the body snippet and the correction the index reports", () => {
    expect(searchSite(site, "team", 10, BASE).snippets[0]).toContain("team")
    expect(searchSite(site, "pricimg", 10, BASE).correction).toBe("typo")
  })
})

describe("reportedQuery", () => {
  it("trims the query and cuts it to 64 characters without splitting one", () => {
    expect(reportedQuery("  stripe webhooks  ")).toBe("stripe webhooks")
    const long = `${"a".repeat(63)}😀😀`
    expect(reportedQuery(long)).toBe(`${"a".repeat(63)}😀`)
    expect([...reportedQuery("x".repeat(100))].length).toBe(MAX_REPORTED_QUERY)
  })
})

describe("orderGroups", () => {
  it("lists unheaded rows, then the named groups in order, then the rest as they came", () => {
    const rows = [
      { id: "1", group: "Posts" },
      { id: "2", group: "Other" },
      { id: "3" },
      { id: "4", group: "Pages" },
      { id: "5", group: "Posts" },
    ]
    expect(orderGroups(rows, ["Pages", "Posts"]).map((row) => row.id)).toEqual([
      "3",
      "4",
      "1",
      "5",
      "2",
    ])
  })
})

describe("SiteSearch", () => {
  it("renders, before hydration, a field-shaped link to /search?q= with the site's words", () => {
    const html = render(
      <SiteSearch fetch={noFetch} labels={{ placeholder: "Search posts, projects…" }} />,
    )
    expect(html).toContain(`<a href="/search?q="`)
    expect(html).toContain(`aria-label="Search posts, projects…"`)
    expect(html).toContain(">Search posts, projects…</span>")
    expect(html).not.toContain("aria-haspopup")
  })

  it("renders the icon trigger as a named link with no visible words", () => {
    const html = render(<SiteSearch fetch={noFetch} trigger="icon" />)
    const link = html.match(/<a href="\/search\?q="[^>]*>.*?<\/a>/)?.[0] ?? ""
    expect(link).toContain(`aria-label="Search…"`)
    expect(link).not.toContain("Search…<")
  })

  it("gives the icon trigger a tooltip with its name and the Ctrl+K hint", () => {
    const html = render(<SiteSearch fetch={noFetch} trigger="icon" />)
    const tooltip = html.match(/<span id="[^"]*" role="tooltip".*$/)?.[0] ?? ""
    expect(tooltip).toContain("Search…<span")
    expect(tooltip).toContain(">Ctrl</kbd><span>+</span><kbd")
    expect(tooltip).toContain(">K</kbd>")
  })

  it("hints Ctrl+K, not /, on the trigger when the site keeps the default hotkeys", () => {
    const html = render(<SiteSearch fetch={noFetch} />)
    const hint = html.match(/<span aria-hidden="true" data-hotkey-hint.*?<\/kbd><\/kbd><\/span>/)
      ?.[0] ?? ""
    expect(hint).toContain(">Ctrl</kbd><span>+</span><kbd")
    expect(hint).toContain(">K</kbd>")
    expect(hint).not.toContain(">/</kbd>")
  })

  it("says what failed and what to do in its default error", () => {
    expect(defaultSiteSearchLabels.error).toBe(
      "Search couldn't load. Check your connection and type again.",
    )
    expect(defaultSiteSearchLabels.empty("strpe")).toBe("Nothing for “strpe”")
  })
})

describe("CommandPalette trigger", () => {
  it("is a button when no triggerHref is given", () => {
    const html = render(<CommandPalette options={[]} onSelect={() => {}} />)
    expect(html).toContain(`<button type="button"`)
    expect(html).not.toContain("<a ")
  })
})
