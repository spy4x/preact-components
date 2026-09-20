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
 * The group whose run of rendered sections stopped matching, for a failure message.
 *
 * The expected sequence is `group, its sections, next group, …`, so the position of the mismatch is
 * enough to say which group is wrong without a second comparison: the last group marker at or
 * before it owns the ids after it. When the mismatch *is* a group marker, that group is the one
 * whose sections were rendered where the marker should be — the one to look at either way.
 *
 * @param expected The sequence this file requires.
 * @param index Where the rendered ids and the expected ones stop agreeing.
 * @returns The group's id, or `"the catalogue"` for a mismatch before every group.
 */
function atFault(expected: string[], index: number): string {
  const markers = expected.slice(0, index + 1).filter((id) => id.startsWith("group-"))

  return markers.at(-1) ?? "the catalogue"
}

/**
 * Which section ids each rendered group must hold, in render order, spelled out.
 *
 * Hand-written on purpose: read from `catalogueGroups`, an assertion would shrink with the very
 * thing it polices — a section dropped from a group would be missing from both sides. This is the
 * independent copy, so the expectation breaks when the data does.
 *
 * `registry.test.ts` checks the partition against the registry; this map checks the *page* against
 * a second opinion, which is why it is not derived. It also catches a section listed under the
 * wrong group, which the registry cannot see: a valid group is a valid group there.
 */
const SECTIONS_IN_GROUPS: Record<string, string[]> = {
  "group-foundations": ["badges", "buttons"],
  "group-surfaces": ["display", "feedback", "forms", "surfaces"],
  "group-inputs": ["inputs", "fields"],
  "group-data": ["charts", "crud"],
  "group-application": ["system", "signals"],
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

  it("renders the sections in the groups' order, and files each one in its group", () => {
    const html = render(<UIGuide />)

    // Two things are asserted here, and only one of them a test can see at all. **The order** — the
    // ids are read in document order and compared against a hand-written sequence, so a rendered
    // order that stopped matching the registry is red. Read from `catalogueSections`, this would
    // compare the page against the registry's own flattening and could not detect a wrong order at
    // all. **The group headings** — that each group is drawn, with its own `h2`, above its sections.
    //
    // What this is *not* is a containment check: `ids.slice` between two group markers proves
    // nothing about nesting, because anything before the first group (`instructions`) can never be
    // inside any run. Nesting is structural in the renderer (a section is a child of its group
    // element) and the partition is `registry.test.ts`'s. Said plainly because the first version of
    // this test claimed more than it checked.
    for (
      const heading of [
        "Foundations",
        "Surfaces and page furniture",
        "Inputs",
        "Data and resources",
        "App shell",
      ]
    ) {
      expect(html, heading).toContain(`>${heading}</h2>`)
    }

    const ids = [...html.matchAll(/id="([a-z-]+)"/g)].map((match) => match[1])
    const groups = ids.filter((id) => id.startsWith("group-") && !id.endsWith("-heading"))

    expect(groups).toEqual([
      "group-foundations",
      "group-surfaces",
      "group-inputs",
      "group-data",
      "group-application",
    ])

    // Every section the catalogue renders, in the order it must appear: group by group, and the
    // groups in the order above. Filtered to the ids this file names, because the document also
    // carries a card anchor (`demo-…`), a form control and a gallery cell per demo. The gallery is
    // last, which is what makes the run between the first and last group sections-only: nothing else
    // may appear among them.
    const known = new Set([
      "instructions",
      "icons",
      ...Object.values(SECTIONS_IN_GROUPS).flat(),
      ...groups,
    ])
    const rendered = ids.filter((id) => known.has(id))

    const expected = [
      "instructions",
      ...groups.flatMap((group) => [group, ...SECTIONS_IN_GROUPS[group]]),
      "icons",
    ]
    // One comparison, named: the whole sequence is asserted, and the failure is reported against the
    // group whose run stopped matching rather than as a diff over every id. An earlier revision
    // asserted this *and* a per-group run loop; the loop could never fail once this passed — its run
    // is a slice of the same comparison — so it was deleted rather than kept as a guard that proves
    // nothing, and its label moved here.
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
        `the groups' order requires ${JSON.stringify(mismatch.expected)}`,
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
