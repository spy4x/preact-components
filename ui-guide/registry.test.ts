import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import * as charts from "@preact-components/charts"
import * as crud from "@preact-components/crud"
import * as signals from "@preact-components/signals"
import * as system from "@preact-components/system"
import * as ui from "@preact-components/ui"
import {
  AUTO_PENDING_PACKAGES,
  catalogueNames,
  catalogueSections,
  componentNames,
  demoRegistry,
  EXCLUDED_PACKAGES,
  exportsOf,
  helperExportNames,
  missingDemos,
  type PackageId,
  packageIds,
  PACKAGES,
  PASCAL_CASE_HELPERS,
  PENDING_DEMOS,
  pendingDemos,
  pendingNamesOf,
  registryDrift,
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

  it("declares no helper export that its package does not export", () => {
    // A stale entry here would not fail the type guard — `Exclude` ignores a name that is not in
    // the namespace — so the length is what catches a helper that has been renamed or dropped.
    for (const id of packageIds) {
      expect(exportsOf(id).helpers.length, id).toBe(PACKAGES[id].helpers.length)
    }
  })

  it("acknowledges every helper whose name looks like a component", () => {
    // A component demoted into a helper list leaves the drift guard with no error at all, which is
    // the one silent hole in it. Components are PascalCase and these are not, so the demotion has
    // to be written into `PASCAL_CASE_HELPERS` too.
    const pascalCase = packageIds.flatMap((id) =>
      exportsOf(id).helpers.filter((name) => /^[A-Z][a-z]/.test(name))
    )

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

  it("registers no demo for a name its package does not export", () => {
    for (const name of Object.keys(demoRegistry)) {
      const owners = packageIds.filter((id) =>
        (exportsOf(id).components as string[]).includes(name)
      )
      expect(owners.length, `${name} is not a component of any covered package`).toBe(1)
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
      expect(packageIds, section.id).toContain(section.package)
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
    expect(pendingDemos.length).toBeGreaterThan(0)

    for (const entry of pendingDemos) {
      expect(entry.names.length).toBeGreaterThan(0)
      expect(entry.packageName).toBe(`@preact-components/${entry.package}`)
    }
    expect(pendingDemos.map((entry) => entry.package)).toEqual(
      packageIds.filter((id) => pendingNamesOf(id).length > 0),
    )
  })

  it("names an auto-pending package's undemoed exports without an explicit list", () => {
    // The property that keeps a `ui/` component PR mergeable on its own: a new export nobody has
    // demoed is published as a gap rather than blocking the build. `ui`'s explicit list is empty on
    // purpose, so anything named here came from the exports themselves.
    for (const id of AUTO_PENDING_PACKAGES) {
      expect(PENDING_DEMOS[id], `${id}: explicit list is meant to stay empty`).toEqual([])

      const undemoed = exportsOf(id).components.filter((name) => !demoedFor(id).includes(name))
      expect(pendingNamesOf(id), id).toEqual(undemoed)
    }
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
