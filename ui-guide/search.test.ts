import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { demoRegistry, guidePages } from "./registry.ts"
import { searchEntries, type SearchEntry, searchIndex, SearchKind } from "./search.tsx"

/** A small index whose ranking is known by construction. */
const entries: SearchEntry[] = [
  { label: "Tabs", detail: "UI · Display", href: "#/display/tabs", kind: SearchKind.COMPONENT },
  { label: "Table", detail: "UI · Display", href: "#/display/table", kind: SearchKind.COMPONENT },
  {
    label: "DataTable",
    detail: "UI · Display",
    href: "#/display/data-table",
    kind: SearchKind.COMPONENT,
  },
  {
    label: "Badge",
    detail: "UI · Table helpers",
    href: "#/badges/badge",
    kind: SearchKind.COMPONENT,
  },
  { label: "table", detail: "Guide", href: "#/table", kind: SearchKind.PAGE },
]

describe("searchEntries", () => {
  it("ranks an exact name, then a prefix, then a substring, then a match in the place", () => {
    expect(searchEntries(entries, "table").map((entry) => entry.label)).toEqual([
      "Table",
      "table",
      "DataTable",
      "Badge",
    ])
    expect(searchEntries(entries, "Tab").map((entry) => entry.label)).toEqual([
      "Tabs",
      "Table",
      "table",
      "DataTable",
      "Badge",
    ])
  })

  it("folds case and accents, and trims the query", () => {
    expect(searchEntries(entries, "  TÁBS ").map((entry) => entry.label)).toEqual(["Tabs"])
  })

  it("offers the pages alone for an empty query", () => {
    expect(searchEntries(entries, "").map((entry) => entry.kind)).toEqual([SearchKind.PAGE])
  })

  it("returns at most the limit", () => {
    expect(searchEntries(entries, "a", 2)).toHaveLength(2)
  })
})

describe("searchIndex", () => {
  it("names the place of a page outside every package with the word it is given", () => {
    const overview = searchIndex(demoRegistry, "Anleitung").find((entry) => entry.href === "#/")
    expect(overview?.detail).toBe("Anleitung")
  })

  it("finds a component by its name and leads to its card", () => {
    const badge = searchIndex(demoRegistry).find((entry) => entry.label === "Badge")

    expect(badge?.kind).toBe(SearchKind.COMPONENT)
    expect(badge?.href).toBe("#/badges/badge")
  })

  it("finds a helper an example covers by its own name, leading to that example", () => {
    const helper = searchIndex(demoRegistry).find((entry) => entry.label === "paddedDomain")

    expect(helper?.kind).toBe(SearchKind.HELPER)
    expect(helper?.href).toBe("#/charts-examples/nice-scale")
  })

  it("lists every page but the all-pages document", () => {
    const pages = searchIndex(demoRegistry).filter((entry) => entry.kind === SearchKind.PAGE)

    expect(pages.map((entry) => entry.label)).toEqual(
      guidePages.filter((page) => page.id !== "all").map((page) => page.title),
    )
  })

  it("leaves out a card the registry does not carry", () => {
    const { Badge: _left, ...rest } = demoRegistry

    expect(searchIndex(rest).some((entry) => entry.label === "Badge")).toBe(false)
  })
})
