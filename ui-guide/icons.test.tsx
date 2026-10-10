import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options } from "preact"
import { render } from "preact-render-to-string"
import * as icons from "@spy4x/preact-icons"
import { filterIconNames, IconGallery, iconNames, iconSnippet } from "./icons.tsx"

/** Function exports of the icon module — the gallery's source of truth, read the same way. */
const exportedIcons = Object.entries(icons)
  .filter(([, value]) => typeof value === "function")
  .map(([name]) => name)

/** Every `data-icon` the gallery rendered, in render order. */
function renderedIconNames(html: string): string[] {
  return [...html.matchAll(/data-icon="([^"]+)"/g)].map((match) => match[1])
}

/**
 * Render the gallery and return each glyph button's click handler, keyed by icon name.
 *
 * There is no DOM here, so the handlers are read off the element tree as it is created, the same
 * way `copy.test.tsx` reads a card's copy control.
 *
 * @param copy Clipboard port handed to the gallery.
 */
function glyphClicks(copy: (text: string) => void): Map<string, () => void> {
  const clicks = new Map<string, () => void>()
  const previous = options.vnode
  options.vnode = (vnode) => {
    const props = vnode.props as { "data-icon"?: string; onClick?: () => void }
    if (vnode.type === "button" && props["data-icon"] && props.onClick) {
      clicks.set(props["data-icon"], props.onClick)
    }
    previous?.(vnode)
  }
  try {
    render(<IconGallery copy={copy} />)
  } finally {
    options.vnode = previous
  }
  return clicks
}

describe("IconGallery", () => {
  it("hands a clicked glyph's snippet to the caller's copy port", () => {
    const copied: string[] = []
    const clicks = glyphClicks((text) => void copied.push(text))
    const name = iconNames[0]

    clicks.get(name)?.()

    expect(clicks.size).toBe(iconNames.length)
    expect(copied).toEqual([iconSnippet(name)])
  })

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
    // The break opportunities between words are markup, not text: read the caption without them.
    const html = render(<IconGallery />).replaceAll("<wbr/>", "")

    for (const name of ["IconSearch", "IconTrashBin", "IconEllipsisVertical"]) {
      expect(html, name).toContain(`>${name.replace(/^Icon/, "")}</span>`)
    }
  })

  it("lets a long name wrap between its words instead of cutting it off", () => {
    const html = render(<IconGallery />)

    expect(html).toContain(">Arrow<wbr/>Down<wbr/>Tray</span>")
    expect(html).toContain(">Search</span>")
    expect(html).not.toContain("truncate")
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

describe("IconGallery's card", () => {
  it("heads the card with an h3, or with an h2 when the page has no section heading", () => {
    expect(render(<IconGallery />)).toMatch(/<h3 [^>]*>Icon/)
    const html = render(<IconGallery headingLevel={2} />)
    expect(html).toMatch(/<h2 [^>]*>Icon/)
    expect(html).not.toContain("<h3")
  })

  it("is one wide guide card addressed as #icons", () => {
    const html = render(<IconGallery />)

    expect(html).toMatch(/^<article id="icons" data-card-size="wide"/)
    expect(html).toContain('data-card-part="demo"')
    expect(html).toContain('data-e2e="usage"')
  })

  it("takes its words from the labels", () => {
    const html = render(
      <IconGallery
        labels={{ search: "Glyphen suchen", status: (shown, total) => `${shown}/${total}` }}
      />,
    )

    expect(html).toContain('aria-label="Glyphen suchen"')
    expect(html).toContain(`>${iconNames.length}/${iconNames.length}</p>`)
  })
})
