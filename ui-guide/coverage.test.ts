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
  COMPONENTS_WITHOUT_CARD,
  coverageProblems,
  demoedNamesOf,
  EXCLUDED_PACKAGES,
  isComponent,
  isComponentName,
  packageExports,
  type PackageNamespace,
  packageReadmes,
  README_PENDING,
  readmeNames,
  subpathModulesOf,
  valueExportsOf,
} from "./coverage.ts"
import { coveredPackageIds, type PackageId, packageIds } from "./registry.ts"

/** The repository root: the parent of every package directory, same as `coverage.ts`'s own. */
const ROOT = new URL("../", import.meta.url)

/** Every covered package's value exports, read once for the whole file. */
const EXPORTS = await packageExports()

/** Every covered package's README, read once for the whole file. */
const READMES = await packageReadmes()

/** Every barrel imported directly: ground truth for the read, independent of `coverage.ts`. */
const BARRELS: Record<PackageId, object> = { ui, charts, system, crud, map, signals, theme, cn }

/** A component name no package exports and no section demonstrates. */
const GHOST = "GhostWidget"

/** A helper name no package exports and no README names. */
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
  const shipped = new Set(coverageProblems(EXPORTS, READMES))
  return problems.filter((problem) => !shipped.has(problem))
}

/** The shipped allow-list with one package's entries replaced. */
function allowing(
  id: PackageId,
  entries: AllowedExport[],
): Record<PackageId, readonly AllowedExport[]> {
  return { ...COMPONENTS_WITHOUT_CARD, [id]: entries }
}

/** The shipped pending list with one package's names replaced. */
function pendingWith(id: PackageId, names: string[]): Record<PackageId, readonly string[]> {
  return { ...README_PENDING, [id]: names }
}

/** The shipped READMEs with one package's text extended. */
function readmesWith(id: PackageId, extra: string): Record<PackageId, string> {
  return { ...READMES, [id]: `${READMES[id]}\n${extra}\n` }
}

/** A helper the `signals` README names, read from the tree rather than picked. */
const NAMED_HELPER = Object.entries(EXPORTS.signals)
  .map(([name, value]) => ({ name, value }))
  .find(({ name, value }) => !isComponent(name, value) && readmeNames(READMES.signals, name))
  ?.name ?? ""

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
    expect(coverageProblems(EXPORTS, READMES)).toEqual([])

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
    const problems = injectedBy(coverageProblems(uiWith(GHOST, () => null), READMES))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST)
    expect(problems[0]).toContain("no section demonstrates it")
  })

  it("names a helper its package's README does not name", () => {
    const problems = injectedBy(coverageProblems(uiWith(GHOST_HELPER, () => null), READMES))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST_HELPER)
    expect(problems[0]).toContain("ui/README.md does not name it")
  })

  it("counts a helper the README names in code", () => {
    const problems = injectedBy(
      coverageProblems(
        uiWith(GHOST_HELPER, () => null),
        readmesWith("ui", `- \`${GHOST_HELPER}(value)\` does a thing.`),
      ),
    )

    expect(problems).toEqual([])
  })

  it("does not count a helper named only in prose", () => {
    const problems = injectedBy(
      coverageProblems(
        uiWith(GHOST_HELPER, () => null),
        readmesWith("ui", `Call ${GHOST_HELPER} before rendering, or \`${GHOST_HELPER}s\`.`),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST_HELPER)
  })

  it("names a PascalCase object with no README line as a helper, not a component", () => {
    const problems = injectedBy(coverageProblems(uiWith(GHOST, { A: 1 }), READMES))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(`the helper ${GHOST}`)
  })

  it("does not count a README line as a component's card", () => {
    const problems = injectedBy(
      coverageProblems(uiWith(GHOST, () => null), readmesWith("ui", `\`${GHOST}\``)),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(`component ${GHOST}`)
  })

  it("names an allow-list entry the package does not export", () => {
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        READMES,
        allowing("ui", [{ name: GHOST, reason: "Invented for this test." }]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST)
    expect(problems[0]).toContain("does not export")
  })

  it("names an allow-list entry whose component has a card after all", () => {
    const demoed = demoedNamesOf("ui")[0]
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        READMES,
        allowing("ui", [{ name: demoed, reason: "Invented for this test." }]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(demoed)
    expect(problems[0]).toContain("stale")
  })

  it("names an allow-list entry that is not a component", () => {
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        READMES,
        allowing("signals", [{ name: NAMED_HELPER, reason: "Invented for this test." }]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(`${NAMED_HELPER} is not a component`)
  })

  it("names a pending entry whose helper the README names after all", () => {
    expect(NAMED_HELPER, "the signals README names a helper").not.toBe("")
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        READMES,
        COMPONENTS_WITHOUT_CARD,
        pendingWith("signals", [
          NAMED_HELPER,
        ]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(NAMED_HELPER)
    expect(problems[0]).toContain("stale")
  })

  it("names a pending entry the package does not export", () => {
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        READMES,
        COMPONENTS_WITHOUT_CARD,
        pendingWith("ui", [
          ...README_PENDING.ui,
          GHOST_HELPER,
        ]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(GHOST_HELPER)
    expect(problems[0]).toContain("does not export")
  })

  it("names a pending entry that is a component", () => {
    const demoed = demoedNamesOf("ui")[0]
    const problems = injectedBy(
      coverageProblems(
        EXPORTS,
        READMES,
        COMPONENTS_WITHOUT_CARD,
        pendingWith("ui", [
          ...README_PENDING.ui,
          demoed,
        ]),
      ),
    )

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(`${demoed} is a component`)
  })

  it("excuses a helper the pending list still names", () => {
    const pending = README_PENDING.ui[0]
    expect(pending, "ui has a pending helper").toBeDefined()
    const problems = injectedBy(
      coverageProblems(EXPORTS, READMES, COMPONENTS_WITHOUT_CARD, pendingWith("ui", [])),
    )

    expect(problems.some((problem) => problem.includes(`helper ${pending} `))).toBe(true)
  })

  it("names a card keyed to a name its package does not export", () => {
    const demoed = demoedNamesOf("ui")[0]
    const problems = injectedBy(coverageProblems(without("ui", demoed), READMES))

    expect(problems.length, problems.join(" | ")).toBe(1)
    expect(problems[0]).toContain(demoed)
    expect(problems[0]).toContain("does not export")
  })

  it("gives every allow-list entry a reason, and names each pending helper once", () => {
    for (const id of coveredPackageIds) {
      for (const entry of COMPONENTS_WITHOUT_CARD[id]) {
        expect(entry.reason.length, `${id}: ${entry.name}`).toBeGreaterThan(20)
      }
      const pending = README_PENDING[id]
      expect(new Set(pending).size, `${id}: a pending name listed twice`).toBe(pending.length)
    }
  })

  it("reads a component name apart from a helper name", () => {
    for (const name of ["Badge", "EmptyState", "D3LineChart", "OnOffButtons", "ErrType"]) {
      expect(isComponentName(name), `${name} is a component name`).toBe(true)
    }
    expect(isComponent("Badge", () => null), "a PascalCase function").toBe(true)
    expect(isComponent("ThemeValue", { Light: 1 }), "a PascalCase object").toBe(false)
    expect(isComponent("MismatchError", class MismatchError extends Error {}), "a class")
      .toBe(false)
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
