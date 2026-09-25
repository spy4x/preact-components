/**
 * Whole-word, case-insensitive search for private application names across every file each
 * published package's `deno publish --dry-run` would upload to JSR.
 *
 * Takes the path to a names file as its only argument — one name per line, blank lines and
 * `#`-comments ignored — and never embeds a name anywhere in this script: the list stays outside
 * the repository (see `docs/pre-publish-checks.md`) and this file reads it fresh on every run.
 *
 * For each published package, in turn:
 *
 * 1. runs `deno publish --dry-run --allow-dirty` from that package's directory and parses the
 *    `file://…` lines it prints, which is exactly the set of files that command would upload;
 * 2. reads each of those files as text and checks every line against every name, at a word
 *    boundary so a short name cannot match inside a longer word;
 * 3. prints every hit as `path/to/file:line`.
 *
 * Case-insensitive: a capitalised mention (an application named mid-sentence, or at the start of
 * one) is exactly the kind of leak this check exists to catch, so ignoring case would miss it.
 * The boundary treats a hyphen as part of a word, alongside letters, digits and underscore, rather
 * than as a separator — the same rule `deno fmt`'s own kebab-case file names imply. That is what
 * keeps a short name from matching inside an unrelated hyphenated token such as the locale code
 * `en-GB`, while a hyphenated name (`widget-tracker`, invented for this example) still matches as
 * one whole word: the boundary sits outside it, not at the hyphen in the middle.
 *
 * This is a check meant to run unattended before a publish, so a broken input fails loudly instead
 * of quietly reporting nothing to worry about: a names file that turns out to hold no names (it is
 * empty, missing, or every line is a `#`-comment), a package whose dry run lists zero files (a sign
 * something about the dry run itself broke, not that there is nothing to check), and any error
 * reading a listed file all abort the run with a clear message and a non-zero exit, rather than
 * being silently skipped or surfacing as a raw stack trace.
 *
 * Exits non-zero if any package has a match, zero otherwise. Run it before every release tag is
 * pushed:
 *
 * ```bash
 * deno task private-names /path/to/names.txt
 * ```
 */

import { fromFileUrl } from "@std/path"

const ROOT = fromFileUrl(new URL("../../", import.meta.url))

/**
 * Every published workspace member, in the order `deno publish --dry-run` runs them.
 *
 * Hand-kept rather than read from `deno.jsonc`'s `workspace` array: that array also lists
 * `pages/`, the GitHub Pages demo, which carries no package `name` and `deno publish` never
 * touches — see `AGENTS.md` → "Adding a package". A new package joins this list in the same
 * change that adds its own `deno.json`, the same moment it joins the workspace array.
 * `private-names.test.ts` compares this list with every top-level directory whose `deno.json` has
 * a `name`, so a package left out fails `deno task test` rather than going unchecked.
 */
export const PUBLISHED_PACKAGES: readonly string[] = [
  "cn",
  "icons",
  "signals",
  "theme",
  "charts",
  "system",
  "ui",
  "crud",
  "map",
  "ui-guide",
]

/** Strip ANSI colour codes from `deno publish`'s output so the file list parses cleanly. */
function stripAnsi(text: string): string {
  // deno-lint-ignore no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "")
}

/** Parse the `file://…` paths out of `deno publish --dry-run`'s (ANSI-stripped) output. */
export function parseDryRunFiles(output: string): string[] {
  return [...output.matchAll(/file:\/\/(\S+)/g)].map((match) => match[1])
}

/**
 * Throws unless `files` is non-empty. `deno publish` always uploads at least the package's own
 * `deno.json`, so an empty list means the dry run did not run where expected (a bad `root`, an
 * empty or missing package directory, an `exclude` pattern that swallowed everything) rather than
 * that the package has nothing to check.
 */
export function assertFilesFound(files: readonly string[], pkg: string, root: string): void {
  if (files.length === 0) {
    throw new Error(
      `deno publish --dry-run for ${pkg} listed zero files — expected at least its deno.json; ` +
        `is ${root}${pkg} the right package directory?`,
    )
  }
}

/**
 * The absolute paths `deno publish --dry-run` would upload for one package.
 *
 * Throws if the dry run itself fails, or if it succeeds but lists zero files — see
 * {@linkcode assertFilesFound}.
 */
export async function publishedFiles(pkg: string, root: string = ROOT): Promise<string[]> {
  const command = new Deno.Command("deno", {
    args: ["publish", "--dry-run", "--allow-dirty"],
    cwd: `${root}${pkg}`,
    stdout: "piped",
    stderr: "piped",
  })
  const { stdout, stderr, success, code } = await command.output()
  const output = stripAnsi(new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr))
  if (!success) {
    throw new Error(`deno publish --dry-run failed for ${pkg} (exit ${code}):\n${output}`)
  }
  const files = parseDryRunFiles(output)
  assertFilesFound(files, pkg, root)
  return files
}

/**
 * Parse names file text into names, one per line, blank lines and `#`-comments ignored.
 *
 * Throws when the text holds no names — an empty file or one that is only `#`-comments is far
 * more likely a mistake (the wrong path, an accidentally cleared list) than a deliberate
 * "nothing to check", and a check that quietly reports zero matches either way cannot tell the
 * two apart for the person reading its output.
 */
export function parseNames(text: string): string[] {
  const names = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
  if (names.length === 0) {
    throw new Error("names file has no names — only blank lines or comments")
  }
  return names
}

/**
 * Read the names file: one name per line, blank lines and `#`-comments ignored.
 *
 * Throws a clear error, rather than letting a raw stack trace through, when the file does not
 * exist, and again — via {@linkcode parseNames} — when it exists but holds no names.
 */
export async function readNames(path: string): Promise<string[]> {
  let text: string
  try {
    text = await Deno.readTextFile(path)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`names file not found: ${path}`)
    }
    throw error
  }
  try {
    return parseNames(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${reason}: ${path}`)
  }
}

/**
 * A single alternation, case-insensitive, matching any of `names` at a word boundary that treats a
 * hyphen as a word character — so the boundary sits outside a hyphenated name, not inside it.
 */
export function wordBoundaryPattern(names: readonly string[]): RegExp {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const wordOrHyphen = "[A-Za-z0-9_-]"
  return new RegExp(
    `(?<!${wordOrHyphen})(?:${escaped.join("|")})(?!${wordOrHyphen})`,
    "i",
  )
}

/** 1-based line numbers in `text` that contain one of `names` at a word boundary. */
export function matchLines(text: string, names: readonly string[]): number[] {
  if (names.length === 0) return []
  const pattern = wordBoundaryPattern(names)
  const lines = text.split("\n")
  const hits: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) hits.push(i + 1)
  }
  return hits
}

/**
 * Read one file and report the 1-based lines it matches on.
 *
 * A failure to read a listed file — permission denied, the path turning out to be a directory, it
 * having been removed between the dry run and this read — is not "not a text file, skip it": it is
 * a reason to distrust the whole run, so it is wrapped with which file it was and re-thrown rather
 * than swallowed.
 */
export async function readAndMatch(file: string, names: readonly string[]): Promise<number[]> {
  let text: string
  try {
    text = await Deno.readTextFile(file)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`could not read ${file}: ${reason}`)
  }
  return matchLines(text, names)
}

function relative(path: string, root: string = ROOT): string {
  return path.startsWith(root) ? path.slice(root.length) : path
}

async function main(): Promise<void> {
  const namesPath = Deno.args[0]
  if (!namesPath) {
    throw new Error("usage: private-names.ts <path-to-names-file>")
  }

  const names = await readNames(namesPath)
  let totalMatches = 0

  for (const pkg of PUBLISHED_PACKAGES) {
    const files = await publishedFiles(pkg)
    let packageMatches = 0
    for (const file of files) {
      for (const line of await readAndMatch(file, names)) {
        console.log(`${relative(file)}:${line}`)
        packageMatches++
      }
    }
    console.log(`  ${pkg}: ${packageMatches} match(es) in ${files.length} published file(s)`)
    totalMatches += packageMatches
  }

  console.log(totalMatches ? `\n${totalMatches} match(es) found` : "\nno matches")
  if (totalMatches > 0) Deno.exit(1)
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`private-names: ${reason}`)
    Deno.exit(reason.startsWith("usage:") ? 2 : 1)
  }
}
