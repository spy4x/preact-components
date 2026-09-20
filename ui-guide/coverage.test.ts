/**
 * The coverage rule, driven once against the real packages and then against inputs a healthy tree
 * cannot produce — a check only ever run against agreement would pass with the rule deleted.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import * as ui from "@preact-components/ui"
import {
  type AllowedExport,
  coverageProblems,
  demoedNamesOf,
  EXCLUDED_PACKAGES,
  EXPORTS_WITHOUT_DEMO,
  isComponentName,
  packageExports,
  valueExportsOf,
} from "./coverage.ts"
import { type PackageId, packageIds } from "./registry.ts"

/** Every catalogued package's value exports, read once for the whole file. */
const EXPORTS = await packageExports()

/** A component name no package exports and no section demonstrates. */
const GHOST = "GhostWidget"

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

    // A floor under the read itself: an export list that collapsed to nothing would agree with an
    // empty demo set and report no problem at all.
    for (const id of packageIds) {
      expect(EXPORTS[id].length, `${id}: value exports read`).toBeGreaterThan(20)
      expect(demoedNamesOf(id).length, `${id}: cards`).toBeGreaterThan(0)
    }
  })

  it("reads a package's subpath modules, not only its barrel", async () => {
    // The hole this closes: a component exported from its own module and never re-exported is
    // reachable through the subpath and was invisible to a barrel-only check.
    const exported = await valueExportsOf("ui")

    expect(Object.keys(ui), "the barrel does not carry it").not.toContain("copyToClipboard")
    expect(exported, "@preact-components/ui/copy-button does").toContain("copyToClipboard")
    expect(exported.length).toBeGreaterThan(Object.keys(ui).length)
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
