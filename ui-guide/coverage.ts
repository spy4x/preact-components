/**
 * The catalogue's coverage rule: every component a catalogued package exports has a demo.
 *
 * One rule and one allow-list. A value export is a **component** when it is named like one —
 * {@link isComponentName} — and a helper otherwise; helpers need no entry anywhere. A component must
 * have a card in some section, unless {@link EXPORTS_WITHOUT_DEMO} names it with a reason.
 *
 * The exports are read from the package rather than from a list, and from the barrel *and* every
 * subpath module the package publishes, so a component reachable only through its own subpath is
 * still seen. `coverage.test.ts` runs {@link coverageProblems} over that read and fails with the
 * offender's name when the rule is broken: a component with no demo, an allow-list entry the package
 * does not export, an allow-list entry whose component has a demo after all, and a demo keyed to a
 * name its package does not export.
 */

import * as charts from "@preact-components/charts"
import * as crud from "@preact-components/crud"
import * as map from "@preact-components/map"
import * as system from "@preact-components/system"
import * as ui from "@preact-components/ui"
import { parse } from "@std/jsonc"
import { catalogueSections, type PackageId, packageIds } from "./registry.ts"

/** Barrel namespace of every catalogued package, keyed the way the catalogue keys it. */
const BARRELS: Record<PackageId, object> = { ui, charts, system, crud, map }

/** The repository root: the parent of every package directory. */
const ROOT = new URL("../", import.meta.url)

/** One component-named export the catalogue does not demonstrate, and why it does not. */
export interface AllowedExport {
  /** Value export name, exactly as its package exports it. */
  name: string
  /** Why there is no card: it is not a component, or its demo is still owed. */
  reason: string
}

/**
 * Component-named exports with no demo — the catalogue's one allow-list.
 *
 * Two cases live here, and both read the same way to the check: the name is component-shaped and no
 * card is expected. Either it is not a component at all (an `enum` is an object, not something to
 * render), or it is a component whose demo somebody still owes. The reason is what tells them apart
 * for a reader, and it is required because an entry with no argument is how a list rots.
 *
 * An entry the package no longer exports, and an entry whose component has been demoed since, are
 * both failures — so a name cannot be parked here and forgotten.
 */
export const EXPORTS_WITHOUT_DEMO: Record<PackageId, readonly AllowedExport[]> = {
  ui: [],
  charts: [],
  system: [],
  map: [],
  crud: [
    { name: "ValidationType", reason: "An enum of validation states, not a component." },
  ],
}

/**
 * Packages that carry a `deno.json` and are deliberately not demo sources.
 *
 * `coverage.test.ts` walks the top-level directories and fails when one with a package config is in
 * neither this record nor {@link packageIds}, so a package added later has to make a decision:
 * covering it and excluding it are both one line, and both are visible in review.
 */
export const EXCLUDED_PACKAGES = {
  cn: {
    reason:
      "One function, no component to demo — see cn/README.md for the theme-class rule instead of a catalogue card.",
  },
  icons: {
    reason:
      "Covered by the icon gallery: it reads the barrel itself, so a new glyph is in the catalogue with no entry here.",
  },
  theme: {
    reason: "Design tokens and a Tailwind preset — CSS, no components and nothing to render.",
  },
  "ui-guide": {
    reason:
      "The catalogue itself. It exports the guide and the icon gallery, and a card demonstrating the guide inside the guide would say nothing a reader does not already have on screen.",
  },
  pages: {
    reason:
      "The GitHub Pages demo, this guide's host app. A workspace member for its build-only pins, not a package: it publishes nothing.",
  },
  signals: {
    reason:
      "State factories and pure functions — a store, a sort comparator, a validator — with nothing to render. It exported `For` and `Show` until `@preact/signals/utils` was found to ship both; what is left is `signals/README.md`'s to explain, not a card's.",
  },
} as const satisfies Record<string, { reason: string }>

/**
 * Whether a value export is named the way a component is.
 *
 * Components are PascalCase: an initial capital and a lower-case letter somewhere after it. That
 * leaves camelCase (`clampProgress`) and all-caps constants (`DEFAULT_AXIS_COLOR`, `CONFLICT`) as
 * helpers, which is the convention every package already writes, and it keeps `D3LineChart` and
 * `OnOffButtons` on the component side.
 *
 * The one thing it cannot see is a component deliberately named in camelCase. Nothing in these
 * packages is, and a component that were would be caught in review rather than here.
 *
 * @param name Value export name.
 * @returns `true` when the name reads as a component's.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && /[a-z]/.test(name)
}

/** Component names one package's sections demonstrate, in render order. */
export function demoedNamesOf(id: PackageId): string[] {
  return catalogueSections.filter((section) => section.package === id).flatMap((s) => s.names)
}

/**
 * A package's subpath modules, resolved from its `deno.json` `exports` map: everything the map
 * publishes besides the barrel itself.
 *
 * {@link valueExportsOf} walks this same list to decide which modules to read, and
 * `coverage.test.ts` walks it too to build its fixtures, so the read and the test can never drift
 * apart on which modules count as a package's subpath surface. A target that is not a TypeScript
 * source is skipped — every catalogued package's `exports` map is all `.ts`/`.tsx` today, but
 * nothing here assumes that stays true — and one declared as anything but a string is an error
 * rather than a silent skip.
 *
 * @param id Package to read.
 * @returns Each subpath entry's own key and its target module resolved to an importable URL.
 * @throws When the package config declares no `exports` object, or declares a non-string target.
 */
export async function subpathModulesOf(
  id: PackageId,
): Promise<Array<{ subpath: string; href: string }>> {
  const config = parse(await Deno.readTextFile(new URL(`./${id}/deno.json`, ROOT)))
  const declared = (config as { exports?: unknown } | null)?.exports
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) {
    throw new Error(`${id}/deno.json declares no exports object`)
  }

  const modules: Array<{ subpath: string; href: string }> = []
  for (const [subpath, target] of Object.entries(declared)) {
    if (subpath === ".") continue
    if (typeof target !== "string") {
      throw new Error(`${id}/deno.json declares ${subpath} with a non-string target`)
    }
    if (!/\.tsx?$/.test(target)) continue

    modules.push({ subpath, href: new URL(`./${id}/${target}`, ROOT).href })
  }

  return modules
}

/**
 * Every value export a consumer can reach in one package: the barrel, and every subpath module.
 *
 * The barrel alone is not enough. A component exported from its own module and never re-exported is
 * reachable through `@preact-components/ui/its-module` and would otherwise be invisible to this
 * check, which is how one shipped with no card before.
 *
 * @param id Package to read.
 * @returns Its value export names, barrel first, each once.
 * @throws When the package config declares no `exports` object, or declares a non-string target.
 */
export async function valueExportsOf(id: PackageId): Promise<string[]> {
  const names = new Set(Object.keys(BARRELS[id]))
  for (const { href } of await subpathModulesOf(id)) {
    const namespace = await import(href) as object
    for (const name of Object.keys(namespace)) names.add(name)
  }

  return [...names]
}

/** Every catalogued package's value exports, keyed by package. */
export async function packageExports(): Promise<Record<PackageId, string[]>> {
  const read = await Promise.all(packageIds.map(async (id) => [id, await valueExportsOf(id)]))
  return Object.fromEntries(read) as Record<PackageId, string[]>
}

/**
 * Every way the catalogue and the packages it covers disagree, one message per problem.
 *
 * Both inputs are parameters so a test can drive the rule with an export list or an allow-list the
 * shipped tree cannot produce: in a healthy tree every list agrees, and a check that can only be run
 * against agreement proves nothing.
 *
 * @param exports Each package's value exports; normally {@link packageExports}'.
 * @param allowed Component-named exports excused from having a demo; defaults to the shipped list.
 * @returns One message per problem, package by package; empty when the catalogue is complete.
 */
export function coverageProblems(
  exports: Record<PackageId, readonly string[]>,
  allowed: Record<PackageId, readonly AllowedExport[]> = EXPORTS_WITHOUT_DEMO,
): string[] {
  const problems: string[] = []

  for (const id of packageIds) {
    const exported = new Set(exports[id])
    const demoed = new Set(demoedNamesOf(id))
    const excused = new Set(allowed[id].map((entry) => entry.name))

    for (const name of exported) {
      if (!isComponentName(name) || demoed.has(name) || excused.has(name)) continue
      problems.push(
        `${id} exports ${name} and no section demonstrates it — write a demo, or add an ` +
          `EXPORTS_WITHOUT_DEMO entry saying why there is none`,
      )
    }

    for (const { name } of allowed[id]) {
      if (!exported.has(name)) {
        problems.push(`${id} does not export ${name}, which EXPORTS_WITHOUT_DEMO names`)
      } else if (demoed.has(name)) {
        problems.push(`${id}'s ${name} has a demo, so its EXPORTS_WITHOUT_DEMO entry is stale`)
      }
    }

    for (const name of demoed) {
      if (!exported.has(name)) {
        problems.push(`the ${id} sections demo ${name}, which ${id} does not export`)
      }
    }
  }

  return problems
}
