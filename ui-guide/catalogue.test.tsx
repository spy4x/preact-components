import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide, uiGuideRoute } from "./+index.tsx"
import { catalogueNames, classDemos, demoRegistry, type PartialDemoRegistry } from "./registry.ts"
import { iconNames } from "./icons.tsx"

/**
 * The first index at which two id sequences differ, or `undefined` when they agree.
 *
 * The document order is asserted as one comparison, so a failure would otherwise print a diff over
 * every id in the catalogue — which says that *something* moved, not where. This turns the same
 * comparison into a named position: the caller names the group whose run stopped matching there.
 *
 * @param actual Ids as rendered, in document order.
 * @param expected Ids as this file requires them.
 * @returns The differing index, or `undefined`.
 */
function firstDifference(actual: string[], expected: string[]): number | undefined {
  const length = Math.max(actual.length, expected.length)

  for (let index = 0; index < length; index++) {
    if (actual[index] !== expected[index]) return index
  }

  return undefined
}

/**
 * The page whose run of rendered sections stopped matching, for a failure message.
 *
 * The expected sequence is `page, its sections, next page, …`, so the position of the mismatch is
 * enough to say which page is wrong without a second comparison: the last page marker at or before
 * it owns the ids after it.
 *
 * @param expected The sequence this file requires.
 * @param index Where the rendered ids and the expected ones stop agreeing.
 * @returns The page's marker, or `"the catalogue"` for a mismatch before every page.
 */
function atFault(expected: string[], index: number): string {
  const markers = expected.slice(0, index + 1).filter((id) => id.startsWith("page-"))

  return markers.at(-1) ?? "the catalogue"
}

/**
 * Which section ids each package's page must hold, in render order, spelled out.
 *
 * Hand-written on purpose: read from `guidePages`, an assertion would shrink with the very thing it
 * polices — a section dropped from a page would be missing from both sides. This is the independent
 * copy, so the expectation breaks when the data does.
 */
const SECTIONS_ON_PAGES: Record<string, string[]> = {
  "page-ui": [
    "badges",
    "buttons",
    "layout",
    "display",
    "feedback",
    "inputs",
    "fields",
    "enhanced-forms",
  ],
  "page-system": ["system"],
  "page-crud": ["crud"],
  "page-charts": ["charts"],
  "page-map": ["map"],
  "page-signals": [],
  "page-theme": ["forms", "surfaces"],
  "page-icons": ["icons"],
  "page-cn": [],
}

/** One entry removed from the shipped registry, to reach the banner a partial one produces. */
function without(...names: Array<keyof typeof demoRegistry>): PartialDemoRegistry {
  const partial: PartialDemoRegistry = { ...demoRegistry }
  for (const name of names) delete partial[name]
  return partial
}

describe("UIGuide", () => {
  it("renders one demo card per registered component", () => {
    const html = render(<UIGuide />)

    expect(catalogueNames.length).toBeGreaterThan(0)
    expect(html.match(/id="demo-/g)?.length).toBe(catalogueNames.length)
    for (const name of catalogueNames) {
      expect(html, name).toContain(`id="demo-${name}"`)
    }
  })

  it("renders every demo's own markup", () => {
    // Rendered entry by entry rather than through the page, so a demo that throws is reported
    // against its own name instead of failing the whole catalogue.
    for (const [name, demo] of Object.entries(demoRegistry)) {
      const html = render(<div>{demo.render()}</div>)
      expect(html.length, name).toBeGreaterThan(10)
      expect(html.startsWith("<div>"), name).toBe(true)
    }
  })

  it("renders each section, the instructions and the icon gallery", () => {
    const html = render(<UIGuide />)

    // Spelled out rather than read from the registry: a section that is dropped from the registry
    // would otherwise disappear from both sides of the assertion.
    for (
      const heading of [
        "General instructions",
        "Badges",
        "Buttons",
        "Display",
        "Feedback",
        "Inputs",
        "Fields",
        "Forms",
        "Surfaces and utilities",
        "Charts",
        "System",
        "CRUD",
      ]
    ) {
      expect(html, heading).toContain(heading)
    }
    for (
      const heading of [
        "badges",
        "fields",
        "forms",
        "surfaces",
        "charts",
        "system",
        "crud",
      ]
    ) {
      expect(html, heading).toContain(`id="${heading}"`)
    }
    expect(html).toContain('id="icons"')
    expect(html).toContain('id="instructions"')
  })

  it("renders every package's page on the all page, in navigation order, each with its sections", () => {
    const html = render(<UIGuide />)

    // Without a hash the guide renders its `all` page: the overview, then every package's page in
    // the navigation's order. The ids are read in document order and compared against the
    // hand-written sequence above, so a section filed on the wrong page, or a page out of order, is
    // red — and the failure names the page whose run stopped matching rather than printing a diff
    // over every id in the catalogue.
    expect(html).toContain(`data-guide-page="all"`)
    const ids = [...html.matchAll(/id="([a-z-]+)"/g)].map((match) => match[1])
    const known = new Set([
      "instructions",
      ...Object.keys(SECTIONS_ON_PAGES),
      ...Object.values(SECTIONS_ON_PAGES).flat(),
    ])
    const rendered = ids.filter((id) => known.has(id))
    const expected = [
      "instructions",
      ...Object.entries(SECTIONS_ON_PAGES).flatMap(([page, sections]) => [page, ...sections]),
    ]

    const differing = firstDifference(rendered, expected)
    const at = differing ?? 0
    const mismatch = differing === undefined ? {} : {
      rendered: rendered[at],
      expected: expected[at],
      where: atFault(expected, at),
    }

    expect(
      mismatch,
      `${mismatch.where} renders the wrong sections: ${JSON.stringify(mismatch.rendered)} where ` +
        `the pages' order requires ${JSON.stringify(mismatch.expected)}`,
    ).toEqual({})
  })

  it("renders one usage block per card, each with a copy control", () => {
    const html = render(<UIGuide />)

    // The block the copy button belongs to. Counted rather than sampled: a card that shipped
    // without one is the failure this asserts against.
    expect(html.match(/data-e2e="usage"/g)?.length).toBe(catalogueNames.length)
    expect(html.match(/aria-label="Copy the /g)?.length).toBe(catalogueNames.length)
    expect(html).toContain(">Usage<")
  })

  it("heads a class card with its title and chips for the classes it applies", () => {
    const html = render(<UIGuide />)

    for (const [name, demo] of Object.entries(classDemos)) {
      expect(html, name).toContain(`id="demo-${name}"`)
      expect(html, demo.title).toContain(demo.title)
      for (const className of demo.classes) {
        expect(html, `.${className}`).toContain(`>.${className}<`)
      }
    }
  })

  it("shows nothing of the icon gallery's fallback when no search is set", () => {
    const html = render(<UIGuide />)

    expect(html).toContain(`${iconNames.length} of ${iconNames.length} shown`)
    expect(html).not.toContain("No glyph matches")
  })

  it("names a component that has no demo", () => {
    const html = render(<UIGuide registry={without("ToggleSwitch")} />)

    expect(html).toContain("1 card is missing from this registry")
    expect(html).toContain("ToggleSwitch")
    expect(html).not.toContain('id="demo-ToggleSwitch"')
  })

  it("names every missing component, and counts them as a plural", () => {
    const html = render(<UIGuide registry={without("ToggleSwitch", "Toastr")} />)

    expect(html).toContain("2 cards are missing from this registry")
    expect(html).toContain("ToggleSwitch")
    expect(html).toContain("Toastr")
  })

  it("renders no banner for the complete registry", () => {
    expect(render(<UIGuide />)).not.toContain("missing from this registry")
  })

  it("forwards the clipboard port to the icon gallery", () => {
    const copied: string[] = []
    const html = render(<UIGuide copy={(text) => void copied.push(text)} />)

    // The port itself only fires on a click, which a server render cannot do; what is asserted here
    // is that the gallery was rendered with it and the catalogue still renders.
    expect(html).toContain('data-icon="IconSearch"')
    expect(copied).toEqual([])
  })
})

describe("uiGuideRoute", () => {
  it("describes a registerable route", () => {
    expect(uiGuideRoute.path).toBe("/ui-guide")
    expect(uiGuideRoute.label.length).toBeGreaterThan(0)
  })

  it("renders the catalogue through the descriptor", () => {
    // The point of the descriptor: an app registers `uiGuideRoute` in its navigation and renders
    // it at `path` instead of leaving the guide unreachable, as one source application's was.
    expect(render(<uiGuideRoute.component />)).toBe(render(<UIGuide />))
  })
})
