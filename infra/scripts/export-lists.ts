/**
 * Compares the names the docs list for each package with the names the package really exports.
 *
 * Three places list a package's contents, and each has drifted from the code before (#127): they
 * named components that were never built, put a component under the wrong package, and missed
 * whole modules. This script reads the exports from the packages themselves and reports every name
 * a document lists that the package does not export, in three places:
 *
 * 1. the "Package layout" table in `AGENTS.md` and the "Scope" table in `README.md` — a summary,
 *    one row per package. Every name written in backticks in a row must be a value export or a
 *    subpath of that package, and every published package needs a row. A summary may stop at
 *    "and the rest", so it is not required to name everything;
 * 2. the `deno add` lines in `README.md`'s Install section — one line per published package, and
 *    no line for a package that does not exist;
 * 3. the "Components" table of each catalogued package's own README — the complete list. Its
 *    first column must name exactly the package's component-named exports, no more and no fewer,
 *    and where the second column names a subpath, that subpath must export the component.
 *
 * "Component-named" is the catalogue's own rule (`ui-guide/coverage.ts`): an initial capital and a
 * lower-case letter somewhere after it. The catalogued packages are the ones the guide gives cards
 * to; `icons/` is left out on purpose, because its 119 glyphs are listed by the guide's gallery,
 * which reads them from the module.
 *
 * `export-lists.test.ts` runs this against the real tree, so `deno task check` fails on any drift.
 * Run it by hand for the list of problems:
 *
 * ```bash
 * deno run --allow-read infra/scripts/export-lists.ts
 * ```
 */

const ROOT = new URL("../../", import.meta.url)

/** Packages whose README must carry a complete "Components" table. */
export const CATALOGUED = ["charts", "crud", "map", "system", "ui"] as const

/** What one published package exports, as read from its modules. */
export interface PackageSurface {
  /** Every value export, from the barrel and every subpath module. */
  names: string[]
  /** Each subpath (`avatar` for `./avatar`) and the value exports of its module. */
  subpaths: Record<string, string[]>
}

/** The documents this script reads, as text. */
export interface Docs {
  agents: string
  readme: string
  /** Each package's `README.md`, keyed by package directory. */
  packageReadmes: Record<string, string>
}

/**
 * Whether a value export is named the way a component is: the rule `ui-guide/coverage.ts` applies.
 *
 * @param name Value export name.
 * @returns `true` for `D3LineChart` or `Map`; `false` for `cn` or `DEFAULT_AXIS_COLOR`.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && /[a-z]/.test(name)
}

/**
 * Removes `//` and `/* *\/` comments and trailing commas from a `deno.json`, so `JSON.parse` reads it.
 *
 * Strings are kept whole, so a `//` inside one survives. This covers the JSONC every config in this
 * repository uses; it is not a general parser.
 *
 * @param text JSONC source.
 * @returns Plain JSON.
 */
export function stripJsonc(text: string): string {
  return text
    .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_match, str) => str ?? "")
    .replace(/,(\s*[}\]])/g, "$1")
}

/**
 * The rows of every Markdown table under one heading, up to the next heading of the same level.
 *
 * @param markdown Document text.
 * @param heading Heading line exactly as written, such as `## Components`.
 * @returns Each body row as its trimmed cells; header and separator rows left out. Empty when the
 *   heading is missing.
 */
export function tableRows(markdown: string, heading: string): string[][] {
  const lines = markdown.split("\n")
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []

  const level = heading.match(/^#+/)?.[0] ?? "##"
  const rows: string[][] = []
  let header = true
  for (const line of lines.slice(start + 1)) {
    if (new RegExp(`^#{1,${level.length}} `).test(line)) break
    if (!line.startsWith("|")) {
      header = true
      continue
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    if (header) {
      header = !cells.every((cell) => /^:?-+:?$/.test(cell))
      continue
    }
    rows.push(cells)
  }
  return rows
}

/**
 * Every name written in backticks in a cell, with a trailing `()` removed.
 *
 * @param cell Table cell text.
 * @returns The names in order of appearance.
 */
export function backticked(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1].replace(/\(\)$/, ""))
}

/**
 * Every way the docs disagree with the packages, one message per problem.
 *
 * Both inputs are parameters so the test can drive the rule with a document or an export list the
 * real tree does not have: in a healthy tree everything agrees, and a check that can only be run
 * against agreement proves nothing.
 *
 * @param docs The documents to compare.
 * @param packages Each published package's exports, keyed by package directory.
 * @returns One message per problem; empty when the docs and the exports agree.
 */
export function exportListProblems(
  docs: Docs,
  packages: Record<string, PackageSurface>,
): string[] {
  const problems: string[] = []
  const known = (id: string, name: string) =>
    packages[id].names.includes(name) || name in packages[id].subpaths

  const summaries = [
    { file: "AGENTS.md", rows: tableRows(docs.agents, "## Package layout") },
    { file: "README.md", rows: tableRows(docs.readme, "## Scope") },
  ]
  for (const { file, rows } of summaries) {
    const seen = new Set<string>()
    for (const [directory, contents = ""] of rows) {
      const id = directory.replace(/^`|\/`$/g, "")
      if (!(id in packages)) continue
      seen.add(id)
      for (const name of backticked(contents)) {
        if (!known(id, name)) {
          problems.push(`${file} lists \`${name}\` under ${id}/, which ${id} does not export`)
        }
      }
    }
    for (const id of Object.keys(packages)) {
      if (!seen.has(id)) problems.push(`${file} has no row for the published package ${id}/`)
    }
  }

  const installed = new Set(
    [...docs.readme.matchAll(/^deno add jsr:@preact-components\/([a-z-]+)/gm)].map((m) => m[1]),
  )
  for (const id of installed) {
    if (!(id in packages)) problems.push(`README.md installs ${id}, which is not a package`)
  }
  for (const id of Object.keys(packages)) {
    if (!installed.has(id)) problems.push(`README.md has no \`deno add\` line for ${id}`)
  }

  for (const id of CATALOGUED) {
    const rows = tableRows(docs.packageReadmes[id] ?? "", "## Components")
    if (rows.length === 0) {
      problems.push(`${id}/README.md has no "## Components" table`)
      continue
    }
    const listed = new Set<string>()
    for (const [first = "", second = ""] of rows) {
      const [name] = backticked(first)
      if (!name) continue
      listed.add(name)
      const [subpath] = backticked(second)
      if (subpath && !(packages[id].subpaths[subpath] ?? []).includes(name)) {
        problems.push(`${id}/README.md says \`${subpath}\` exports \`${name}\`, and it does not`)
      }
    }
    const components = packages[id].names.filter(isComponentName)
    for (const name of listed) {
      if (!components.includes(name)) {
        problems.push(
          `${id}/README.md lists the component \`${name}\`, which ${id} does not export`,
        )
      }
    }
    for (const name of components) {
      if (!listed.has(name)) {
        problems.push(
          `${id} exports the component \`${name}\`, and ${id}/README.md does not list it`,
        )
      }
    }
  }

  return problems
}

/**
 * Reads every published package's exports from its modules: the barrel and every subpath.
 *
 * A published package is a workspace member whose `deno.json` has a `name`; `pages/` has none.
 *
 * @returns Each published package's surface, keyed by package directory.
 * @throws When a package declares no `exports` object.
 */
export async function readPackages(): Promise<Record<string, PackageSurface>> {
  const root = JSON.parse(stripJsonc(await Deno.readTextFile(new URL("deno.jsonc", ROOT))))
  const packages: Record<string, PackageSurface> = {}
  for (const member of root.workspace as string[]) {
    const id = member.replace(/^\.\//, "")
    const config = JSON.parse(stripJsonc(await Deno.readTextFile(new URL(`${id}/deno.json`, ROOT))))
    if (!config.name) continue
    if (typeof config.exports !== "object" || config.exports === null) {
      throw new Error(`${id}/deno.json declares no exports object`)
    }

    const names = new Set<string>()
    const subpaths: Record<string, string[]> = {}
    for (const [key, target] of Object.entries(config.exports as Record<string, string>)) {
      if (!/\.tsx?$/.test(target)) continue
      const exported = Object.keys(await import(new URL(`${id}/${target}`, ROOT).href))
      for (const name of exported) names.add(name)
      if (key !== ".") subpaths[key.replace(/^\.\//, "")] = exported
    }
    packages[id] = { names: [...names], subpaths }
  }
  return packages
}

/**
 * Reads `AGENTS.md`, `README.md` and every published package's `README.md`.
 *
 * @param ids Package directories whose README to read.
 * @returns The documents as text; a package with no README reads as empty.
 */
export async function readDocs(ids: string[]): Promise<Docs> {
  const read = (path: string) => Deno.readTextFile(new URL(path, ROOT)).catch(() => "")
  const packageReadmes: Record<string, string> = {}
  for (const id of ids) packageReadmes[id] = await read(`${id}/README.md`)
  return { agents: await read("AGENTS.md"), readme: await read("README.md"), packageReadmes }
}

if (import.meta.main) {
  const packages = await readPackages()
  const problems = exportListProblems(await readDocs(Object.keys(packages)), packages)
  for (const problem of problems) console.error(problem)
  console.log(
    problems.length
      ? `${problems.length} problem(s)`
      : `docs agree with the exports of ${Object.keys(packages).length} packages`,
  )
  if (problems.length) Deno.exit(1)
}
