/**
 * The catalogue's coverage rule: every value a catalogued package exports is shown somewhere.
 *
 * A **component** — {@link isComponent} — needs a card in a component section. Anything else — a
 * function, a constant, an enum, a label map — needs a card or an example card that names it in
 * its `covers` (`example.tsx`). An export with neither must be named by {@link allowedExports},
 * with a reason.
 *
 * The exports are read from the package rather than from a list, and from the barrel *and* every
 * subpath module the package publishes, so an export reachable only through its own subpath is
 * still seen. `coverage.test.ts` runs {@link coverageProblems} over that read and fails with the
 * offender's name when the rule is broken: an export with no card or example, an allow-list entry
 * the package does not export or that is covered after all, and a card or example naming a name
 * its package does not export.
 */

import * as charts from "@preact-components/charts"
import * as cn from "@preact-components/cn"
import * as crud from "@preact-components/crud"
import * as map from "@preact-components/map"
import * as signals from "@preact-components/signals"
import * as system from "@preact-components/system"
import * as theme from "@preact-components/theme"
import * as ui from "@preact-components/ui"
import { parse } from "@std/jsonc"
import { EXAMPLES_PENDING } from "./examples-pending.ts"
import { catalogueSections, coveredPackageIds, exampleDemos, type PackageId } from "./registry.ts"

/** Barrel namespace of every catalogued package, keyed the way the catalogue keys it. */
const BARRELS: Record<PackageId, object> = { ui, charts, system, crud, map, signals, theme, cn }

/** One package's value exports: each name, and the value it is bound to. */
export type PackageNamespace = Readonly<Record<string, unknown>>

/** The repository root: the parent of every package directory. */
const ROOT = new URL("../", import.meta.url)

/** One export the catalogue does not show, and why it does not. */
export interface AllowedExport {
  /** Value export name, exactly as its package exports it. */
  name: string
  /** Why there is no card or example. */
  reason: string
}

/**
 * Exports with no card and no example, each with a reason — the allow-list for anything other
 * than a pending example, which {@link EXAMPLES_PENDING} lists instead.
 *
 * The reason is required because an entry with no argument is how a list rots. An entry the
 * package no longer exports, and an entry covered since, are both failures.
 */
export const EXPORTS_WITHOUT_DEMO: Record<PackageId, readonly AllowedExport[]> = {
  ui: [],
  charts: [],
  system: [],
  map: [],
  crud: [],
  signals: [
    {
      name: "useUrlFilters",
      reason:
        "It binds filters to the page's own address: it reads the parameters of whichever application hosts the catalogue, and writes that application's address as soon as a filter changes. Its pure parts have example cards; the hook is demonstrated by the demo app (`pages/src/url-filters.tsx`) and driven in a browser by `pages/checks/signals.ts`.",
    },
  ],
  theme: [],
  cn: [],
}

/** The reason every {@link EXAMPLES_PENDING} name carries in {@link allowedExports}. */
export const PENDING_REASON = "example pending (#215)"

/**
 * The whole allow-list: {@link EXPORTS_WITHOUT_DEMO}, plus every {@link EXAMPLES_PENDING} name with
 * {@link PENDING_REASON}.
 */
export const allowedExports = Object.fromEntries(
  coveredPackageIds.map((id) => [id, [
    ...EXPORTS_WITHOUT_DEMO[id],
    ...EXAMPLES_PENDING[id].map((name) => ({ name, reason: PENDING_REASON })),
  ]]),
) as unknown as Record<PackageId, readonly AllowedExport[]>

/**
 * Packages that carry a `deno.json` and are deliberately not covered. `coverage.test.ts` fails when
 * a package directory is in neither this record nor {@link coveredPackageIds}.
 */
export const EXCLUDED_PACKAGES = {
  icons: {
    reason:
      "Covered by the icon gallery: it reads the barrel itself, so a new glyph is in the catalogue with no entry here.",
  },
  "ui-guide": {
    reason:
      "The catalogue itself. It exports the guide and the icon gallery, and a card demonstrating the guide inside the guide would say nothing a reader does not already have on screen.",
  },
  pages: {
    reason:
      "The GitHub Pages demo, this guide's host app. A workspace member for its build-only pins, not a package: it publishes nothing.",
  },
} as const satisfies Record<string, { reason: string }>

/**
 * Whether a value export is named the way a component is: PascalCase, an initial capital and a
 * lower-case letter after it. `D3LineChart` is; `clampProgress` and `DEFAULT_AXIS_COLOR` are not.
 *
 * @param name Value export name.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && /[a-z]/.test(name)
}

/**
 * Whether an export is a component: a function named like one. A PascalCase object — an enum such
 * as `ThemeValue` — is not, so an example can cover it.
 *
 * @param name Value export name.
 * @param value The value it is bound to.
 */
export function isComponent(name: string, value: unknown): boolean {
  return isComponentName(name) && typeof value === "function"
}

/** Names one package's component sections demonstrate, in render order. */
export function demoedNamesOf(id: PackageId): string[] {
  return catalogueSections
    .filter((section) => section.package === id && section.kind === "component")
    .flatMap((section) => section.names)
}

/** Names one package's example cards cover, in render order. */
export function exampledNamesOf(id: PackageId): string[] {
  return catalogueSections
    .filter((section) => section.package === id && section.kind === "example")
    .flatMap((section) => section.names.flatMap((key) => exampleDemos[key].covers))
}

/**
 * A package's subpath modules, resolved from its `deno.json` `exports` map: everything it publishes
 * besides the barrel. A target that is not TypeScript is skipped.
 *
 * @param id Package to read.
 * @returns Each subpath key and its module as an importable URL.
 * @throws When the config declares no `exports` object, or a non-string target.
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
 * Every value export a consumer can reach in one package: the barrel, and every subpath module, since
 * an export only its own subpath carries is otherwise invisible.
 *
 * @param id Package to read.
 * @throws When the config declares no `exports` object, or a non-string target.
 */
export async function valueExportsOf(id: PackageId): Promise<PackageNamespace> {
  const merged: Record<string, unknown> = { ...BARRELS[id] }
  for (const { href } of await subpathModulesOf(id)) {
    Object.assign(merged, await import(href) as object)
  }

  return merged
}

/** Every catalogued package's value exports, keyed by package. */
export async function packageExports(): Promise<Record<PackageId, PackageNamespace>> {
  const read = await Promise.all(
    coveredPackageIds.map(async (id) => [id, await valueExportsOf(id)]),
  )
  return Object.fromEntries(read) as Record<PackageId, PackageNamespace>
}

/**
 * Every way the catalogue and the packages it covers disagree, one message per problem.
 *
 * Both inputs are parameters so a test can drive the rule with exports or an allow-list the shipped
 * tree cannot produce: in a healthy tree every list agrees, and a check that can only be run against
 * agreement proves nothing.
 *
 * @param exports Each package's value exports; normally {@link packageExports}'.
 * @param allowed Exports excused from having a card or example; defaults to {@link allowedExports}.
 * @param examplesOf Names a package's examples cover; defaults to {@link exampledNamesOf}.
 * @returns One message per problem, package by package; empty when the catalogue is complete.
 */
export function coverageProblems(
  exports: Record<PackageId, PackageNamespace>,
  allowed: Record<PackageId, readonly AllowedExport[]> = allowedExports,
  examplesOf: (id: PackageId) => readonly string[] = exampledNamesOf,
): string[] {
  const problems: string[] = []

  for (const id of coveredPackageIds) {
    const exported = new Set(Object.keys(exports[id]))
    const demoed = new Set(demoedNamesOf(id))
    const exampled = new Set(examplesOf(id))
    const excused = new Set(allowed[id].map((entry) => entry.name))

    for (const [name, value] of Object.entries(exports[id])) {
      if (demoed.has(name) || excused.has(name)) continue
      if (isComponent(name, value)) {
        problems.push(
          `${id} exports the component ${name} and no section demonstrates it — write a demo ` +
            `card (an example does not count), or add an EXPORTS_WITHOUT_DEMO entry saying why`,
        )
      } else if (!exampled.has(name)) {
        problems.push(
          `${id} exports ${name} and no card or example covers it — write an example, or add ` +
            `an EXPORTS_WITHOUT_DEMO entry saying why there is none`,
        )
      }
    }

    for (const { name } of allowed[id]) {
      if (!exported.has(name)) {
        problems.push(`${id} does not export ${name}, which the allow-list names`)
      } else if (
        demoed.has(name) || (exampled.has(name) && !isComponent(name, exports[id][name]))
      ) {
        problems.push(`${id}'s ${name} has a card or an example, so its allow-list entry is stale`)
      }
    }

    for (const name of demoed) {
      if (!exported.has(name)) {
        problems.push(`the ${id} sections demo ${name}, which ${id} does not export`)
      }
    }
    for (const name of exampled) {
      if (!exported.has(name)) {
        problems.push(`the ${id} examples cover ${name}, which ${id} does not export`)
      }
    }
  }

  return problems
}
