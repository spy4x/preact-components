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
 * **Shape** (another repository can copy it; nothing here is specific to this one but the
 * constants in {@linkcode HEADER}):
 *
 * - `llms.txt` starts with a header — what the library is, when to use it, how to install a
 *   package and where exact signatures come from (`deno doc jsr:@spy4x/preact-<pkg>`) — then has
 *   one section per published package. A section has the package's one-paragraph description, the
 *   install line, and one line per export:
 *   `` - `Name` (kind): one-sentence summary. Import: `@spy4x/preact-pkg/subpath` ``.
 * - `llms-full.txt` is the same header followed by every published package's `README.md`, in the
 *   same order.
 *
 * **Where each fact comes from.**
 *
 * - The names of value exports come from `readPackages()` in `export-lists.ts`, which imports each
 *   package's entry points; one with no declaration in the docs makes the script throw. Types, kinds
 *   and JSDoc come from `deno doc --json` over the entry points ({@linkcode denoDoc}), which
 *   follows every re-export, across packages too.
 * - The kind is the declaration's own kind plus the name: an `interface`, type alias or `enum` is a
 *   `type`; a name starting `use` and a capital is a `hook`; an initial capital followed by a
 *   lower-case letter is a `component` (an `Error` class is a `helper`); an `UPPER_SNAKE` name or a
 *   non-function variable is a `constant`; anything else is a `helper`.
 * - The summary is the first sentence of the declaration's JSDoc. With none, the sentence in the
 *   package README's table row for that name, but only in a column headed like a description
 *   ("What it is", "Summary"): a props or migration table would give a wrong one. A `FooProps` type
 *   with neither is described as "Props of `Foo`." With none of these the entry has no summary, and
 *   `deno task llms` prints its name so the gap is visible.
 * - The import specifier is the package root when the barrel exports the name, else the first
 *   subpath that does.
 *
 * Versions are left out on purpose, so a release does not make the files stale.
 *
 * @module
 */

import { readPackages, stripJsonc } from "./export-lists.ts"

const ROOT = new URL("../../", import.meta.url)

/** Public address of the demo site, which serves both files at its root. */
export const SITE = `https://spy4x.github.io/preact-components`

/** The text both files start with. */
export const HEADER = `# preact-components

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
}

/** The part of `deno doc --json` output this script reads: one symbol of one entry point. */
export interface DocSymbol {
  name: string
  declarations: {
    /** `interface`, `typeAlias`, `enum`, `function`, `class`, `variable` or `reference`. */
    kind: string
    /** `export` for a public name; `private` for a type an exported one extends. */
    declarationKind?: string
    jsDoc?: { doc?: string }
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
 * The kind of an export, from its declaration keyword and its name.
 *
 * @param name Exported name.
 * @param keyword Declaration keyword.
 * @returns One of the five kinds the files use.
 */
export function kindOf(name: string, keyword: string): Entry["kind"] {
  if (["interface", "typeAlias", "enum"].includes(keyword)) return "type"
  if (/^use[A-Z]/.test(name)) return "hook"
  if (keyword === "class" && /Error$/.test(name)) return "helper"
  if (/^[A-Z][a-z]/.test(name) || /^[A-Z][a-zA-Z0-9]*$/.test(name) && /[a-z]/.test(name)) {
    return "component"
  }
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return "constant"
  if (keyword === "variable" && !/^[a-z]/.test(name)) return "constant"
  return "helper"
}

/** A package's description: the first paragraph after its README's title. */
export function packageDescription(readme: string): string {
  const paragraphs = readme.split(/\n\s*\n/).map((p) => p.trim())
  const paragraph = paragraphs.find((p) =>
    p && !p.startsWith("#") && !p.startsWith("```") &&
    !p.startsWith("<") && !p.startsWith("|") && !p.startsWith("[![")
  )
  return (paragraph ?? "").replace(/\s+/g, " ")
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
 * @param valueNames Every value export the package really has, from `readPackages()`.
 * @param readme The package README.
 * @param pkg The package name, for the error message.
 * @param index {@linkcode declarationIndex} over every package's symbols.
 * @returns The entries.
 * @throws When a value export has no declaration.
 */
export function buildEntries(
  entryPoints: DocEntryPoint[],
  valueNames: string[],
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
      entries.set(name, { name, kind: kindOf(name, declaration.kind), summary, specifier })
    }
  }

  for (const name of valueNames) {
    if (!entries.has(name)) {
      throw new Error(`${pkg} exports \`${name}\` but no declaration was found for it`)
    }
  }
  return [...entries.values()]
}

/** One line of `llms.txt`. */
function entryLine(entry: Entry): string {
  const summary = entry.summary ? ` ${entry.summary}` : ""
  return `- \`${entry.name}\` (${entry.kind}):${summary} Import: \`${entry.specifier}\``
}

/** Both generated files, and the entries that have no summary. */
export interface Generated {
  llms: string
  full: string
  /** `package: Name` for every export with neither JSDoc nor README summary. */
  missingSummaries: string[]
}

/**
 * Builds the text of both files from the repository as it is now.
 *
 * @returns The two files and the names that lack a summary.
 */
export async function generate(): Promise<Generated> {
  const packages = await readPackages()
  const sections: string[] = []
  const readmes: string[] = []
  const missingSummaries: string[] = []

  const configs: Record<string, { name: string; exports: Record<string, string> }> = {}
  const files: URL[] = []
  for (const id of Object.keys(packages)) {
    configs[id] = JSON.parse(stripJsonc(await Deno.readTextFile(new URL(`${id}/deno.json`, ROOT))))
    for (const target of Object.values(configs[id].exports)) {
      if (/\.tsx?$/.test(target)) files.push(new URL(`${id}/${target}`, ROOT))
    }
  }
  const symbols = await denoDoc(files)
  const index = declarationIndex(symbols.values())

  for (const [id, surface] of Object.entries(packages)) {
    const config = configs[id]
    const readme = await Deno.readTextFile(new URL(`${id}/README.md`, ROOT)).catch(() => "")
    const entryPoints: DocEntryPoint[] = []
    for (const [key, target] of Object.entries(config.exports)) {
      if (!/\.tsx?$/.test(target)) continue
      entryPoints.push({
        specifier: key === "." ? config.name : `${config.name}/${key.replace(/^\.\//, "")}`,
        symbols: symbols.get(new URL(`${id}/${target}`, ROOT).href) ?? [],
      })
    }
    const entries = buildEntries(entryPoints, surface.names, readme, config.name, index)
    for (const entry of entries) {
      if (!entry.summary) missingSummaries.push(`${config.name}: ${entry.name}`)
    }
    sections.push(
      [
        `## ${config.name}`,
        "",
        packageDescription(readme),
        "",
        `Install: \`deno add jsr:${config.name}\``,
        "",
        ...entries.map(entryLine),
      ].join("\n"),
    )
    readmes.push(`<!-- ${config.name} — ${id}/README.md -->\n\n${readme.trim()}`)
  }

  return {
    llms: `${HEADER}\n${sections.join("\n\n")}\n`,
    full: `${HEADER}\n${readmes.join("\n\n---\n\n")}\n`,
    missingSummaries,
  }
}

if (import.meta.main) {
  const { llms, full, missingSummaries } = await generate()
  await Deno.writeTextFile(new URL("llms.txt", ROOT), llms)
  await Deno.writeTextFile(new URL("llms-full.txt", ROOT), full)
  console.log(`wrote llms.txt (${llms.length} bytes) and llms-full.txt (${full.length} bytes)`)
  if (missingSummaries.length) {
    console.log(`${missingSummaries.length} export(s) without a summary:`)
    for (const name of missingSummaries) console.log(`  ${name}`)
  }
}
