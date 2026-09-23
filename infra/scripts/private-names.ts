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
 * `en-GB`, while a hyphenated name (`warthunder-stats`) still matches as one whole word: the
 * boundary sits outside it, not at the hyphen in the middle.
 *
 * Exits non-zero if any package has a match, zero otherwise. Run it before every `deno publish`:
 *
 * ```bash
 * deno task private-names /path/to/names.txt
 * ```
 */

const ROOT = new URL("../../", import.meta.url).pathname

/**
 * Every published workspace member, in the order `deno publish --dry-run` runs them.
 *
 * Hand-kept rather than read from `deno.jsonc`'s `workspace` array: that array also lists
 * `pages/`, the GitHub Pages demo, which carries no package `name` and `deno publish` never
 * touches — see `AGENTS.md` → "Adding a package". A new package joins this list in the same
 * change that adds its own `deno.json`, the same moment it joins the workspace array.
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
  "ui-guide",
]

/** Strip ANSI colour codes from `deno publish`'s output so the file list parses cleanly. */
function stripAnsi(text: string): string {
  // deno-lint-ignore no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "")
}

/** The absolute paths `deno publish --dry-run` would upload for one package. */
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
  return [...output.matchAll(/file:\/\/(\S+)/g)].map((match) => match[1])
}

/** Read the names file: one name per line, blank lines and `#`-comments ignored. */
export async function readNames(path: string): Promise<string[]> {
  const text = await Deno.readTextFile(path)
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
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

function relative(path: string, root: string = ROOT): string {
  return path.startsWith(root) ? path.slice(root.length) : path
}

if (import.meta.main) {
  const namesPath = Deno.args[0]
  if (!namesPath) {
    console.error("usage: private-names.ts <path-to-names-file>")
    Deno.exit(2)
  }

  const names = await readNames(namesPath)
  let totalMatches = 0

  for (const pkg of PUBLISHED_PACKAGES) {
    const files = await publishedFiles(pkg)
    let packageMatches = 0
    for (const file of files) {
      const text = await Deno.readTextFile(file).catch(() => undefined)
      if (text === undefined) continue // not a text file; nothing to scan
      for (const line of matchLines(text, names)) {
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
