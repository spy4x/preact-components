import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { PendingDemos, UIGuide, uiGuideRoute } from "./+index.tsx"
import {
  catalogueNames,
  classDemos,
  demoRegistry,
  type PartialDemoRegistry,
  pendingDemos,
} from "./registry.ts"
import { iconNames } from "./icons.tsx"

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
        "Signals",
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
        "signals",
      ]
    ) {
      expect(html, heading).toContain(`id="${heading}"`)
    }
    expect(html).toContain('id="icons"')
    expect(html).toContain('id="instructions"')
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

  it("lists the components whose demos are declared pending", () => {
    const html = render(<UIGuide />)

    expect(pendingDemos.length).toBeGreaterThan(0)
    expect(html).toContain("Not demonstrated yet")
    for (const entry of pendingDemos) {
      expect(html, entry.packageName).toContain(entry.packageName)
      for (const name of entry.names) {
        expect(html, name).toContain(name)
        // A declared gap is not a card: the worklist names it, the sections do not render it.
        expect(html, name).not.toContain(`id="demo-${name}"`)
      }
    }
  })

  it("publishes a worklist entry it is handed, not only the shipped one", () => {
    // The shipped list is now `ui` alone — charts, system and crud are written up — so the notice
    // would still render if `PendingDemos` ignored its own input and hard-coded the registry read.
    // This drives the component with an entry no registry contains.
    const entry = {
      package: "charts" as const,
      packageName: "@preact-components/charts",
      names: ["SyntheticPendingProbe"],
    }
    const html = render(<PendingDemos entries={[entry]} />)

    expect(html).toContain("Not demonstrated yet")
    expect(html).toContain(entry.packageName)
    expect(html).toContain(entry.names[0])
    expect(catalogueNames, entry.names[0]).not.toContain(entry.names[0])
  })

  it("renders nothing for the worklist when it is handed no entries", () => {
    expect(render(<PendingDemos entries={[]} />)).toBe("")
  })

  it("shows nothing of the icon gallery's fallback when no search is set", () => {
    const html = render(<UIGuide />)

    expect(html).toContain(`${iconNames.length} of ${iconNames.length} shown`)
    expect(html).not.toContain("No glyph matches")
  })

  it("names a component that has no demo", () => {
    const html = render(<UIGuide registry={without("ToggleSwitch")} />)

    expect(html).toContain("1 exported component has no demo")
    expect(html).toContain("ToggleSwitch")
    expect(html).not.toContain('id="demo-ToggleSwitch"')
  })

  it("names every missing component, and counts them as a plural", () => {
    const html = render(<UIGuide registry={without("ToggleSwitch", "Toastr")} />)

    expect(html).toContain("2 exported components have no demo")
    expect(html).toContain("ToggleSwitch")
    expect(html).toContain("Toastr")
  })

  it("renders no banner for the complete registry", () => {
    expect(render(<UIGuide />)).not.toContain("has no demo")
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
    // it at `path` instead of leaving the guide unreachable, as `gb`'s was.
    expect(render(<uiGuideRoute.component />)).toBe(render(<UIGuide />))
  })
})
