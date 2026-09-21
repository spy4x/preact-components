/**
 * The coverage rule, driven once against the real packages and then against inputs a healthy tree
 * cannot produce — a check only ever run against agreement would pass with the rule deleted.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import * as charts from "@preact-components/charts"
import * as crud from "@preact-components/crud"
import * as system from "@preact-components/system"
import * as ui from "@preact-components/ui"
import {
  type AllowedExport,
  coverageProblems,
  demoedNamesOf,
  EXCLUDED_PACKAGES,
  EXPORTS_WITHOUT_DEMO,
  isComponentName,
  packageExports,
  subpathModulesOf,
  valueExportsOf,
} from "./coverage.ts"
import { type PackageId, packageIds } from "./registry.ts"

/** Every catalogued package's value exports, read once for the whole file. */
const EXPORTS = await packageExports()

/**
 * Every package's barrel, imported directly — ground truth `packageExports()`'s read is checked
 * against below, independent of the function under test: whatever `coverage.ts` does internally,
 * these imports run the same way a caller's own `import * as ui from "@preact-components/ui"`
 * would, so a bug in the read cannot also corrupt what it is compared to.
 */
const BARRELS: Record<PackageId, object> = { ui, charts, system, crud }

/** A component name no package exports and no section demonstrates. */
const GHOST = "GhostWidget"

/**
 * Every subpath module that carries at least one name its package's barrel does not, keyed by
 * package and then by the module's own subpath (`"./avatar"`, not a file path).
 *
 * Walks {@link subpathModulesOf}, the same list `valueExportsOf` reads, so this can never name a
 * module the read does not also see, and a module added to a package's `exports` later is picked up
 * here without editing this file. Each module is imported and inspected directly, never through
 * `valueExportsOf`: the fixture has to say what a module exports independently of the function it is
 * checking, or a break in that function could hide the break from its own guard.
 *
 * @returns Barrel-absent names per subpath, per package; a package with none of its own is present
 *   with an empty object rather than omitted.
 */
async function subpathOnlyNames(): Promise<Record<PackageId, Record<string, string[]>>> {
  const byPackage = {} as Record<PackageId, Record<string, string[]>>

  for (const id of packageIds) {
    const barrelNames = new Set(Object.keys(BARRELS[id]))
    const byModule: Record<string, string[]> = {}

    for (const { subpath, href } of await subpathModulesOf(id)) {
      const namespace = await import(href) as object
      const extra = Object.keys(namespace).filter((name) => !barrelNames.has(name))
      if (extra.length > 0) byModule[subpath] = extra
    }

    byPackage[id] = byModule
  }

  return byPackage
}

/** {@link subpathOnlyNames}, read once for the whole file. */
const SUBPATH_ONLY_NAMES = await subpathOnlyNames()

/**
 * The problems one deliberately broken input adds, and nothing else.
 *
 * Every fixture below asserts on its own injection alone. Asserting the whole list instead would
 * tie each of them to the catalogue being clean, so one genuinely missing demo would print six
 * failures naming five components invented for these tests and one real one.
 *
 * @param problems What the rule reported for the broken input.
 * @returns The problems the shipped tree does not already report.
 */
function injectedBy(problems: string[]): string[] {
  const shipped = new Set(coverageProblems(EXPORTS))
  return problems.filter((problem) => !shipped.has(problem))
}

/** The shipped allow-list with one package's entries replaced. */
function allowing(
  id: PackageId,
  entries: AllowedExport[],
): Record<PackageId, readonly AllowedExport[]> {
  return { ...EXPORTS_WITHOUT_DEMO, [id]: entries }
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

describe("the coverage rule", () => {
  it("accounts for every component every catalogued package exports", () => {
    expect(coverageProblems(EXPORTS)).toEqual([])

    // A floor under the read itself, derived from `BARRELS` rather than picked: whatever a
    // package's real barrel exports for real, `packageExports()`'s read of that package must
    // contain too. This is not a count, so nothing here needs revising when a package's real
    // surface grows or shrinks — and unlike the bidirectional check above, which only misses a
    // *component*-named export, this one also catches a read that silently drops a helper, which
    // carries no card and so nothing else here would ever ask after it.
    for (const id of packageIds) {
      const barrelNames = Object.keys(BARRELS[id])
      const lost = barrelNames.filter((name) => !EXPORTS[id].includes(name))

      expect(lost, `${id}: barrel names the read lost`).toEqual([])
      expect(demoedNamesOf(id).length, `${id}: cards`).toBeGreaterThan(0)
    }
  })

  describe("reads every subpath module, not only the barrel", () => {
    // The hole this closes: a component exported from its own module and never re-exported is
    // reachable through the subpath and was invisible to a barrel-only check. One `it` per module
    // named in SUBPATH_ONLY_NAMES, so a read that skips exactly one module fails with that module's
    // name rather than passing because some other module covered for it.
    let moduleCount = 0

    for (const id of packageIds) {
      for (const [subpath, names] of Object.entries(SUBPATH_ONLY_NAMES[id])) {
        moduleCount++
        it(`${id}${subpath} reaches valueExportsOf beyond the barrel`, async () => {
          const exported = await valueExportsOf(id)
          for (const name of names) {
            expect(exported, `${id}${subpath} exports ${name}`).toContain(name)
          }
        })
      }
    }

    it("found at least one such module in a package known to have them", () => {
      // A derivation that silently found nothing would register zero steps above and this whole
      // describe block would pass having asserted nothing — exactly the vacuous pass the loop is
      // supposed to rule out. Measured on the shipped tree: ui publishes six subpath modules with a
      // barrel-absent name, charts publishes one. Asserted as a floor, not a count, so this does not
      // need editing when a module is added, renamed, or re-exported through a barrel later.
      expect(moduleCount, "subpath modules with a barrel-absent name, across all packages")
        .toBeGreaterThan(0)
      expect(Object.keys(SUBPATH_ONLY_NAMES.ui).length, "ui").toBeGreaterThan(0)
      expect(Object.keys(SUBPATH_ONLY_NAMES.charts).length, "charts").toBeGreaterThan(0)
    })
  })

  it("names a component that no section demonstrates", () => {
    const problems = injectedBy(coverageProblems({ ...EXPORTS, ui: [...EXPORTS.ui, GHOST] }))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST)
    expect(problems[0]).toContain("no section demonstrates it")
  })

  it("leaves a helper-named export alone", () => {
    expect(injectedBy(coverageProblems({ ...EXPORTS, ui: [...EXPORTS.ui, "ghostHelper"] })))
      .toEqual([])
  })

  it("names an allow-list entry the package does not export", () => {
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        allowing("ui", [{ name: GHOST, reason: "Invented for this test." }]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST)
    expect(problems[0]).toContain("does not export")
  })

  it("names an allow-list entry whose component has a demo after all", () => {
    const demoed = demoedNamesOf("ui")[0]
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        allowing("ui", [{ name: demoed, reason: "A demo somebody still owes." }]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(demoed)
    expect(problems[0]).toContain("stale")
  })

  it("names a demo keyed to a name its package does not export", () => {
    const demoed = demoedNamesOf("ui")[0]
    const problems = injectedBy(
      coverageProblems({ ...EXPORTS, ui: EXPORTS.ui.filter((name) => name !== demoed) }),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(demoed)
    expect(problems[0]).toContain("does not export")
  })

  it("gives every allow-list entry a reason", () => {
    for (const id of packageIds) {
      for (const entry of EXPORTS_WITHOUT_DEMO[id]) {
        expect(entry.reason.length, `${id}: ${entry.name}`).toBeGreaterThan(20)
      }
    }
  })

  it("reads a component name apart from a helper name", () => {
    for (const name of ["Badge", "EmptyState", "D3LineChart", "OnOffButtons", "ErrType"]) {
      expect(isComponentName(name), `${name} is a component name`).toBe(true)
    }
    for (
      const name of ["clampProgress", "cn", "DEFAULT_AXIS_COLOR", "CONFLICT", "SKELETON_METRICS"]
    ) {
      expect(isComponentName(name), `${name} is a helper name`).toBe(false)
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
        `${directory}/ carries a deno.json — catalogue it in packageIds, or exclude it with a reason`,
      ).toBe(true)
    }

    for (const id of packageIds) {
      expect(directories, `${id}/ is a catalogued source`).toContain(id)
    }
    for (const id of Object.keys(EXCLUDED_PACKAGES) as Array<keyof typeof EXCLUDED_PACKAGES>) {
      expect(directories, `${id}/ is excluded`).toContain(id)
      expect(EXCLUDED_PACKAGES[id].reason.length, id).toBeGreaterThan(20)
    }
  })
})
