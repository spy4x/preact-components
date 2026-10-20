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

import { memberConfig, readEntryPoints } from "../infra/scripts/workspace.ts"
import { catalogueSections, coveredPackageIds, type PackageId } from "./registry.ts"
import { isComponent } from "./component-kind.ts"

export { isComponent, isComponentName } from "./component-kind.ts"

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
  system: [
    {
      name: "AccountTag",
      reason:
        "The badge `AccountMenu` and `AppShell` draw for `tag`; the AppShell card shows it with its admin panel switched on.",
    },
    {
      name: "RailCell",
      reason:
        "A cell for content in `Rail`'s `top` and `bottom` slots, with nothing to show outside a rail; the RailShell card draws its workspace switcher in one.",
    },
    {
      name: "RailEntry",
      reason:
        "An entry for content in `Rail`'s `top` and `bottom` slots, with nothing to show outside a rail; the Rail card draws its portrait with one.",
    },
  ],
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

/**
 * Every value export a consumer can reach in one package config: its barrel and every subpath
 * module, since an export only its own subpath carries is otherwise invisible. The modules are read
 * by `readEntryPoints` in `infra/scripts/workspace.ts`, the repository's one export reader.
 *
 * @param config URL of the package's config.
 */
export async function readExports(config: URL): Promise<PackageNamespace> {
  const merged: Record<string, unknown> = {}
  for (const { namespace } of await readEntryPoints(config)) Object.assign(merged, namespace)
  return merged
}

/**
 * Every value export a consumer can reach in one workspace member: {@link readExports} over its
 * `deno.json`.
 *
 * @param id Package to read.
 */
export async function valueExportsOf(id: PackageId): Promise<PackageNamespace> {
  return readExports(await memberConfig(id))
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
