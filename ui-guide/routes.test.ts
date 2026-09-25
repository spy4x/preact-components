/**
 * The hash route model, asserted on the values `routes.ts` returns — no DOM, no browser, no clock.
 *
 * Every case below is table-driven so a failure names the hash that broke it: a guard that reports
 * "the resolver is wrong" without saying for which input is not a detection. The last three suites
 * drive the live `catalogueSections` instead of a fixture, so adding a section to `registry.ts`
 * fails here rather than silently shipping a catalogue with an unreachable page.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueSections, guidePages, pageOfSection } from "./registry.ts"
import {
  demoHref,
  type IndexRouteMatch,
  pageHref,
  pageOfRoute,
  parseRoute,
  routeHref,
  type RouteMatch,
  routeSlug,
  type RouteTable,
  routeTable,
  routeTableDrift,
} from "./routes.ts"

/** One hash and the match it must produce, echoed in the assertion message. */
interface RouteCase {
  /** The hash to resolve, exactly as a browser or a reader would hand it over. */
  hash: string
  /** The whole match, compared as a value. */
  expected: RouteMatch
}

/** The landing route, with the reason that got it there. */
function index(reason: IndexRouteMatch["reason"], hash: string): IndexRouteMatch {
  return { kind: "index", reason, hash }
}

/** The catalogue's first section, so the cases below read off the registry rather than a fixture. */
const badges = catalogueSections[0]
const inputs = catalogueSections.find((section) => section.id === "inputs")
const classSection = catalogueSections.find((section) => section.kind === "class")
if (!badges || !inputs || !classSection) {
  // Loudly, not silently: a fixture section that the catalogue no longer has would make the cases
  // below assert nothing while staying green.
  throw new Error("the catalogue no longer carries the sections this suite is written against")
}

const CASES: RouteCase[] = [
  {
    hash: "",
    expected: index("empty", "#"),
  },
  {
    hash: "#",
    expected: index("empty", "#"),
  },
  {
    hash: "#/",
    expected: index("empty", "#/"),
  },
  {
    hash: "#/inputs",
    expected: {
      kind: "section",
      sectionId: "inputs",
      slug: "inputs",
      title: inputs.title,
      href: "#/inputs",
      hash: "#/inputs",
    },
  },
  {
    hash: "#/inputs/",
    expected: {
      kind: "section",
      sectionId: "inputs",
      slug: "inputs",
      title: inputs.title,
      href: "#/inputs",
      hash: "#/inputs/",
    },
  },
  {
    hash: "#/inputs/toggle-switch",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "hash",
      hash: "#/inputs/toggle-switch",
    },
  },
  {
    hash: "#/inputs/ToggleSwitch",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "hash",
      hash: "#/inputs/ToggleSwitch",
    },
  },
  {
    hash: "#/inputs%2Ftoggle-switch",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "hash",
      hash: "#/inputs/toggle-switch",
    },
  },
  {
    hash: "#%2Finputs",
    expected: {
      kind: "section",
      sectionId: "inputs",
      slug: "inputs",
      title: inputs.title,
      href: "#/inputs",
      hash: "#/inputs",
    },
  },
  {
    hash: "#toggle-switch",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "fragment",
      hash: "#toggle-switch",
    },
  },
  {
    hash: "toggle-switch",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "fragment",
      hash: "#toggle-switch",
    },
  },
  {
    hash: "#ToggleSwitch",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "fragment",
      hash: "#ToggleSwitch",
    },
  },
  {
    hash: "#demo-ToggleSwitch",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "fragment",
      hash: "#demo-ToggleSwitch",
    },
  },
  {
    hash: "  #TOGGLE-SWITCH  ",
    expected: {
      kind: "demo",
      sectionId: "inputs",
      name: "ToggleSwitch",
      href: "#/inputs/toggle-switch",
      source: "fragment",
      hash: "#TOGGLE-SWITCH",
    },
  },
  {
    // The legacy fragment names a component, not a place: it carries no section, so the section is
    // derived from the name and an unknown name resolves nowhere.
    hash: "#definitely-not-a-component",
    expected: index("unknown", "#definitely-not-a-component"),
  },
  {
    hash: "#/nonsense",
    expected: index("unknown", "#/nonsense"),
  },
  {
    hash: "#/nonsense/toggle-switch",
    expected: index("unknown", "#/nonsense/toggle-switch"),
  },
  {
    hash: "#/inputs/nonsense",
    expected: index("unknown", "#/inputs/nonsense"),
  },
  {
    // Strict on purpose: the demo exists, in another section. The table the build checks writes one
    // canonical href per demo, and a resolver that accepted a second one would weaken that check.
    hash: "#/buttons/toggle-switch",
    expected: index("unknown", "#/buttons/toggle-switch"),
  },
  {
    hash: "#/inputs/toggle-switch/extra",
    expected: index("unknown", "#/inputs/toggle-switch/extra"),
  },
  {
    // The browser owns these: `#icons` is the gallery's own id and `#top` the header's.
    hash: "#icons",
    expected: index("unknown", "#icons"),
  },
  {
    hash: "#top",
    expected: index("unknown", "#top"),
  },
  {
    hash: "#%E0%A4%A",
    expected: index("unknown", "#%E0%A4%A"),
  },
]

describe("parseRoute", () => {
  for (const { hash, expected } of CASES) {
    it(`resolves ${JSON.stringify(hash)}`, () => {
      expect(parseRoute(hash), `hash ${JSON.stringify(hash)}`).toEqual(expected)
    })
  }

  it("never throws and never returns undefined, for anything", () => {
    for (const hash of ["", "#", "#/", "#//", "#////", "%", "#%", "#/#", "#/inputs#x", "\t\n"]) {
      const match = parseRoute(hash)
      expect(match.kind, `hash ${JSON.stringify(hash)} matched nothing`)
        .toMatch(/^(index|section|demo)$/)
    }
  })

  it("reads the sections it is handed rather than a list of its own", () => {
    // The seam the build guard depends on: with a catalogue that has no `buttons` section, a href
    // naming one cannot resolve. A resolver with a hard-coded table would pass this and fail the
    // assertion below it.
    const onlyInputs = catalogueSections.filter((section) => section.id === "inputs")
    const absent = `${routeHref("buttons")}/${routeSlug("Button")}`

    expect(
      parseRoute(absent, onlyInputs).kind,
      `hash ${JSON.stringify(absent)} without that section`,
    )
      .toBe("index")
    expect(parseRoute(demoHref("inputs", "ToggleSwitch"), onlyInputs).kind, "the section it has")
      .toBe("demo")
  })
})

describe("routeSlug", () => {
  const SLUGS: Array<[string, string]> = [
    ["ToggleSwitch", "toggle-switch"],
    ["OnOffButtons", "on-off-buttons"],
    ["Badge", "badge"],
    ["class-input", "class-input"],
    ["inputs", "inputs"],
  ]

  for (const [name, slug] of SLUGS) {
    it(`slugs ${name}`, () => {
      expect(routeSlug(name), `name ${JSON.stringify(name)}`).toBe(slug)
    })
  }
})

describe("routeHref and demoHref", () => {
  it("writes the canonical section href", () => {
    for (const section of catalogueSections) {
      expect(routeHref(section.id), `section ${section.id}`).toBe(`#/${section.id}`)
    }
  })

  it("writes the canonical demo href", () => {
    expect(demoHref("inputs", "ToggleSwitch")).toBe("#/inputs/toggle-switch")
  })

  it("round-trips every href the navigation could write", () => {
    for (const section of catalogueSections) {
      const demoRoutes = section.names.map((name) => demoHref(section.id, name))
      for (const [index, name] of section.names.entries()) {
        const match = parseRoute(demoRoutes[index])
        expect(match, `href ${JSON.stringify(demoRoutes[index])} for ${name}`).toEqual({
          kind: "demo",
          sectionId: section.id,
          name,
          href: demoRoutes[index],
          source: "hash",
          hash: demoRoutes[index],
        })
      }
    }
  })
})

describe("the routes the catalogue needs", () => {
  it("resolves every section the catalogue renders", () => {
    // Driven from `catalogueSections`, not from a list: a section added to `registry.ts` with no
    // route fails here instead of shipping a page nothing can link to.
    for (const section of catalogueSections) {
      const match = parseRoute(routeHref(section.id))
      expect(match.kind, `section ${section.id}: ${routeHref(section.id)}`)
        .toBe("section")
      expect(
        match.kind === "section" ? match.sectionId : undefined,
        `section ${section.id}: resolves to its own section`,
      ).toBe(section.id)
    }
  })

  it("has exactly one route per section, so the union cannot drop one", () => {
    const table = routeTable()
    expect(
      table.sections.length,
      `section routes for ${catalogueSections.length} sections`,
    ).toBe(catalogueSections.length)
    expect(
      new Set(table.sections.map((entry) => entry.href)).size,
      "one href per section route",
    ).toBe(catalogueSections.length)
    expect(
      table.sections.map((entry) => entry.sectionId).sort(),
      "the route table's sections are the catalogue's",
    ).toEqual(catalogueSections.map((section) => section.id).sort())
  })

  it("has a route for every demo in every section", () => {
    const table = routeTable()
    const names = catalogueSections.flatMap((section) =>
      section.names.map((name) => `${section.id}/${name}`)
    )
    expect(
      table.demos.map((entry) => `${entry.sectionId}/${entry.name}`).sort(),
      "the route table's demos are the catalogue's",
    ).toEqual([...names].sort())
    expect(new Set(table.demos.map((entry) => entry.href)).size, "one href per demo")
      .toBe(table.demos.length)
  })

  it("slugs every section and demo uniquely enough to address it", () => {
    const slugs = catalogueSections.map((section) => routeSlug(section.id))
    expect(new Set(slugs).size, "two sections share a slug").toBe(slugs.length)

    const demoSlugs = catalogueSections.flatMap((section) => section.names.map(routeSlug))
    expect(new Set(demoSlugs).size, "two demo names share a slug").toBe(demoSlugs.length)
  })

  it("names a class card the way the catalogue renders it", () => {
    // Class cards are addressed like components, and their ids are namespaced precisely so they do
    // not collide with a component's slug. `class-input` is one of them.
    const name = classSection.names[0]
    const href = demoHref(classSection.id, name)

    expect(parseRoute(href), `href ${JSON.stringify(href)}`).toMatchObject({
      kind: "demo",
      sectionId: classSection.id,
      name,
      href,
    })
    // The legacy fragment shape resolves a class card too, because it addresses the same card id.
    expect(parseRoute(`#${name}`), `fragment ${JSON.stringify(name)}`).toMatchObject({
      kind: "demo",
      name,
      source: "fragment",
    })
  })
})

describe("routeTableDrift", () => {
  /** The real table, with one entry rewritten by `corrupt`, so every case below is a mutation. */
  function table(corrupt: (table: RouteTable) => void): RouteTable {
    const copy: RouteTable = structuredClone(routeTable())
    corrupt(copy)
    return copy
  }

  it("reports nothing for the table the catalogue produces", () => {
    expect(routeTableDrift(routeTable()), "the live route table").toEqual([])
  })

  it("names a section href the resolver would not accept", () => {
    const target = routeTable().sections[0].sectionId
    const drifted = table((copy) => {
      copy.sections[0].href = "#/nonsense"
    })

    // Two reports for one broken href, and both are wanted: the entry stopped being canonical, and
    // it stopped resolving. A single "the table drifted" would hide which of the two broke.
    const drift = routeTableDrift(drifted)
    expect(drift.length, `reports: ${drift.join(" | ")}`).toBe(2)
    expect(drift[0], "the first report names the href").toContain("#/nonsense")
    expect(drift[0], "and the section it was emitted for").toContain(target)
    expect(drift[0], "and the href it should have been").toContain(`#/${target}`)
    expect(drift[1], "the second report says what it resolved to").toContain("index (unknown)")
  })

  it("names a demo href that points at another section's card", () => {
    const drifted = table((copy) => {
      const entry = copy.demos.find((candidate) => candidate.name === "ToggleSwitch")
      if (!entry) throw new Error("the catalogue no longer demos ToggleSwitch")
      entry.sectionId = "buttons"
    })

    // Five reports, because the entry is wrong in five independent ways and each is named: that
    // section's slug, the demo's absence from that section, the canonical href, the round-trip, and
    // the demo that section really had being left with no route at all.
    const drift = routeTableDrift(drifted)
    expect(drift.length, `reports for the mismatched entry: ${drift.join(" | ")}`).toBe(5)
    expect(drift.join(" "), "the report names the demo").toContain("ToggleSwitch")
    expect(drift.join(" "), "and the section it claims").toContain("buttons")
  })

  it("names a canonical href that was rewritten by hand", () => {
    // The same href still resolves — `#badges/badge` is a legitimate route — so this is the case a
    // resolver-only check would miss: the table stopped agreeing with the grammar that writes it.
    const drifted = table((copy) => {
      const entry = copy.sections.find((candidate) => candidate.sectionId === "inputs")
      if (!entry) throw new Error("the catalogue no longer has an inputs section")
      entry.href = "#/INPUTS"
      entry.slug = "Inputs"
    })

    const drift = routeTableDrift(drifted)
    expect(drift.length, `reports for the stale slug and href: ${drift.join(" | ")}`).toBe(3)
    expect(drift.join(" "), "the reports name the href").toContain("#/INPUTS")
    expect(drift.join(" "), "and the expected canonical one").toContain("#/inputs")
  })

  it("names a section the table left out entirely", () => {
    const dropped = catalogueSections.at(-1)
    if (!dropped) throw new Error("the catalogue has no sections")

    const drifted = table((copy) => {
      copy.sections = copy.sections.filter((entry) => entry.sectionId !== dropped.id)
      copy.demos = copy.demos.filter((entry) => entry.sectionId !== dropped.id)
    })

    const drift = routeTableDrift(drifted)
    expect(drift.length, `one section and its demos are gone from the table`).toBeGreaterThan(1)
    expect(drift.join(" "), "the report names the missing section").toContain(dropped.id)
    expect(drift.join(" "), "and says no route was emitted").toContain("no route emitted")
  })

  it("names an id the catalogue has never had", () => {
    const drifted = table((copy) => {
      copy.sections.push({ sectionId: "ghosts", slug: "ghosts", href: "#/ghosts" })
      copy.demos.push({
        sectionId: "ghosts",
        sectionSlug: "ghosts",
        name: "GhostWidget",
        slug: "ghost-widget",
        href: "#/ghosts/ghost-widget",
      })
    })

    const drift = routeTableDrift(drifted)
    expect(drift.length, "an invented section is two reports").toBe(2)
    expect(drift.join(" "), "the report names the id").toContain("ghosts")
    expect(drift.join(" "), "and says the catalogue has no such section").toContain(
      "no such section in the catalogue",
    )
  })

  it("names an href emitted twice", () => {
    const drifted = table((copy) => {
      copy.sections.push({ ...copy.sections[0] })
    })

    const drift = routeTableDrift(drifted)
    expect(drift.join(" "), "the report says the href is used twice").toContain("emitted twice")
  })

  it("names a page whose href opens another page", () => {
    const drifted = table((copy) => {
      const ui = copy.pages.find((page) => page.pageId === "ui")
      if (ui) ui.href = "#/icons"
    })

    const drift = routeTableDrift(drifted)
    expect(drift.join(" | "), "the report names the page and the href").toContain(
      'page "ui" ("#/icons")',
    )
    expect(drift.join(" | "), "and the page it opens instead").toContain("opens page icons")
  })

  it("names a page the table left out entirely", () => {
    const drifted = table((copy) => {
      copy.pages = copy.pages.filter((page) => page.pageId !== "cn")
    })

    expect(routeTableDrift(drifted)).toEqual(['page "cn": no route emitted'])
  })
})

describe("guide pages", () => {
  const cases: Array<{ hash: string; page: string | undefined }> = [
    { hash: "", page: "overview" },
    { hash: "#/", page: "overview" },
    { hash: "#/ui", page: "ui" },
    { hash: "#/UI", page: "ui" },
    { hash: "#/icons", page: "icons" },
    { hash: "#/all", page: "all" },
    { hash: "#/cn", page: "cn" },
    { hash: "#/signals", page: "signals" },
    { hash: "#/inputs", page: "ui" },
    { hash: "#/inputs/toggle-switch", page: "ui" },
    { hash: "#toggle-switch", page: "ui" },
    { hash: "#/forms", page: "theme" },
    { hash: "#/charts", page: "charts" },
    { hash: "#/crud/crud-editor", page: "crud" },
    { hash: "#/ui/toggle-switch", page: undefined },
    { hash: "#/nonsense", page: undefined },
    { hash: "#inputs", page: undefined },
  ]
  for (const { hash, page } of cases) {
    it(`opens ${page ?? "no page"} for ${JSON.stringify(hash)}`, () => {
      expect(pageOfRoute(parseRoute(hash)), hash).toBe(page)
    })
  }

  it("matches a page whose id is not a section's as a page route, with its canonical href", () => {
    expect(parseRoute("#/theme")).toEqual({
      kind: "page",
      pageId: "theme",
      title: "Theme",
      href: "#/theme",
      hash: "#/theme",
    })
  })

  it("keeps a section's route when its id is also its page's", () => {
    expect(parseRoute("#/charts").kind).toBe("section")
    expect(pageHref("charts")).toBe(routeHref("charts"))
  })

  it("links the overview at the bare route", () => {
    expect(pageHref("overview")).toBe("#/")
  })

  it("gives no page an id that is another page's section", () => {
    for (const page of guidePages) {
      const section = catalogueSections.find((candidate) => candidate.id === page.id)
      if (section) expect(pageOfSection(section), page.id).toBe(page.id)
    }
  })

  it("round-trips every page's href to that page", () => {
    for (const page of guidePages) {
      expect(pageOfRoute(parseRoute(pageHref(page.id))), page.id).toBe(page.id)
    }
  })
})
