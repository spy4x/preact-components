/**
 * The catalogue's own data: that every card is a card, every section is a section, and the two
 * namespaces the page addresses cards by do not collide.
 *
 * Whether the cards cover the packages is `coverage.test.ts`'s question, not this file's.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  catalogueNames,
  catalogueSections,
  CLASS_PACKAGE,
  classDemoNames,
  classDemos,
  coveredPackageIds,
  demoRegistry,
  guidePageIds,
  guidePages,
  missingDemos,
  type PackageId,
  packageIds,
  packagePages,
} from "./registry.ts"

/** A copy of the registry with one entry removed, so the missing-card path can be exercised. */
function without(...names: string[]): Partial<typeof demoRegistry> {
  const partial: Partial<typeof demoRegistry> = { ...demoRegistry }
  for (const name of names) delete partial[name]
  return partial
}

describe("the catalogue", () => {
  it("registers exactly one demo per card the sections document", () => {
    expect(Object.keys(demoRegistry).sort()).toEqual([...catalogueNames].sort())
    expect(Object.keys(demoRegistry).length).toBe(catalogueNames.length)
  })

  it("gives every demo a summary, a snippet and a render function", () => {
    for (const [name, demo] of Object.entries(demoRegistry)) {
      expect(demo.summary.length, name).toBeGreaterThan(10)
      // A component or class snippet is JSX.
      expect(demo.snippet, name).toContain("<")
      expect(typeof demo.render, name).toBe("function")
    }
  })

  it("puts every card in exactly one section", () => {
    const grouped = catalogueSections.flatMap((section) => section.names)

    // Also the check for a name two packages happen to share: the registry is flat, so a collision
    // would silently render one card for two components.
    expect(new Set(grouped).size, "a name appears in two sections").toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...catalogueNames].sort())
  })

  it("gives every section a heading, a blurb, a package and at least one demo", () => {
    expect(catalogueSections.length).toBeGreaterThan(packageIds.length)

    for (const section of catalogueSections) {
      expect(coveredPackageIds, section.id).toContain(section.package)
      expect(section.packageName, section.id).toBe(`@spy4x/preact-${section.package}`)
      expect(section.title.length, section.id).toBeGreaterThan(0)
      expect(section.blurb.length, section.id).toBeGreaterThan(10)
      expect(section.names.length, section.id).toBeGreaterThan(0)
    }
  })

  it("files the class demos under the theme package, keyed apart from the components", () => {
    const classSections = catalogueSections.filter((section) => section.kind === "class")
    expect(classSections.length).toBeGreaterThan(0)

    for (const section of classSections) {
      expect(section.package, section.id).toBe(CLASS_PACKAGE)
      expect(Object.keys(classDemos), section.id).toEqual(expect.arrayContaining(section.names))
    }

    // A card id that looked like a component name — `input` next to `Input`, `card` next to `Card`
    // — would slug to the same fragment as that component's card, and the page writes one fragment
    // per card. `class-` keeps the two namespaces apart by construction rather than by a collision
    // test somebody has to re-run when a component lands.
    const components = new Set(
      catalogueSections.filter((section) => section.kind === "component")
        .flatMap((section) => section.names),
    )
    for (const name of classDemoNames) {
      expect(name.startsWith("class-"), `${name} is not namespaced`).toBe(true)
      expect(components.has(name), `${name} collides with a component card`).toBe(false)
    }
  })

  it("gives every class demo a heading, a class list and a demo's own fields", () => {
    expect(Object.keys(classDemos).sort()).toEqual([...classDemoNames].sort())

    for (const [name, demo] of Object.entries(classDemos)) {
      expect(demo.title.length, name).toBeGreaterThan(0)
      expect(demo.classes.length, `${name} claims no class`).toBeGreaterThan(0)
    }
  })

  it("names every package it covers with a specifier of its own", () => {
    for (const id of packageIds) {
      const sections = catalogueSections.filter((section) => section.package === id)
      expect(sections.length, `${id satisfies PackageId} has no section`).toBeGreaterThan(0)
    }
  })
})

describe("missingDemos", () => {
  it("reports nothing for the complete registry", () => {
    expect(missingDemos(demoRegistry)).toEqual([])
  })

  it("reports a card whose demo is missing", () => {
    expect(missingDemos(without("ToggleSwitch"))).toEqual(["ToggleSwitch"])
  })

  it("reports every missing card, in render order", () => {
    // `catalogueNames` is render order, so the report is stable rather than registration order.
    const expected = catalogueNames.filter((name) => name === "Badge" || name === "Toastr")

    expect(missingDemos(without("Badge", "Toastr"))).toEqual(expected)
    expect(expected.length).toBe(2)
  })
})

describe("guidePages", () => {
  it("puts every section on exactly one package's page", () => {
    for (const section of catalogueSections) {
      const pages = packagePages.filter((page) =>
        page.sections.some((candidate) => candidate.id === section.id)
      )
      expect(pages.map((page) => page.id), section.id).toEqual([
        section.package === CLASS_PACKAGE ? "theme" : section.package,
      ])
    }
  })

  it("gives the overview no section, and every section to some page", () => {
    const overview = guidePages.find((page) => page.id === "overview")
    expect(overview?.sections).toEqual([])
    expect(guidePages.flatMap((page) => page.sections).length).toBe(catalogueSections.length)
  })

  it("reads UI, Icons, Theme, Charts, Map, System, CRUD after the overview, with no Everything page", () => {
    expect(guidePageIds).toEqual([
      "overview",
      "ui",
      "icons",
      "theme",
      "charts",
      "map",
      "system",
      "crud",
    ])
    expect(guidePages.map((page) => page.title)).not.toContain("Everything")
  })

  it("gives a package that exports no component no page", () => {
    const pageIds: readonly string[] = guidePageIds
    for (const id of ["signals", "cn"]) expect(pageIds, id).not.toContain(id)
  })

  it("names every package page's package, and gives every page a title and a blurb", () => {
    for (const page of guidePages) {
      expect(page.title.length, page.id).toBeGreaterThan(0)
      expect(page.blurb.length, page.id).toBeGreaterThan(20)
    }
    for (const page of packagePages) {
      expect(page.packageName, page.id).toBe(`@spy4x/preact-${page.id}`)
    }
    expect(packagePages.map((page) => page.id)).not.toContain("overview")
  })
})
