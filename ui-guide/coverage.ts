/**
 * The guide's coverage rule: the guide shows components, and a package's README names its helpers.
 *
 * A **component** — {@link isComponent} — needs a card in a component section, or an entry in
 * {@link COMPONENTS_WITHOUT_CARD} with a reason. Anything else — a function, a constant, an enum, a
 * label map — is a **helper**: the guide shows none, and the package's `README.md` has to name it
 * in code ({@link readmeNames}).
 *
 * The exports are read from the package rather than from a list, and from the barrel *and* every
 * subpath module the package publishes, so an export reachable only through its own subpath is
 * still seen. `coverage.test.ts` runs {@link coverageProblems} over that read and fails with the
 * offender's name when the rule is broken: a component with no card, a helper its README does not
 * name, an allow-list entry the package does not export or that is covered after all,
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
import { catalogueSections, coveredPackageIds, type PackageId } from "./registry.ts"
import { isComponent } from "./component-kind.ts"

export { isComponent, isComponentName } from "./component-kind.ts"

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

/** Names one package's component sections demonstrate, in render order. */
export function demoedNamesOf(id: PackageId): string[] {
  return catalogueSections
    .filter((section) => section.package === id && section.kind === "component")
    .flatMap((section) => section.names)
}

/** A package's `deno.json`. */
function configOf(id: PackageId): URL {
  return new URL(`./${id}/deno.json`, ROOT)
}

/**
 * The subpath modules a package config publishes, resolved from its `exports` map: everything it
 * publishes besides the barrel. {@link subpathModulesOf} reads a workspace member's; this form takes
 * the config itself so a test can hand it a fixture package no workspace member is.
 *
 * Every target is imported as it stands. None of the covered packages publishes anything but
 * TypeScript, so a stylesheet or other non-module target would fail the read loudly rather than be
 * skipped quietly — and it should, because a consumer could reach that subpath.
 *
 * @param config URL of the package's config; each target resolves against it.
 * @returns Each subpath key and its module as an importable URL.
 * @throws When a subpath's target is not a string. This cannot fire for a workspace member: Deno
 *   warns about such a config and then will not resolve the member at all, and this module imports
 *   every covered barrel by its member name, so it fails to load before the read runs. The throw is
 *   for a caller that hands in a config directly, as `coverage.test.ts` does with its fixture.
 */
export async function subpathModules(
  config: URL,
): Promise<Array<{ subpath: string; href: string }>> {
  // `exports` is a string (the barrel alone) or an object. Deno cannot resolve a package's barrel
  // from any other shape, or from none, and this module imports every covered barrel statically, so
  // the read never runs for such a package.
  const { exports } = parse(await Deno.readTextFile(config)) as {
    exports: string | Record<string, unknown>
  }
  if (typeof exports === "string") return []

  const modules: Array<{ subpath: string; href: string }> = []
  for (const [subpath, target] of Object.entries(exports)) {
    if (subpath === ".") continue
    if (typeof target !== "string") {
      throw new Error(`${config.href} declares ${subpath} with a non-string target`)
    }

    modules.push({ subpath, href: new URL(target, config).href })
  }

  return modules
}

/**
 * A workspace member's subpath modules: {@link subpathModules} over its own `deno.json`.
 *
 * @param id Package to read.
 */
export function subpathModulesOf(id: PackageId): Promise<Array<{ subpath: string; href: string }>> {
  return subpathModules(configOf(id))
}

/**
 * Every value export a consumer can reach in one package config: its barrel, and every subpath
 * module, since an export only its own subpath carries is otherwise invisible.
 *
 * @param barrel The package's barrel namespace.
 * @param config URL of the package's config.
 */
export async function readExports(barrel: object, config: URL): Promise<PackageNamespace> {
  const merged: Record<string, unknown> = { ...barrel }
  for (const { href } of await subpathModules(config)) {
    Object.assign(merged, await import(href) as object)
  }

  return merged
}

/**
 * Every value export a consumer can reach in one workspace member: {@link readExports} over its
 * barrel and its `deno.json`.
 *
 * @param id Package to read.
 */
export function valueExportsOf(id: PackageId): Promise<PackageNamespace> {
  return readExports(BARRELS[id], configOf(id))
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
 * @returns One message per problem, package by package; empty when the rule holds.
 */
export function coverageProblems(
  exports: Record<PackageId, PackageNamespace>,
  readmes: Record<PackageId, string>,
  allowed: Record<PackageId, readonly AllowedExport[]> = COMPONENTS_WITHOUT_CARD,
): string[] {
  const problems: string[] = []

  for (const id of coveredPackageIds) {
    const exported = new Set(Object.keys(exports[id]))
    const demoed = new Set(demoedNamesOf(id))
    const excused = new Set(allowed[id].map((entry) => entry.name))
    const component = (name: string) => isComponent(name, exports[id][name])

    for (const name of exported) {
      if (component(name)) {
        if (demoed.has(name) || excused.has(name)) continue
        problems.push(
          `${id} exports the component ${name} and no section demonstrates it — write a card, ` +
            `or add a COMPONENTS_WITHOUT_CARD entry saying why`,
        )
      } else if (!readmeNames(readmes[id], name)) {
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

    for (const name of demoed) {
      if (!exported.has(name)) {
        problems.push(`the ${id} sections demo ${name}, which ${id} does not export`)
      }
    }
  }

  return problems
}
