import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import * as icons from "@preact-components/icons"
import { filterIconNames, IconGallery, iconNames, iconSnippet } from "./icons.tsx"

/** Function exports of the icon module — the gallery's source of truth, read the same way. */
const exportedIcons = Object.entries(icons)
  .filter(([, value]) => typeof value === "function")
  .map(([name]) => name)

/** Every `data-icon` the gallery rendered, in render order. */
function renderedIconNames(html: string): string[] {
  return [...html.matchAll(/data-icon="([^"]+)"/g)].map((match) => match[1])
}

describe("IconGallery", () => {
  it("exposes every function the icon package exports", () => {
    expect(iconNames.length).toBeGreaterThan(0)
    expect(iconNames).toEqual(exportedIcons)
  })

  it("renders every exported glyph without a maintenance list", () => {
    const rendered = renderedIconNames(render(<IconGallery />))

    // Both sides come from the module, so a new glyph appears here with no edit to the catalogue.
    expect(rendered).toEqual(exportedIcons)
    expect(rendered.length).toBe(iconNames.length)
  })

  it("labels every cell with the name minus the Icon prefix", () => {
    const html = render(<IconGallery />)

    for (const name of ["IconSearch", "IconTrashBin", "IconEllipsisVertical"]) {
      expect(html, name).toContain(`>${name.replace(/^Icon/, "")}</span>`)
    }
  })

  it("reports the visible and total counts", () => {
    const html = render(<IconGallery />)

    expect(html).toContain(`${iconNames.length} of ${iconNames.length} shown`)
  })
})

describe("filterIconNames", () => {
  it("keeps every name for an empty query", () => {
    expect(filterIconNames(iconNames, "")).toEqual(iconNames)
  })

  it("keeps every name for a whitespace-only query", () => {
    expect(filterIconNames(iconNames, "   ")).toEqual(iconNames)
  })

  it("matches a substring case-insensitively", () => {
    const matches = filterIconNames(iconNames, "search")

    expect(matches).toContain("IconSearch")
    expect(matches.every((name) => name.toLowerCase().includes("search"))).toBe(true)
  })

  it("matches on the middle of a name, not just the prefix", () => {
    expect(filterIconNames(iconNames, "trash")).toContain("IconTrashBin")
  })

  it("matches nothing for a query no glyph contains", () => {
    expect(filterIconNames(iconNames, "zzzz-not-a-glyph")).toEqual([])
  })

  it("preserves the order it was given", () => {
    const matches = filterIconNames(iconNames, "icon")

    expect(matches).toEqual(iconNames)
  })
})

describe("iconSnippet", () => {
  it("produces the JSX a consumer pastes", () => {
    expect(iconSnippet("IconSearch")).toBe("<IconSearch />")
  })
})
