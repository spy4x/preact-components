/**
 * The coverage rule, driven once against the real packages and then against inputs a healthy tree
 * cannot produce — a check only ever run against agreement would pass with the rule deleted.
 */

import { expect } from "@std/expect"
import { parse } from "@std/jsonc"
import { describe, it } from "@std/testing/bdd"
import * as charts from "@spy4x/preact-charts"
import * as cn from "@spy4x/preact-cn"
import * as crud from "@spy4x/preact-crud"
import * as map from "@spy4x/preact-map"
import * as signals from "@spy4x/preact-signals"
import * as system from "@spy4x/preact-system"
import * as theme from "@spy4x/preact-theme"
import * as ui from "@spy4x/preact-ui"
import {
  type AllowedExport,
  allowedExports,
  coverageProblems,
  demoedNamesOf,
  exampledNamesOf,
  EXCLUDED_PACKAGES,
  isComponent,
  isComponentName,
  packageExports,
  type PackageNamespace,
  PENDING_REASON,
  subpathModulesOf,
  valueExportsOf,
} from "./coverage.ts"
import { EXAMPLES_PENDING } from "./examples-pending.ts"
import { coveredPackageIds, type PackageId, packageIds } from "./registry.ts"

/** The repository root: the parent of every package directory, same as `coverage.ts`'s own. */
const ROOT = new URL("../", import.meta.url)

/** Every catalogued package's value exports, read once for the whole file. */
const EXPORTS = await packageExports()

/** Every barrel imported directly: ground truth for the read, independent of `coverage.ts`. */
const BARRELS: Record<PackageId, object> = { ui, charts, system, crud, map, signals, theme, cn }

/** A component name no package exports and no section demonstrates. */
const GHOST = "GhostWidget"

/** A helper name no package exports and no card or example covers. */
const GHOST_HELPER = "ghostHelper"

/** The shipped `ui` exports, plus one invented export. */
function uiWith(name: string, value: unknown): Record<PackageId, PackageNamespace> {
  return { ...EXPORTS, ui: { ...EXPORTS.ui, [name]: value } }
}

/** The shipped exports with one of a package's names taken away. */
function without(id: PackageId, name: string): Record<PackageId, PackageNamespace> {
  const { [name]: _dropped, ...rest } = EXPORTS[id]
  return { ...EXPORTS, [id]: rest }
}

/**
 * Per package, every subpath module (`"./avatar"`) carrying a name its barrel does not. Walks
 * {@link subpathModulesOf} but imports each module itself, never through `valueExportsOf`, so a
 * break in the read cannot hide from its own guard.
 */
async function subpathOnlyNames(): Promise<Record<PackageId, Record<string, string[]>>> {
  const byPackage = {} as Record<PackageId, Record<string, string[]>>

  for (const id of coveredPackageIds) {
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

/** One package's TypeScript subpath keys, read straight from its `deno.json`, not the helper. */
async function declaredSubpaths(id: PackageId): Promise<string[]> {
  const config = parse(await Deno.readTextFile(new URL(`./${id}/deno.json`, ROOT)))
  const declared = (config as { exports?: Record<string, unknown> } | null)?.exports ?? {}

  return Object.entries(declared)
    .filter(([subpath, target]) =>
      subpath !== "." && typeof target === "string" &&
      /\.tsx?$/.test(target)
    )
    .map(([subpath]) => subpath)
}

/**
 * The problems one broken input adds beyond the shipped tree's, so each fixture asserts on its own
 * injection alone and one real gap does not fail every fixture.
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
  return { ...allowedExports, [id]: entries }
}

/** Top-level directories that carry a `deno.json`, read from the tree, not the workspace list. */
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
  it("accounts for every value every catalogued package exports", () => {
    expect(coverageProblems(EXPORTS)).toEqual([])

    // A floor under the read itself, derived from `BARRELS` rather than picked: whatever a
    // package's real barrel exports, `packageExports()`'s read of that package must contain too.
    for (const id of coveredPackageIds) {
      const lost = Object.keys(BARRELS[id]).filter((name) => !(name in EXPORTS[id]))
      expect(lost, `${id}: barrel names the read lost`).toEqual([])
    }
    for (const id of packageIds) {
      expect(demoedNamesOf(id).length, `${id}: cards`).toBeGreaterThan(0)
    }
  })

  describe("reads every subpath module, not only the barrel", () => {
    // One `it` per module, so a read that skips exactly one module names it.

    it("lists exactly the TypeScript subpaths each package's deno.json publishes", async () => {
      // Checks the helper the fixture is derived from against deno.json itself.
      for (const id of coveredPackageIds) {
        const declared = (await declaredSubpaths(id)).sort()
        const fromHelper = (await subpathModulesOf(id)).map((m) => m.subpath).sort()

        expect(fromHelper, `${id}: subpathModulesOf vs deno.json exports`).toEqual(declared)
      }
    })

    let moduleCount = 0

    for (const id of coveredPackageIds) {
      for (const [subpath, names] of Object.entries(SUBPATH_ONLY_NAMES[id])) {
        moduleCount++
        it(`${id}${subpath} reaches valueExportsOf beyond the barrel`, async () => {
          // The names must really be barrel-absent, or every assertion below holds by construction.
          const barrelNames = new Set(Object.keys(BARRELS[id]))
          const notBarrelAbsent = names.filter((name) => barrelNames.has(name))
          expect(notBarrelAbsent, `${id}${subpath}: names the barrel already carries`).toEqual([])

          const exported = Object.keys(await valueExportsOf(id))
          for (const name of names) {
            expect(exported, `${id}${subpath} exports ${name}`).toContain(name)
          }
        })
      }
    }

    it("found at least one such module in a package known to have them", () => {
      // A derivation that found nothing would register no step above and pass vacuously.
      expect(moduleCount, "subpath modules with a barrel-absent name, across all packages")
        .toBeGreaterThan(0)
      expect(Object.keys(SUBPATH_ONLY_NAMES.ui).length, "ui").toBeGreaterThan(0)
      expect(Object.keys(SUBPATH_ONLY_NAMES.charts).length, "charts").toBeGreaterThan(0)
    })
  })

  it("names a component that no section demonstrates", () => {
    const problems = injectedBy(coverageProblems(uiWith(GHOST, () => null)))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST)
    expect(problems[0]).toContain("no section demonstrates it")
  })

  it("names a helper that no card or example covers", () => {
    const problems = injectedBy(coverageProblems(uiWith(GHOST_HELPER, () => null)))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST_HELPER)
    expect(problems[0]).toContain("no card or example covers it")
  })

  it("names a PascalCase object with no example as a helper, not a component", () => {
    const problems = injectedBy(coverageProblems(uiWith(GHOST, { A: 1 })))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain("no card or example covers it")
  })

  it("counts a helper an example covers", () => {
    const exampled = exampledNamesOf("ui")[0]
    expect(exampled, "ui ships an example").toBeDefined()
    expect(allowedExports.ui.map((entry) => entry.name)).not.toContain(exampled)
    expect(coverageProblems(EXPORTS).filter((problem) => problem.includes(` ${exampled} `)))
      .toEqual([])
  })

  it("does not count an example as a component's card", () => {
    const withGhost = (id: PackageId) => [...exampledNamesOf(id), ...(id === "ui" ? [GHOST] : [])]
    const problems = injectedBy(
      coverageProblems(uiWith(GHOST, () => null), allowedExports, withGhost),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(`component ${GHOST}`)
  })

  it("names an example covering a name its package does not export", () => {
    const exampled = exampledNamesOf("signals")[0]
    const problems = injectedBy(coverageProblems(without("signals", exampled)))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(exampled)
    expect(problems[0]).toContain("examples cover")
  })

  it("names an allow-list entry the package does not export", () => {
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        allowing("ui", [...allowedExports.ui, { name: GHOST, reason: "Invented for this test." }]),
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
        allowing("ui", [...allowedExports.ui, { name: demoed, reason: PENDING_REASON }]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(demoed)
    expect(problems[0]).toContain("stale")
  })

  it("names a pending entry whose helper has an example after all", () => {
    const exampled = exampledNamesOf("signals")[0]
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        allowing("signals", [...allowedExports.signals, {
          name: exampled,
          reason: PENDING_REASON,
        }]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(exampled)
    expect(problems[0]).toContain("stale")
  })

  it("names a demo keyed to a name its package does not export", () => {
    const demoed = demoedNamesOf("ui")[0]
    const problems = injectedBy(coverageProblems(without("ui", demoed)))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(demoed)
    expect(problems[0]).toContain("does not export")
  })

  it("gives every allow-list entry a reason, and names each pending export once", () => {
    for (const id of coveredPackageIds) {
      for (const entry of allowedExports[id]) {
        expect(entry.reason.length, `${id}: ${entry.name}`).toBeGreaterThan(20)
      }
      const pending = EXAMPLES_PENDING[id]
      expect(new Set(pending).size, `${id}: a pending name listed twice`).toBe(pending.length)
    }
  })

  it("reads a component name apart from a helper name", () => {
    for (const name of ["Badge", "EmptyState", "D3LineChart", "OnOffButtons", "ErrType"]) {
      expect(isComponentName(name), `${name} is a component name`).toBe(true)
    }
    expect(isComponent("Badge", () => null), "a PascalCase function").toBe(true)
    expect(isComponent("ThemeValue", { Light: 1 }), "a PascalCase object").toBe(false)
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
    expect(directories.length).toBeGreaterThan(coveredPackageIds.length)

    const covered = new Set<string>(coveredPackageIds)
    const excluded = new Set<string>(Object.keys(EXCLUDED_PACKAGES))

    for (const directory of directories) {
      expect(
        covered.has(directory) || excluded.has(directory),
        `${directory}/ carries a deno.json — catalogue it in coveredPackageIds, or exclude it with a reason`,
      ).toBe(true)
    }

    for (const id of coveredPackageIds) {
      expect(directories, `${id}/ is a catalogued source`).toContain(id)
    }
    for (const id of Object.keys(EXCLUDED_PACKAGES) as Array<keyof typeof EXCLUDED_PACKAGES>) {
      expect(directories, `${id}/ is excluded`).toContain(id)
      expect(EXCLUDED_PACKAGES[id].reason.length, id).toBeGreaterThan(20)
    }
  })
})
