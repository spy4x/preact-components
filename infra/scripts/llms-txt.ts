/**
 * Writes `llms.txt` and `llms-full.txt` at the repository root: plain-text maps of the library for
 * a language model (or a person in a hurry) that has to choose and import a component without
 * opening the source.
 *
 * ```bash
 * deno task llms
 * ```
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
 * - The names come from `readPackages()` in `export-lists.ts`, which imports each package's entry
 *   points: a value export that exists is listed, one that does not is not. Types have no runtime
 *   presence, so they come from reading the entry modules' `export` statements
 *   ({@linkcode resolveModule}), which follow `export * from` and `export { … } from` to the
 *   declaration.
 * - The kind is the declaration's own keyword plus the name: an `interface`, `type` or `enum` is a
 *   `type`; a name starting `use` and a capital is a `hook`; an initial capital followed by a
 *   lower-case letter is a `component` (an `Error` class is a `helper`); an `UPPER_SNAKE` name or a non-function `const` is a
 *   `constant`; anything else is a `helper`.
 * - The summary is the first sentence of the declaration's JSDoc. With none, the first sentence of
 *   the line the package's `README.md` gives that name in backticks (a table row's second cell, or
 *   a list item). With neither, the entry has no summary, and `deno task llms` prints its name so
 *   the gap is visible.
 *   A `FooProps` type with neither is described as "Props of `Foo`."
 * - The import specifier is the package root when the barrel exports the name, else the first
 *   subpath that does.
 *
 * Versions are left out on purpose, so a release does not make the files stale.
 *
 * @module
 */

import { type PackageSurface, readPackages, stripJsonc } from "./export-lists.ts"

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

/** What one exported name is, and where it is declared. */
export interface Declaration {
  /** Absolute file URL of the module that declares it. */
  file: URL
  /** `function`, `const`, `class`, `interface`, `type` or `enum`. */
  keyword: string
}

/** One listed export. */
export interface Entry {
  name: string
  kind: "component" | "hook" | "helper" | "type" | "constant"
  /** One sentence, or an empty string when neither JSDoc nor README gives one. */
  summary: string
  /** Import specifier, for example `@spy4x/preact-ui/badge`. */
  specifier: string
}

/** Replaces every comment character with a space, keeping newlines, so offsets stay valid. */
function maskComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, " "))
}

const DECLARATION =
  /export\s+(?:declare\s+)?(?:abstract\s+)?(async\s+function\*?|function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
const REEXPORT_ALL = /export\s+\*\s+from\s+["']([^"']+)["']/g
const NAMED_EXPORT = /export\s+(?:type\s+)?\{([^}]*)\}(?:\s+from\s+["']([^"']+)["'])?/g

/**
 * Every name a module exports, with the module and keyword that declare it.
 *
 * Follows `export * from "./x"`, `export { a, type B as C } from "./x"` and a local
 * `export { a }`. Import paths must be relative and carry their extension, as they do in this
 * repository.
 *
 * @param file Module to read.
 * @returns Exported name to its declaration.
 */
export async function resolveModule(file: URL): Promise<Map<string, Declaration>> {
  const source = maskComments(await Deno.readTextFile(file))
  const found = new Map<string, Declaration>()

  for (const match of source.matchAll(DECLARATION)) {
    found.set(match[2], { file, keyword: match[1].replace(/^async\s+/, "").replace(/\*$/, "") })
  }
  for (const match of source.matchAll(REEXPORT_ALL)) {
    for (const [name, declaration] of await resolveModule(new URL(match[1], file))) {
      if (name !== "default") found.set(name, declaration)
    }
  }
  for (const match of source.matchAll(NAMED_EXPORT)) {
    const from = match[2] ? await resolveModule(new URL(match[2], file)) : found
    for (const part of match[1].split(",")) {
      const specifier = part.trim().replace(/^type\s+/, "")
      if (!specifier) continue
      const [original, alias = original] = specifier.split(/\s+as\s+/).map((s) => s.trim())
      // A name imported from another package and exported again has no declaration here; it is
      // listed as a function (or a component, by its name) with no JSDoc to read.
      const imported = !match[2] && new RegExp(`import[^;]*\\b${original}\\b[^;]*from`).test(source)
      const declaration = from.get(original) ??
        (imported ? { file, keyword: `function` } : undefined)
      if (declaration) found.set(alias, declaration)
    }
  }
  return found
}

/**
 * The first sentence of the JSDoc block directly above a declaration.
 *
 * @param text The declaring module's source.
 * @param name The declared name.
 * @returns The sentence with its line breaks joined, or an empty string when there is no JSDoc.
 */
export function jsdocSummary(text: string, name: string): string {
  const masked = maskComments(text)
  const pattern = new RegExp(
    `export\\s+(?:declare\\s+)?(?:abstract\\s+)?(?:async\\s+function\\*?|function\\*?|const|let|class|interface|type|enum)\\s+${
      name.replace(/\$/g, "\\$")
    }(?![\\w$])`,
  )
  const at = masked.search(pattern)
  if (at < 0) return ""
  const before = text.slice(0, at)
  const block = before.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/)
  if (!block) return ""
  const body = block[1].split("\n").map((line) => line.replace(/^\s*\*? ?/, "")).join("\n")
  const description = body.split(/\n\s*@\w/)[0]
  return firstSentence(description)
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

/**
 * The summary a package README gives a name: the second cell of a table row whose first cell holds
 * the name in backticks, or the text of a list item that starts with it.
 *
 * @param readme Package README text.
 * @param name Exported name.
 * @returns The first sentence, or an empty string.
 */
export function readmeSummary(readme: string, name: string): string {
  const mark = (cell: string) =>
    new RegExp(`\`${name.replace(/\$/g, "\\$")}(?:\\(.*?\\))?\``)
      .test(cell)
  for (const line of readme.split("\n")) {
    if (line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
      if (cells.length >= 2 && mark(cells[0])) {
        const text = cells.slice(1).find((cell) =>
          /[A-Za-z]{3}/.test(cell) && !/^`[^`]*`$/.test(cell)
        )
        if (text) return firstSentence(text)
      }
    }
    const item = line.match(/^\s*[-*]\s+(?:\*\*)?(`[^`]+`[^\n]*)/)
    if (item && mark(item[1].split(/[—:-]/)[0])) {
      return firstSentence(item[1].replace(/^`[^`]+`(?:\*\*)?\s*[—:-]*\s*/, ""))
    }
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
  if (["interface", "type", "enum"].includes(keyword)) return "type"
  if (/^use[A-Z]/.test(name)) return "hook"
  if (keyword === "class" && /Error$/.test(name)) return "helper"
  if (/^[A-Z][a-z]/.test(name) || /^[A-Z][a-zA-Z0-9]*$/.test(name) && /[a-z]/.test(name)) {
    return "component"
  }
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return "constant"
  if (keyword === "const" && !/^[a-z]/.test(name)) return "constant"
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

/** What {@linkcode buildEntries} needs to know about one package. */
interface PackageInput {
  id: string
  surface: PackageSurface
  readme: string
}

/**
 * Lists one package's exports, values and types, each with its kind, summary and specifier.
 *
 * @param input The package's directory name, runtime surface and README.
 * @returns Entries in the order the package's entry points declare them: the barrel first.
 * @throws When a value export the package really has cannot be found in its sources.
 */
export async function buildEntries(input: PackageInput): Promise<Entry[]> {
  const { id, surface, readme } = input
  const config = JSON.parse(stripJsonc(await Deno.readTextFile(new URL(`${id}/deno.json`, ROOT))))
  const pkg = config.name as string
  const entries = new Map<string, Entry>()
  const sources = new Map<string, string>()

  for (const [key, target] of Object.entries(config.exports as Record<string, string>)) {
    if (!/\.tsx?$/.test(target)) continue
    const specifier = key === "." ? pkg : `${pkg}/${key.replace(/^\.\//, "")}`
    const module = new URL(`${id}/${target}`, ROOT)
    for (const [name, declaration] of await resolveModule(module)) {
      if (entries.has(name)) continue
      const path = declaration.file.href
      if (!sources.has(path)) sources.set(path, await Deno.readTextFile(declaration.file))
      let summary = jsdocSummary(sources.get(path)!, name) || readmeSummary(readme, name)
      // A props type with no JSDoc of its own is described by the component it belongs to.
      if (!summary && /^[A-Z]\w*Props$/.test(name) && declaration.keyword !== `function`) {
        summary = `Props of \`${name.slice(0, -5)}\`.`
      }
      entries.set(name, { name, kind: kindOf(name, declaration.keyword), summary, specifier })
    }
  }

  for (const name of surface.names) {
    if (!entries.has(name)) {
      throw new Error(`${pkg} exports \`${name}\` but no source declaration was found for it`)
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

  for (const [id, surface] of Object.entries(packages)) {
    const config = JSON.parse(stripJsonc(await Deno.readTextFile(new URL(`${id}/deno.json`, ROOT))))
    const readme = await Deno.readTextFile(new URL(`${id}/README.md`, ROOT)).catch(() => "")
    const entries = await buildEntries({ id, surface, readme })
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
