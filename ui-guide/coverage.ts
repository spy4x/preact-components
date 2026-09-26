/**
 * The guide's coverage rule: the guide shows components, and a package's README names its helpers.
 *
 * A **component** — {@link isComponent} — needs a card in a component section, or an entry in
 * {@link COMPONENTS_WITHOUT_CARD} with a reason. Anything else — a function, a constant, an enum, a
 * label map — is a **helper**: the guide shows none, and the package's `README.md` has to name it
 * in code ({@link readmeNames}), unless {@link README_PENDING} still lists it.
 *
 * The exports are read from the package rather than from a list, and from the barrel *and* every
 * subpath module the package publishes, so an export reachable only through its own subpath is
 * still seen. `coverage.test.ts` runs {@link coverageProblems} over that read and fails with the
 * offender's name when the rule is broken: a component with no card, a helper its README does not
 * name, an allow-list or pending entry the package does not export or that is covered after all,
 * and a card naming a name its package does not export.
 */

import * as charts from "@spy4x/preact-charts"
import * as cn from "@spy4x/preact-cn"
import * as crud from "@spy4x/preact-crud"
import * as map from "@spy4x/preact-map"
import * as signals from "@spy4x/preact-signals"
import * as system from "@spy4x/preact-system"
import * as theme from "@spy4x/preact-theme"
import * as ui from "@spy4x/preact-ui"
import { parse } from "@std/jsonc"
import { README_PENDING } from "./readme-pending.ts"
import { catalogueSections, coveredPackageIds, type PackageId } from "./registry.ts"

export { README_PENDING }

/** Barrel namespace of every covered package, keyed the way the catalogue keys it. */
const BARRELS: Record<PackageId, object> = { ui, charts, system, crud, map, signals, theme, cn }

/** One package's value exports: each name, and the value it is bound to. */
export type PackageNamespace = Readonly<Record<string, unknown>>

/** The repository root: the parent of every package directory. */
const ROOT = new URL("../", import.meta.url)

/** One component the guide does not show, and why it does not. */
export interface AllowedExport {
  /** Component export name, exactly as its package exports it. */
  name: string
  /** Why there is no card. */
  reason: string
}

/**
 * Components with no card, each with a reason.
 *
 * The reason is required because an entry with no argument is how a list rots. An entry the
 * package no longer exports, one that is not a component, and one with a card since are all
 * failures.
 */
export const COMPONENTS_WITHOUT_CARD: Record<PackageId, readonly AllowedExport[]> = {
  ui: [],
  charts: [],
  map: [],
  system: [],
  crud: [],
  theme: [],
  signals: [],
  cn: [],
}

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
 * lower-case letter after it. `LineChart` is; `clampProgress` and `DEFAULT_AXIS_COLOR` are not.
 *
 * @param name Value export name.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && /[a-z]/.test(name)
}

/**
 * Whether an export is a component: a function named like one. A PascalCase object — an enum such
 * as `ThemeValue` — is not, and neither is a class (`NpmVersionMismatchError`): both are helpers.
 *
 * @param name Value export name.
 * @param value The value it is bound to.
 */
export function isComponent(name: string, value: unknown): boolean {
  return isComponentName(name) && typeof value === "function" &&
    !/^class\b/.test(Function.prototype.toString.call(value))
}

/** Names one package's component sections demonstrate, in render order. */
export function demoedNamesOf(id: PackageId): string[] {
  return catalogueSections
    .filter((section) => section.package === id && section.kind === "component")
    .flatMap((section) => section.names)
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
 * Whether a README names an export in code: a code span that starts with the name, as a whole word
 * — `` `clampProgress` `` or `` `clampProgress(value, max)` ``. A mention in prose does not count,
 * and neither does a longer name that starts with it (`` `clampProgressBar` ``).
 *
 * @param readme The README's text.
 * @param name Export name.
 */
export function readmeNames(readme: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\`${escaped}(?![\\w$])[^\`\\n]*\``).test(readme)
}

/** Every covered package's `README.md`, keyed by package. */
export async function packageReadmes(): Promise<Record<PackageId, string>> {
  const read = await Promise.all(
    coveredPackageIds.map(async (id) => [
      id,
      await Deno.readTextFile(new URL(`./${id}/README.md`, ROOT)),
    ]),
  )
  return Object.fromEntries(read) as Record<PackageId, string>
}

/**
 * Every way the guide, the READMEs and the packages disagree, one message per problem.
 *
 * Every input is a parameter so a test can drive the rule with exports, READMEs or lists the
 * shipped tree cannot produce: in a healthy tree every list agrees, and a check that can only be
 * run against agreement proves nothing.
 *
 * @param exports Each package's value exports; normally {@link packageExports}'.
 * @param readmes Each package's README text; normally {@link packageReadmes}'.
 * @param allowed Components excused from a card; defaults to {@link COMPONENTS_WITHOUT_CARD}.
 * @param pending Helpers still waiting for a README line; defaults to {@link README_PENDING}.
 * @returns One message per problem, package by package; empty when the rule holds.
 */
export function coverageProblems(
  exports: Record<PackageId, PackageNamespace>,
  readmes: Record<PackageId, string>,
  allowed: Record<PackageId, readonly AllowedExport[]> = COMPONENTS_WITHOUT_CARD,
  pending: Record<PackageId, readonly string[]> = README_PENDING,
): string[] {
  const problems: string[] = []

  for (const id of coveredPackageIds) {
    const exported = new Set(Object.keys(exports[id]))
    const demoed = new Set(demoedNamesOf(id))
    const excused = new Set(allowed[id].map((entry) => entry.name))
    const waiting = new Set(pending[id])
    const component = (name: string) => isComponent(name, exports[id][name])

    for (const name of exported) {
      if (component(name)) {
        if (demoed.has(name) || excused.has(name)) continue
        problems.push(
          `${id} exports the component ${name} and no section demonstrates it — write a card, ` +
            `or add a COMPONENTS_WITHOUT_CARD entry saying why`,
        )
      } else if (!readmeNames(readmes[id], name) && !waiting.has(name)) {
        problems.push(
          `${id} exports the helper ${name} and ${id}/README.md does not name it — add a line ` +
            `that names it in code, \`${name}\``,
        )
      }
    }

    for (const { name } of allowed[id]) {
      if (!exported.has(name)) {
        problems.push(`${id} does not export ${name}, which COMPONENTS_WITHOUT_CARD names`)
      } else if (!component(name)) {
        problems.push(
          `${id}'s ${name} is not a component, so COMPONENTS_WITHOUT_CARD cannot excuse it`,
        )
      } else if (demoed.has(name)) {
        problems.push(`${id}'s ${name} has a card, so its COMPONENTS_WITHOUT_CARD entry is stale`)
      }
    }

    for (const name of waiting) {
      if (!exported.has(name)) {
        problems.push(`${id} does not export ${name}, which README_PENDING names`)
      } else if (component(name)) {
        problems.push(`${id}'s ${name} is a component, so README_PENDING cannot excuse it`)
      } else if (readmeNames(readmes[id], name)) {
        problems.push(`${id}/README.md names ${name}, so its README_PENDING entry is stale`)
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
