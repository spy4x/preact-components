import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import * as charts from "@preact-components/charts"
import * as crud from "@preact-components/crud"
import * as signals from "@preact-components/signals"
import * as system from "@preact-components/system"
import * as ui from "@preact-components/ui"
import {
  AUTO_PENDING_PACKAGES,
  catalogueGroupIds,
  catalogueGroups,
  catalogueGroupsWithHeadings,
  catalogueNames,
  catalogueSections,
  CLASS_PACKAGE,
  classDemoNames,
  classDemos,
  componentNames,
  demoRegistry,
  EXCLUDED_PACKAGES,
  exportsOf,
  helperExportNames,
  isConventionalHelper,
  missingDemos,
  type PackageId,
  packageIds,
  PACKAGES,
  PASCAL_CASE_HELPERS,
  PENDING_DEMOS,
  pendingDemos,
  pendingNamesOf,
  registryDrift,
  sectionIds,
  SUBPATH_ONLY_HELPERS,
  UI_HELPERS,
} from "./registry.ts"

/**
 * A copy of the registry with one entry removed.
 *
 * The shipped registry is total, so nothing in a healthy tree can produce a partial one — which is
 * exactly why the missing-demo path needs an input like this to be exercised rather than assumed.
 */
function without(...names: Array<keyof typeof demoRegistry>): Partial<typeof demoRegistry> {
  const partial: Partial<typeof demoRegistry> = { ...demoRegistry }
  for (const name of names) delete partial[name]
  return partial
}

/** Each covered package's barrel, keyed the way {@link PACKAGES} keys it. */
const barrels: Record<PackageId, object> = { ui, charts, system, crud, signals }

/**
 * Declared helpers a package exports from a subpath module and not from its barrel.
 *
 * Stated once, per package, because the two lists are checked against opposite sides of the same
 * pair: a declaration here is not stale just because the barrel omits it, and
 * `subpath-exports.test.ts` is the guard that reads the modules instead. `ui` states its eleven in
 * `SUBPATH_ONLY_HELPERS`; `charts` reaches the two d3 internals through `./d3-line-chart` only.
 */
const subpathOnlyHelpers: Record<PackageId, readonly string[]> = {
  ui: SUBPATH_ONLY_HELPERS,
  charts: ["MISSING_D3_LINE_ERROR", "assertD3Available"],
  system: [],
  crud: [],
  signals: [],
}

/**
 * Every declared helper of every covered package, read from {@link PACKAGES}.
 *
 * The convention checks below use this rather than `exportsOf(id).helpers`, which is only the
 * barrel-intersected split: a name a package exports from a subpath module alone is in the declared
 * union and in no barrel, so reading the split left that half of the lists unchecked — a PascalCase
 * component declared in `SUBPATH_ONLY_HELPERS` was invisible to both convention tests.
 */
function declaredHelpers(): string[] {
  return packageIds.flatMap((id) => [...PACKAGES[id].helpers])
}

/**
 * A component name no package exports, no section demos and no list declares.
 *
 * The auto-pending path is unreachable from the shipped tree — every `ui` component has a demo — so
 * the resolver is driven with this instead, and the guard is proved by deleting the mechanism.
 */
const UNDEMOED_PROBE = "UndemoedProbe"

/** Every component name the sections demo for one package. */
function demoedFor(id: PackageId): string[] {
  return catalogueSections.filter((section) => section.package === id).flatMap((s) => s.names)
}

/**
 * Top-level directories that carry a package config.
 *
 * Read from the tree rather than from the root `workspace` array: a directory that ships a
 * `deno.json` is a package whatever a config somewhere else says, and the guide's coverage claim is
 * about what exists.
 */
async function packageDirectories(): Promise<string[]> {
  const root = new URL("../", import.meta.url)
  const directories: string[] = []

  for await (const entry of Deno.readDir(root)) {
    if (!entry.isDirectory) continue
    try {
      const config = await Deno.stat(new URL(`${entry.name}/deno.json`, root))
      if (config.isFile) directories.push(entry.name)
    } catch {
      // No package config: not a package.
    }
  }

  return directories.sort()
}

describe("demo registry", () => {
  it("accounts for every value each covered package exports", () => {
    for (const id of packageIds) {
      const { components, helpers } = exportsOf(id)
      expect([...components, ...helpers].sort(), id).toEqual(Object.keys(barrels[id]).sort())
    }
  })

  it("declares no helper its package's barrel does not export", () => {
    // A stale entry would not fail the type guard — `Exclude` ignores a name that is not in the
    // namespace — so this is what catches a helper that has been renamed or dropped. The declared
    // half is the barrel's, so the comparison is against the barrel, and the names a package
    // deliberately exports from a subpath module alone are the stated exception:
    // `subpath-exports.test.ts` holds those to the module that exports them, per package.
    //
    // This is *liveness* only — that every declared name exists. The converse, that every helper
    // exists in a list, cannot be decided from the barrel without a second component manifest, which
    // is the maintenance the declaration design exists to remove; the convention-shaped half of it
    // is asserted in `subpath-exports.test.ts` instead, where the declared lists are compared against
    // both sides of the pair and a `ui`-style camelCase export has to appear in one of them.
    for (const id of packageIds) {
      const exported = new Set(Object.keys(barrels[id]))
      const subpathOnly = subpathOnlyHelpers[id]
      const stale = PACKAGES[id].helpers.filter((name) =>
        !exported.has(name) && !subpathOnly.includes(name)
      )
      expect(stale, id).toEqual([])
    }

    // The two lists of one package must not overlap, in either direction, because each direction
    // hides a different defect:
    //
    // * a barrel-backed name declared in the subpath-only list is checked against no barrel at all —
    //   the barrel check below skips it and `subpath-exports.test.ts` finds it on the module it came
    //   from, so nothing ever confirms it is on the barrel. This test does, here.
    // * a name in both lists is ambiguous: the drift guard subtracts it once, and whichever list a
    //   reader trusts, the other is a declaration nothing verifies. Only `ui` can be checked this
    //   way, because it is the only package with a second list; `charts`' two subpath-only names are
    //   named in this file instead and cannot appear in `CHARTS_HELPERS` as well.
    for (const id of packageIds) {
      const subpathOnly = new Set(subpathOnlyHelpers[id])
      const barrelBacked = Object.keys(barrels[id]).filter((name) => subpathOnly.has(name))
      expect(barrelBacked, `${id}: declared as both barrel-backed and subpath-only`).toEqual([])
    }

    const bothLists = UI_HELPERS.filter((name) =>
      (SUBPATH_ONLY_HELPERS as readonly string[]).includes(name)
    )
    expect(bothLists, "ui: declared in both helper lists").toEqual([])

    expect(
      subpathOnlyHelpers.ui.length,
      "the exception is not a blanket exemption",
    ).toBeLessThan(UI_HELPERS.length)
  })

  it("classifies a value export as a helper only when its package declares it", () => {
    // Both halves of the split are pinned here, so removing either the declaration or the
    // arithmetic fails this test. A name the helper convention would once have absorbed on sight —
    // `pageRange`, `clampProgress` — is a component until it is written into `UI_HELPERS`, which is
    // what stopped an undeclared camelCase export from leaving the guard with nothing to say.
    const { components, helpers } = exportsOf("ui")
    const helperNames = new Set(helpers)
    const componentSet = new Set<string>(components)

    expect(helperNames.has("clampConfidence"), "declared, camelCase").toBe(true)
    expect(helperNames.has("pageRange"), "declared, camelCase").toBe(true)
    expect(componentSet.has("Pagination"), "PascalCase stays a component").toBe(true)
    expect(componentSet.has("pageRange"), "an undeclared name is a component").toBe(false)
    expect(isConventionalHelper("clampProgress"), "camelCase").toBe(true)
    expect(isConventionalHelper("DEFAULT_AXIS_COLOR"), "SCREAMING_CASE").toBe(true)
    expect(isConventionalHelper("TIMEOUT"), "no underscore to read").toBe(false)
    expect(isConventionalHelper("D3LineChart"), "digit-led PascalCase is a component").toBe(false)
    expect(isConventionalHelper("EmptyState"), "PascalCase is a component").toBe(false)
  })

  it("declares every helper whose name does not read as one", () => {
    // With names no longer deciding anything, this is the remaining tie between a declaration and
    // the naming convention: a declared helper that does not read as a helper is a deliberate line.
    // Two shapes are legal — a PascalCase name, which `PASCAL_CASE_HELPERS` records and the next
    // test pins to the enums, and the all-caps sentinel `CONFLICT`. Anything else is an invitation
    // to name the helper the way its siblings are named. Read from `PACKAGES`, so a name declared in
    // a package's subpath-only list is checked here too.
    const offConvention = declaredHelpers().filter((name) => !isConventionalHelper(name))

    expect(offConvention.sort()).toEqual(["CONFLICT", ...PASCAL_CASE_HELPERS].sort())
  })

  it("acknowledges every helper whose name looks like a component", () => {
    // A component demoted into a helper list leaves the drift guard with no error at all, which is
    // the one silent hole in it. Components are PascalCase and these are not, so the demotion has
    // to be written into `PASCAL_CASE_HELPERS` too — whichever of the package's two lists it lands
    // in, which is why this reads the declared union and not the barrel-intersected split: that
    // split excludes `SUBPATH_ONLY_HELPERS` wholesale, so a PascalCase component parked there would
    // have been asserted about by nothing.
    const pascalCase = declaredHelpers().filter((name) => /^[A-Z][a-z]/.test(name))

    expect(pascalCase.sort()).toEqual([...PASCAL_CASE_HELPERS].sort())
  })

  it("reads the ui barrel into components and helpers", () => {
    expect([...componentNames, ...helperExportNames].sort()).toEqual(Object.keys(ui).sort())
    expect(componentNames.length).toBeGreaterThan(0)
    expect(helperExportNames.length).toBeGreaterThan(0)
  })

  it("keeps the compile-time drift guard green for every package", () => {
    // `registryDrift` is typed `DriftReport`, which is `true` per package only while that package's
    // demos, pending list and helpers account for its exports exactly. A rename, a removal, a
    // missing demo and a demo for a name that does not exist all fail `deno check` before this
    // runs; this is the assertion that each report resolved the way it reads.
    for (const id of packageIds) {
      expect(registryDrift[id], id).toBe(true)
    }
  })

  it("registers exactly one demo per component the sections document", () => {
    expect(Object.keys(demoRegistry).sort()).toEqual([...catalogueNames].sort())
    expect(Object.keys(demoRegistry).length).toBe(catalogueNames.length)
  })

  it("registers no component demo for a name its package does not export", () => {
    // Class sections are exempt by construction: their keys are card ids (`"colour-atoms"`), not
    // export names, and their demos are not type-checked against a barrel. `classes.test.tsx` is the
    // guard for those.
    for (const section of catalogueSections.filter((entry) => entry.kind === "component")) {
      for (const name of section.names) {
        const owners = packageIds.filter((id) =>
          (exportsOf(id).components as string[]).includes(name)
        )
        expect(owners.length, `${name} is not a component of any covered package`).toBe(1)
      }
    }
  })

  it("files the class demos under the theme package, keyed apart from component names", () => {
    const classSections = catalogueSections.filter((section) => section.kind === "class")
    expect(classSections.length).toBeGreaterThan(0)

    const exported = new Set<string>(
      packageIds.flatMap((id) => exportsOf(id).components as string[]),
    )
    for (const section of classSections) {
      expect(section.package, section.id).toBe(CLASS_PACKAGE)
      expect(section.packageName, section.id).toBe("@preact-components/theme")
      expect(Object.keys(classDemos), section.id).toEqual(expect.arrayContaining(section.names))
    }

    for (const name of classDemoNames) {
      // A card id that looked like a component name — `input` next to `Input`, `card` next to a
      // future `Card` — would slug to the same fragment as that component's card, and the host
      // page's navigation writes one fragment per card. `class-` keeps the two namespaces apart by
      // construction rather than by a collision test somebody has to re-run when a component lands.
      expect(name.startsWith("class-"), `${name} is not namespaced`).toBe(true)
      expect(exported.has(name), `${name} collides with an exported component`).toBe(false)
    }
  })

  it("gives every class demo a heading, a class list and a demo's own fields", () => {
    expect(Object.keys(classDemos).sort()).toEqual([...classDemoNames].sort())

    for (const [name, demo] of Object.entries(classDemos)) {
      expect(demo.title.length, name).toBeGreaterThan(0)
      expect(demo.classes.length, `${name} claims no class`).toBeGreaterThan(0)
      expect(demo.summary.length, name).toBeGreaterThan(10)
      expect(demo.snippet, name).toContain("<")
      expect(typeof demo.render, name).toBe("function")
    }
  })

  it("gives every demo a summary, a snippet and a render function", () => {
    for (const [name, demo] of Object.entries(demoRegistry)) {
      expect(demo.summary.length, name).toBeGreaterThan(10)
      expect(demo.snippet, name).toContain("<")
      expect(typeof demo.render, name).toBe("function")
    }
  })

  it("groups every demo into exactly one section", () => {
    const grouped = catalogueSections.flatMap((section) => section.names)

    // Also the check for a name two packages happen to share: the registry is flat, so a collision
    // would silently render one card for two components.
    expect(new Set(grouped).size, "a name appears in two sections").toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...catalogueNames].sort())
  })

  it("gives every section a heading, a blurb, a package and at least one demo", () => {
    expect(catalogueSections.length).toBeGreaterThan(packageIds.length)

    for (const section of catalogueSections) {
      expect([...packageIds, CLASS_PACKAGE], section.id).toContain(section.package)
      expect(section.packageName, section.id).toBe(`@preact-components/${section.package}`)
      expect(section.title.length, section.id).toBeGreaterThan(0)
      expect(section.blurb.length, section.id).toBeGreaterThan(10)
      expect(section.names.length, section.id).toBeGreaterThan(0)
    }
  })

  it("accounts for every component of every covered package", () => {
    // The runtime mirror of the type-level guard, read straight off the module namespace: a
    // component that is neither demoed nor declared pending fails here as well as at `deno check`.
    // `pendingNamesOf` is the same resolver the type level uses, so an auto-pending package (`ui`)
    // is accounted for by its exports rather than by a hand-kept list.
    for (const id of packageIds) {
      const demoed = demoedFor(id)
      const pending = pendingNamesOf(id)

      expect([...demoed, ...pending].sort(), id).toEqual(
        [...exportsOf(id).components].sort(),
      )
      expect(demoed.filter((name) => pending.includes(name)), `${id}: demoed and pending`).toEqual(
        [],
      )
    }
  })

  it("publishes the declared gaps, packaged and named", () => {
    // No `toBeGreaterThan(0)` on the worklist. It used to demand a non-empty list, which made the
    // catalogue's own goal state — every covered package written up, nothing left to defer — a
    // failing build. `ui` was the last name on it and issue #105 tracks the four guards that assumed
    // otherwise; this is the one of the four that lives here, asserted as the state instead.
    for (const entry of pendingDemos) {
      expect(entry.names.length, `${entry.package} is on the worklist with nothing to say`)
        .toBeGreaterThan(0)
      expect(entry.packageName).toBe(`@preact-components/${entry.package}`)
    }
    // Tied to the resolver in every state, empty included: the notice is derived from these two, so
    // an entry that no longer resolves cannot linger on the page and a resolved gap cannot be left
    // off it.
    //
    // Stated plainly, because a reader will notice it: with the worklist empty this compares `[]`
    // with `[]`, and both sides come from the same resolver — so it is a wiring invariant, not an
    // independent expectation. What it catches is `pendingDemos` ceasing to be derived (a hard-coded
    // list, a filter the wrong way round). It is deliberately *not* the evidence that the resolver
    // works: that is the probe test below, which drives `pendingNamesOf` with a name no package
    // exports, and `catalogue.test.tsx`'s render test built on the same seam.
    expect(pendingDemos.map((entry) => entry.package)).toEqual(
      packageIds.filter((id) => pendingNamesOf(id).length > 0),
    )
  })

  it("drops a written-up package from the worklist", () => {
    // The three packages whose declared lists #102 emptied: each had a `PENDING_DEMOS` entry per
    // undemoed component, each is now written up in full, and a package with nothing left to declare
    // must not keep an empty entry on the page. `ui` joined them when its last demos landed, so the
    // worklist is now empty for every covered package — which is why the test above no longer demands
    // a non-empty list, and why this one asserts the state of the page rather than a contrast.
    //
    // The opposite mistake — leaving a *demoed* name in `PENDING_DEMOS` — is a `deno check` failure
    // (`{ stalePending: "Name" }`), which is a compile error and therefore not assertable here.
    for (const id of ["ui", "charts", "system", "crud"] as const) {
      expect(PENDING_DEMOS[id], `${id} still declares a pending demo`).toEqual([])
      expect(pendingNamesOf(id), `${id} resolves a pending name`).toEqual([])
      expect(pendingDemos.map((entry) => entry.package), `${id} on the worklist`).not.toContain(id)
    }
    expect(pendingDemos, "every covered package is written up").toEqual([])
  })

  it("names an auto-pending package's undemoed exports without an explicit list", () => {
    // The property that keeps a `ui/` component PR mergeable on its own: a new export nobody has
    // demoed is published as a gap rather than blocking the build.
    //
    // Two shapes make this test vacuous, and both are easy to write by accident:
    //   * comparing the resolver against the real export list — in the shipped tree every `ui`
    //     component has a demo, so that is `[]` against `[]`;
    //   * iterating whatever is under test — `for (const id of AUTO_PENDING_PACKAGES)` runs zero
    //     times once the list is emptied, which is precisely the mutation it should catch.
    //
    // So the package is named literally and the probe is asserted to land in the worklist. This is
    // the test that survives the worklist emptying: it drives the seam with a name no export list
    // contains, so it holds whatever `ui/` ships next.
    expect(AUTO_PENDING_PACKAGES, "ui is the package this seam exists for").toContain("ui")
    expect(PENDING_DEMOS.ui, "ui's explicit list is meant to stay empty").toEqual([])
    expect(pendingNamesOf("ui", [UNDEMOED_PROBE])).toEqual([UNDEMOED_PROBE])
  })

  it("leaves an undeclared component of a declared-list package to the type guard", () => {
    // The other half of the contrast, asserted against a package named literally for the same
    // reason: such a component is `MissingDemos<P>`, a `deno check` failure, and naming it here
    // would turn a hard error into an amber note.
    expect(pendingNamesOf("charts", [UNDEMOED_PROBE])).not.toContain(UNDEMOED_PROBE)
    expect(pendingNamesOf("charts", [UNDEMOED_PROBE])).toEqual([...PENDING_DEMOS.charts])
  })

  it("keeps a demoed component out of the pending list", () => {
    // The worklist must not contradict the cards rendered directly below it.
    const [demoed] = demoedFor("ui")
    expect(demoed, "ui needs at least one demo to compare against").toBeDefined()
    expect(pendingNamesOf("ui", [demoed!])).toEqual([])
  })

  it("reports nothing for the complete registry", () => {
    expect(missingDemos(demoRegistry)).toEqual([])
  })

  it("reports a component whose demo is missing", () => {
    expect(missingDemos(without("ToggleSwitch"))).toEqual(["ToggleSwitch"])
  })

  it("reports every missing component, in render order", () => {
    const partial = without("Badge", "Toastr")

    // `catalogueNames` is render order, so the report is stable rather than registration order.
    const expected = catalogueNames.filter((name) => name === "Badge" || name === "Toastr")
    expect(missingDemos(partial)).toEqual(expected)
    expect(expected.length).toBe(2)
  })

  it("leaves a declared gap out of the missing report", () => {
    // A pending component has no demo by design: it is named by `pendingDemos`, and reporting it as
    // missing too would put the guide's worklist in the red banner for no reason.
    for (const entry of pendingDemos) {
      for (const name of entry.names) {
        expect(catalogueNames, name).not.toContain(name)
      }
    }
  })
})

describe("catalogue groups", () => {
  it("groups every section into exactly one group, and loses none", () => {
    // The derived record against the sections it was derived from, in both directions: a section
    // filed into two groups would leave every group non-empty and still be rendered twice, which is
    // the failure the type-level half cannot see (a section says which group it is in, so it cannot
    // *express* two — but the bucketing loop is where a copy-paste could double one up).
    const grouped = catalogueGroupIds.flatMap((id) => catalogueGroups[id])

    expect(new Set(grouped).size, "a section is filed into two groups").toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...catalogueSections.map((s) => s.id)].sort())
    expect(sectionIds).toEqual(grouped)
  })

  it("leaves no group empty and names no group the record does not have", () => {
    // Read from `catalogueGroupIds` rather than from `Object.keys(catalogueGroups)`: the latter
    // would run zero times once the list was emptied, which is the mutation this is meant to catch.
    expect(catalogueGroupIds.length).toBeGreaterThan(1)

    for (const id of catalogueGroupIds) {
      expect(catalogueGroups[id], `${id} is not a group`).toBeDefined()
      expect(catalogueGroups[id].length, `${id} has no sections`).toBeGreaterThan(0)
    }

    expect(Object.keys(catalogueGroups).sort()).toEqual([...catalogueGroupIds].sort())
  })

  it("keeps the group vocabulary to the five ids, renaming or dropping none", () => {
    // The expected set is written out here — five literals, in render order — and it is the *only*
    // thing in this test that can fail: everything else is arithmetic over the value under test.
    //
    // The first version of this test also parsed the committed source for the `catalogueGroupIds`
    // declaration and compared the ids it found against `[...catalogueGroupIds]`, which is the same
    // array read twice and therefore a tautology — it could not fail, and the reviewer said so. What
    // actually fired was the literal below; this removes the paragraph that claimed otherwise.
    //
    // Order is part of the vocabulary: the groups are a reading order, so a reordering is a change
    // to the product, not a refactor.
    expect(catalogueGroupIds).toEqual([
      "foundations",
      "surfaces",
      "inputs",
      "data",
      "application",
    ])
  })

  it("heads every group, in the order the group ids declare", () => {
    expect(catalogueGroupsWithHeadings.length).toBe(catalogueGroupIds.length)
    expect(catalogueGroupsWithHeadings.map((group) => group.id)).toEqual([...catalogueGroupIds])

    for (const group of catalogueGroupsWithHeadings) {
      expect(group.title.length, group.id).toBeGreaterThan(0)
      expect(group.blurb.length, `${group.id} has no blurb`).toBeGreaterThan(40)
    }
  })

  it("files every group's sections under the group they are rendered in", () => {
    // The tie between the record and the resolved sections: `CatalogueSection.group` is what the
    // page buckets on, so a section whose spec said one group and resolved to another would render
    // under a heading its own data contradicts.
    for (const id of catalogueGroupIds) {
      for (const sectionId of catalogueGroups[id]) {
        const section = catalogueSections.find((candidate) => candidate.id === sectionId)
        expect(section, `${sectionId} is in a group but not in the catalogue`).toBeDefined()
        expect(section?.group, sectionId).toBe(id)
      }
    }
  })
})

describe("package coverage", () => {
  it("covers every package in the tree, or excludes it with a reason", async () => {
    const directories = await packageDirectories()
    expect(directories.length).toBeGreaterThan(packageIds.length)

    const covered = new Set<string>(packageIds)
    const excluded = new Set<string>(Object.keys(EXCLUDED_PACKAGES))

    for (const directory of directories) {
      expect(
        covered.has(directory) || excluded.has(directory),
        `${directory}/ carries a deno.json — add it to PACKAGES, or to EXCLUDED_PACKAGES with a reason`,
      ).toBe(true)
    }

    for (const id of packageIds) {
      expect(directories, `${id}/ is a covered source`).toContain(id)
    }
    for (const id of Object.keys(EXCLUDED_PACKAGES) as Array<keyof typeof EXCLUDED_PACKAGES>) {
      expect(directories, `${id}/ is excluded`).toContain(id)
      expect(EXCLUDED_PACKAGES[id].reason.length, id).toBeGreaterThan(20)
    }
  })
})
