/**
 * Writes `llms.txt` and `llms-full.txt` at the repository root: plain-text maps of the library for
 * a language model (or a person in a hurry) that has to choose and import a component without
 * opening the source.
 *
 * ```bash
 * deno task llms
 * ```
 *
 * It runs `deno doc`, so it needs `--allow-run` on top of read and write; the task and the test
 * task grant it.
 *
 * Both files are generated. Never edit them by hand: `infra/scripts/llms-txt.test.ts` fails, and
 * names that command, when either differs from what this script writes. The build of the demo site
 * copies them to the site root, so they are served at `<site>/llms.txt` and `<site>/llms-full.txt`.
 *
 * **Shape.** `llms.txt` has the line format of `spy4x/ts-libs`' `llms.txt`
 * (https://github.com/spy4x/ts-libs/pull/628), so one search works on both files:
 *
 * - Every line that is not an export starts with `#`: the lines of {@linkcode HEADER}. There is
 *   no last line with a hash, which ts-libs' file has: the test regenerates this file and compares
 *   it whole, and such a line would make any two changes to the exports conflict.
 * - Every other line is one export ({@linkcode exportLine}): name, kind, import specifier and
 *   one-sentence summary, separated by one tab each. Packages follow each other with no heading and
 *   no blank line, in the order of the package list; within a package the entry points keep their
 *   order and the names of one entry point are sorted by code unit.
 * - A type named after a function or class whose parameters it describes, such as `BadgeProps`
 *   next to the component `Badge`, has no line ({@linkcode describesParameters}).
 * - `llms-full.txt` is {@linkcode FULL_HEADER} followed by every published package's `README.md`,
 *   in the same order.
 *
 * **Where each fact comes from.**
 *
 * - The names of value exports come from `readPackages()` in `export-lists.ts`, which imports each
 *   package's entry points; one with no declaration in the docs makes the script throw. Types, kinds
 *   and JSDoc come from `deno doc --json` over the entry points ({@linkcode denoDoc}), which
 *   follows every re-export, across packages too.
 * - The kind is the declaration's own kind plus the name: an `interface`, type alias or `enum` is a
 *   `type`; a name starting `use` and a capital is a `hook`; a component by the catalogue's rule
 *   (`isComponent` in `ui-guide/component-kind.ts`: a function named in PascalCase, never a class)
 *   is a `component`; an `UPPER_SNAKE` name or a
 *   non-function variable is a `constant`; anything else is a `helper`. Those five words are the
 *   second field of a line.
 * - The summary is the first sentence of the declaration's JSDoc. With none, the sentence in the
 *   package README's table row for that name, but only in a column headed like a description
 *   ("What it is", "Summary"): a props or migration table would give a wrong one. A `FooProps` type
 *   with neither is described as "Props of `Foo`." With none of these the entry has no summary, and
 *   `deno task llms` prints its name so the gap is visible. An export whose own JSDoc has
 *   `@deprecated` gets `Deprecated: …` in front ({@linkcode deprecatedSummary}).
 * - The import specifier is the package root when the barrel exports the name, else the first
 *   subpath that does.
 *
 * Versions are left out on purpose, so a release does not make the files stale.
 *
 * @module
 */

import { type PackageSurface, readPackages } from "./export-lists.ts"
import { type EntryPoint, entryPoints, memberConfig, readConfig, ROOT } from "./workspace.ts"

/** Public address of the demo site, which serves both files at its root. */
export const SITE = `https://spy4x.github.io/preact-components`

/** The endings of a type that describes the parameters of the function or class it is named after. */
export const PARAMETER_SUFFIXES = [`Props`, `Labels`, `Options`, `Config`, `Deps`, `Input`]

/** The first lines of `llms.txt`. Each starts with `#`, as every line that is not an export does. */
export const HEADER = [
  `# preact-components: the exports of the @spy4x/preact-* packages on JSR, one per line.`,
  `# Columns, separated by one tab: name, kind, import specifier, summary.`,
  `# Search: git grep -n -i '<word>' origin/main -- llms.txt`,
  `# Use: deno add jsr:<package>, then import { <name> } from "<import specifier>".`,
  `# Left out: a type or interface that describes the parameters of a listed function or class Foo, foo or createFoo and is named Foo plus ${
    PARAMETER_SUFFIXES.join(`, `)
  }. Its signature: https://jsr.io/<package>/doc`,
  `# Full READMEs: ${SITE}/llms-full.txt`,
]

/** The text `llms-full.txt` starts with. */
export const FULL_HEADER = `# preact-components

> Preact + Tailwind components built on web standards: accessible components, design tokens, icons,
> charts, CRUD scaffolding and signals helpers for Deno apps. Components render on the server and
> hydrate in the browser, take everything through props and ports, and never import an app's state.

Use it when an app needs a button, table, dialog, form field, chart, calendar, shell or state store
and you would rather import a tested, keyboard-accessible one than write it. Every package is
published on JSR as \`@spy4x/preact-<package>\`, all at one version.

Install a package:

    deno add jsr:@spy4x/preact-<package>

Exact signatures and props are not repeated here. Read them from the published package:

    deno doc jsr:@spy4x/preact-<package>

Each line below is one export: its name, its kind (component, hook, helper, type or constant), a
one-sentence summary and the specifier to import it from. The specifier \`@spy4x/preact-ui/badge\`
imports the same name as \`@spy4x/preact-ui\` but pulls in only that module.

More: live guide ${SITE}/ · the full package READMEs ${SITE}/llms-full.txt
`

/** One listed export. */
export interface Entry {
  name: string
  kind: "component" | "hook" | "helper" | "type" | "constant"
  /** One sentence, or an empty string when no source gives one. */
  summary: string
  /** Import specifier, for example `@spy4x/preact-ui/badge`. */
  specifier: string
  /**
   * The declaration's own keyword: `interface`, `typeAlias`, `enum`, `function`, `class` or
   * `variable`. {@linkcode describesParameters} reads it, because `kind` does not tell an enum
   * from an interface or a helper function from a lower-case constant.
   */
  keyword: string
}

/** A JSDoc tag in `deno doc --json` output. */
export interface DocTag {
  /** `deprecated`, `param`, `returns` and so on. */
  kind: string
  doc?: string
}

/** The part of `deno doc --json` output this script reads: one symbol of one entry point. */
export interface DocSymbol {
  name: string
  declarations: {
    /** `interface`, `typeAlias`, `enum`, `function`, `class`, `variable` or `reference`. */
    kind: string
    /** `export` for a public name; `private` for a type an exported one extends. */
    declarationKind?: string
    jsDoc?: { doc?: string; tags?: DocTag[] }
    /** Where a real declaration is. */
    location?: { filename: string }
    /** For a `reference`: the declaration it re-exports. */
    def?: { target?: { filename: string } }
  }[]
}

/** One entry point of a package, with the symbols `deno doc` found in it. */
export interface DocEntryPoint {
  /** Import specifier of the entry point, for example `@spy4x/preact-ui/badge`. */
  specifier: string
  symbols: DocSymbol[]
}

/**
 * Runs `deno doc --json` over entry point files and reads back each file's symbols.
 *
 * `deno doc` follows every re-export, including a name re-exported from another package, and reads
 * the JSDoc where the name is declared. A name it reports as a `reference` is a re-export of one
 * declared elsewhere; {@linkcode buildEntries} resolves it through the same package's other entry
 * points.
 *
 * @param files Entry point file URLs.
 * @returns The symbols per file URL.
 * @throws When `deno doc` fails.
 */
export async function denoDoc(files: URL[]): Promise<Map<string, DocSymbol[]>> {
  const result = await new Deno.Command(Deno.execPath(), {
    args: [`doc`, `--json`, ...files.map((file) => file.href)],
    stdout: `piped`,
    stderr: `piped`,
  }).output()
  if (!result.success) {
    throw new Error(`deno doc failed: ${new TextDecoder().decode(result.stderr)}`)
  }
  const parsed = JSON.parse(new TextDecoder().decode(result.stdout))
  const symbols = new Map<string, DocSymbol[]>()
  for (const [file, node] of Object.entries<{ symbols: DocSymbol[] }>(parsed.nodes)) {
    symbols.set(file, node.symbols)
  }
  return symbols
}

/**
 * First sentence of a paragraph: up to the first full stop followed by a space or the end.
 *
 * @param text Prose, possibly across lines, possibly with several paragraphs.
 * @returns The sentence on one line, ending in its full stop; empty for empty input.
 */
export function firstSentence(text: string): string {
  const paragraph = text.trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ")
    .replace(/\{@link(?:code|plain)?\s+([^}\s]+)(?:\s+[^}]*)?\}/g, "`$1`").trim()
  const end = paragraph.search(/\.(?:\s|$)/)
  return (end < 0 ? paragraph : paragraph.slice(0, end + 1)).trim()
}

/** Table column headings that hold a one-sentence description of the row's first cell. */
const DESCRIPTION_COLUMNS = /^(summary|description|what it is|what it does)$/i

/**
 * The summary a package README gives a name: the description cell of the row whose first cell holds
 * the name in backticks. Only a column headed like a description counts (see
 * {@linkcode DESCRIPTION_COLUMNS}): a table of props, ports or a migration ("Before | Now") says
 * something else about the name, and a wrong summary is worse than none.
 *
 * @param readme Package README text.
 * @param name Exported name.
 * @returns The first sentence, or an empty string.
 */
export function readmeSummary(readme: string, name: string): string {
  const mark = new RegExp(`\`${name.replace(/\$/g, "\\$")}(?:\\(.*?\\))?\``)
  const cellsOf = (line: string) => line.split("|").slice(1, -1).map((cell) => cell.trim())
  let column = -1
  let previous = ""
  for (const line of readme.split("\n")) {
    if (!line.startsWith("|")) {
      column = -1
    } else if (/^\|[\s:|-]+\|$/.test(line)) {
      column = cellsOf(previous).findIndex((heading) => DESCRIPTION_COLUMNS.test(heading))
    } else if (column > 0) {
      const cells = cellsOf(line)
      if (mark.test(cells[0] ?? "") && cells[column]) return firstSentence(cells[column])
    }
    previous = line
  }
  return ""
}

/**
 * The kind of an export, from its declaration keyword, its name, and whether it is a component.
 *
 * @param name Exported name.
 * @param keyword Declaration keyword.
 * @param component Whether the export is a component by the catalogue's own rule, `isComponent` in
 *   `ui-guide/component-kind.ts`, as `readPackages()` reports it.
 * @returns One of the five kinds the files use.
 */
export function kindOf(name: string, keyword: string, component: boolean): Entry["kind"] {
  if (["interface", "typeAlias", "enum"].includes(keyword)) return "type"
  if (/^use[A-Z]/.test(name)) return "hook"
  if (component) return "component"
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return "constant"
  if (keyword === "variable" && !/^[a-z]/.test(name)) return "constant"
  return "helper"
}

/** A declaration in `deno doc` output. */
export type DocDeclaration = DocSymbol["declarations"][number]

/**
 * Indexes every public, non-reference declaration by name and file, so a re-export can be followed
 * to where it is declared, in another package too.
 *
 * @param symbolsByFile The result of {@linkcode denoDoc}.
 * @returns Declarations keyed `<name>|<file URL>`.
 */
export function declarationIndex(
  symbolsByFile: Iterable<DocSymbol[]>,
): Map<string, DocDeclaration> {
  const index = new Map<string, DocDeclaration>()
  for (const symbols of symbolsByFile) {
    for (const { name, declarations } of symbols) {
      for (const declaration of declarations) {
        if (declaration.kind === `reference` || declaration.declarationKind === `private`) continue
        index.set(`${name}|${declaration.location?.filename}`, declaration)
      }
    }
  }
  return index
}

/**
 * Lists one package's exports, values and types, each with its kind, summary and specifier.
 *
 * A name exported by several entry points is listed once, under the first: the barrel comes first,
 * so a name the barrel exports imports from the package root. The kind and the JSDoc come from
 * where the name is declared: a `reference` symbol (a re-export) is followed through `index` to
 * its declaration, in this package or another. A reference that reaches nothing has neither. With
 * no JSDoc the summary falls back to the README's description column, then, for a `FooProps` type,
 * to "Props of `Foo`."; otherwise it is empty.
 *
 * @param entryPoints The package's entry points, barrel first, with their `deno doc` symbols.
 * @param surface The package's value exports and which of them are components, from
 *   `readPackages()`.
 * @param readme The package README.
 * @param pkg The package name, for the error message.
 * @param index {@linkcode declarationIndex} over every package's symbols.
 * @returns The entries.
 * @throws When a value export has no declaration.
 */
export function buildEntries(
  entryPoints: DocEntryPoint[],
  surface: Pick<PackageSurface, "names" | "components">,
  readme: string,
  pkg: string,
  index: Map<string, DocDeclaration>,
): Entry[] {
  const resolve = (name: string, declarations: DocDeclaration[]) => {
    for (const declaration of declarations) {
      if (declaration.declarationKind === `private`) continue
      if (declaration.kind !== `reference`) return declaration
      const target = index.get(`${name}|${declaration.def?.target?.filename}`)
      if (target) return target
    }
  }

  const entries = new Map<string, Entry>()
  for (const { specifier, symbols } of entryPoints) {
    for (const { name, declarations } of symbols) {
      const declaration = resolve(name, declarations)
      if (!declaration || entries.has(name)) continue
      let summary = firstSentence(declaration.jsDoc?.doc ?? ``) || readmeSummary(readme, name)
      // A props type with no JSDoc of its own is described by the component it belongs to.
      if (!summary && /^[A-Z]\w*Props$/.test(name) && declaration.kind !== `function`) {
        summary = `Props of \`${name.slice(0, -5)}\`.`
      }
      entries.set(name, {
        name,
        kind: kindOf(name, declaration.kind, surface.components.includes(name)),
        summary: deprecatedSummary(summary, declaration.jsDoc?.tags),
        specifier,
        keyword: declaration.kind,
      })
    }
  }

  for (const name of surface.names) {
    if (!entries.has(name)) {
      throw new Error(`${pkg} exports \`${name}\` but no declaration was found for it`)
    }
  }
  return [...entries.values()]
}

/**
 * The summary of an export whose JSDoc carries `@deprecated`: the word, the first sentence of the
 * tag's text (which names the replacement), then the summary. Without the tag the summary comes
 * back unchanged.
 */
export function deprecatedSummary(summary: string, tags: DocTag[] | undefined): string {
  const tag = tags?.find((item) => item.kind === `deprecated`)
  if (tag === undefined) return summary
  const reason = firstSentence(tag.doc ?? ``)
  const stop = /[.!?]$/.test(reason) ? `` : `.`
  return `${reason === `` ? `Deprecated.` : `Deprecated: ${reason}${stop}`} ${summary}`.trim()
}

/**
 * The exports of one entry point that `llms.txt` leaves out: an interface or a type alias named
 * after a function or class of the same entry point plus one of {@linkcode PARAMETER_SUFFIXES}.
 * For `FooProps` that owner is `Foo`, `foo` or `createFoo`. A component counts as a function
 * however it is declared: `Button` is a constant holding a `forwardRef` component, and
 * `ButtonProps` is still its parameters. An interface, a type, an enum or any other constant is
 * never an owner: a type named after one is a shape of its own, not a parameter. An enum is never
 * left out.
 *
 * @param entries The entries of one import specifier.
 * @returns The names that get no line.
 */
export function describesParameters(entries: Entry[]): Set<string> {
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const takesParameters = (name: string) => {
    const owner = byName.get(name)
    return owner?.keyword === `function` || owner?.keyword === `class` ||
      owner?.kind === `component`
  }
  const dropped = new Set<string>()
  for (const { name, keyword } of entries) {
    if (keyword !== `typeAlias` && keyword !== `interface`) continue
    const suffix = PARAMETER_SUFFIXES.find((item) => name.endsWith(item) && name !== item)
    if (suffix === undefined) continue
    const base = name.slice(0, -suffix.length)
    const owners = [base, base[0].toLowerCase() + base.slice(1), `create${base}`]
    if (owners.some(takesParameters)) dropped.add(name)
  }
  return dropped
}

/**
 * One line of `llms.txt`: name, kind, import specifier and summary, separated by one tab each.
 * Any run of whitespace inside a field becomes one space, so a line always has exactly three
 * tabs; an empty summary leaves the fourth field empty.
 */
export function exportLine(entry: Entry): string {
  return [entry.name, entry.kind, entry.specifier, entry.summary]
    .map((field) => field.replace(/\s+/g, ` `).trim()).join(`\t`)
}

/**
 * The export lines of one package: its entry points in the order they first appear, the names of
 * one entry point sorted by code unit, without the names {@linkcode describesParameters} leaves
 * out.
 *
 * @param entries One package's entries, from {@linkcode buildEntries}.
 * @returns The lines and the names left out.
 */
export function exportLines(entries: Entry[]): { lines: string[]; dropped: string[] } {
  const bySpecifier = new Map<string, Entry[]>()
  for (const entry of entries) {
    bySpecifier.set(entry.specifier, [...(bySpecifier.get(entry.specifier) ?? []), entry])
  }
  const lines: string[] = []
  const dropped: string[] = []
  for (const group of bySpecifier.values()) {
    const left = describesParameters(group)
    group.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of group) {
      if (left.has(entry.name)) dropped.push(`${entry.specifier}: ${entry.name}`)
      else lines.push(exportLine(entry))
    }
  }
  return { lines, dropped }
}

/** Both generated files, and the entries that have no summary. */
export interface Generated {
  llms: string
  full: string
  /** `package: Name` for every listed export with neither JSDoc nor README summary. */
  missingSummaries: string[]
  /** `specifier: Name` for every export `llms.txt` leaves out. */
  dropped: string[]
}

/**
 * Builds the text of both files from the repository as it is now.
 *
 * @returns The two files and the names that lack a summary.
 */
export async function generate(): Promise<Generated> {
  const packages = await readPackages()
  const lines: string[] = []
  const dropped: string[] = []
  const readmes: string[] = []
  const missingSummaries: string[] = []

  const configs: Record<string, { name: string; points: EntryPoint[] }> = {}
  for (const id of Object.keys(packages)) {
    const url = await memberConfig(id)
    configs[id] = { name: (await readConfig(url)).name ?? id, points: await entryPoints(url) }
  }
  const symbols = await denoDoc(
    Object.values(configs).flatMap(({ points }) => points.map(({ href }) => new URL(href))),
  )
  const index = declarationIndex(symbols.values())

  for (const [id, surface] of Object.entries(packages)) {
    const config = configs[id]
    const readme = await Deno.readTextFile(new URL(`${id}/README.md`, ROOT)).catch(() => "")
    const points: DocEntryPoint[] = config.points.map(({ subpath, href }) => ({
      specifier: subpath === "." ? config.name : `${config.name}/${subpath.replace(/^\.\//, "")}`,
      symbols: symbols.get(href) ?? [],
    }))
    const entries = buildEntries(points, surface, readme, config.name, index)
    const listed = exportLines(entries)
    lines.push(...listed.lines)
    dropped.push(...listed.dropped)
    const left = new Set(listed.dropped)
    for (const entry of entries) {
      if (!entry.summary && !left.has(`${entry.specifier}: ${entry.name}`)) {
        missingSummaries.push(`${config.name}: ${entry.name}`)
      }
    }
    readmes.push(`<!-- ${config.name} — ${id}/README.md -->\n\n${readme.trim()}`)
  }

  return {
    llms: [...HEADER, ...lines, ``].join("\n"),
    full: `${FULL_HEADER}\n${readmes.join("\n\n---\n\n")}\n`,
    missingSummaries,
    dropped,
  }
}

if (import.meta.main) {
  const { llms, full, missingSummaries, dropped } = await generate()
  await Deno.writeTextFile(new URL("llms.txt", ROOT), llms)
  await Deno.writeTextFile(new URL("llms-full.txt", ROOT), full)
  console.log(`wrote llms.txt (${llms.length} bytes) and llms-full.txt (${full.length} bytes)`)
  console.log(`${dropped.length} type(s) named after a function or class left out`)
  if (Deno.args.includes(`--dropped`)) { for (const name of dropped) console.log(`  ${name}`) }
  if (missingSummaries.length) {
    console.log(`${missingSummaries.length} export(s) without a summary:`)
    for (const name of missingSummaries) console.log(`  ${name}`)
  }
}
