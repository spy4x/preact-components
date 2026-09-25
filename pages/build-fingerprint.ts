/**
 * Fingerprint of every source the pages build reads.
 *
 * `build.ts` writes it beside the artefact, at `dist/.build-hash`; `verify.ts` recomputes it from
 * the working tree before doing anything else — before the static phase reads `dist/`, and before
 * the browser launches — and refuses a `dist/` whose recorded hash is missing or does not match,
 * naming `deno task --cwd pages build` (#280). A build that ran against an older tree, or a
 * `dist/` left over from before a rebase, used to pass every check silently: nothing compared the
 * artefact to the source it claims to be built from.
 *
 * **Split on purpose.** {@link isCovered} (which paths count) and {@link hashEntries} (how a set of
 * `{ path, bytes }` entries becomes one digest) are pure — no file system, so `pages/build-
 * fingerprint.test.ts` exercises them entirely in memory, and the repo-wide `test` task does not
 * need `--allow-write` for one colocated suite. {@link computeBuildFingerprint} is the thin, untested
 * reader that walks the tree and hands what {@link isCovered} accepts to {@link hashEntries}; its own
 * correctness is proven by running `verify` for real (`pages/README.md`'s "Evidence" and this
 * change's PR body), the same way `build.ts` itself is.
 *
 * **What is covered, and why a walk rather than the bundler's own input list.** Every workspace
 * package's source the demo can import (`ui/`, `system/`, `charts/`, …), `pages/` itself — which
 * covers `pages/src` and every other file the build or the browser checks read — the config files
 * that change how a specifier resolves (the root `deno.jsonc`, `deno.lock`, and each package's own
 * `deno.json`, picked up by the walk since it lives inside that package's directory), and the three
 * static fixture directories `build.ts` copies into the artefact verbatim and the browser checks
 * are served from — `pages/sw-demo`, `pages/form-demo`, `pages/map-demo` — covered whole, regardless
 * of extension, since a stale copy of a served file is exactly what #280 is about. `deno bundle`
 * does not expose the module graph it built from, only the emitted bundle, so reading it back out
 * would mean re-parsing the output to recover what went in; a walk of the workspace, filtered by
 * {@link isCovered}, is direct and does not depend on a bundler internal that the pin in
 * `deno.jsonc` could change out from under it.
 */

import { join, relative } from "node:path"

/** File name the hash is written to, inside `dist/`. */
export const BUILD_HASH_FILE = ".build-hash"

/**
 * Workspace member directories the demo can import from — the root `deno.jsonc`'s own
 * `"workspace"` list. Kept as a literal copy rather than read from that file: reading it back would
 * add JSONC parsing to a hot path that runs on every `verify`, for a list that only changes in the
 * same commit as a new package's own `deno.json` (see `AGENTS.md` → "Adding a package") — a commit
 * that touches this file too.
 */
const WORKSPACE_DIRECTORIES = [
  "charts",
  "cn",
  "crud",
  "icons",
  "map",
  "pages",
  "signals",
  "system",
  "theme",
  "ui",
  "ui-guide",
] as const

/** Root files that change how every specifier in the workspace resolves. */
const ROOT_FILES = ["deno.jsonc", "deno.lock"] as const

/**
 * Directories copied into the artefact verbatim and served from it (`build.ts`'s
 * `copyDemoDirectory`) — covered whole, unlike the rest of the tree, since none of their files
 * carry one of {@link INCLUDED_EXTENSIONS} and a stale copy is exactly the bug #280 is about.
 */
const STATIC_FIXTURE_DIRECTORIES = ["pages/sw-demo", "pages/form-demo", "pages/map-demo"] as const

/** Directory names walked past without descending — build output and caches, never a source. */
const IGNORED_DIRECTORY_NAMES = new Set([".git", ".volumes", "coverage", "dist", "node_modules"])

/**
 * Extensions the build actually reads: code, styles, and every package's own config (`deno.json`).
 * Only checked for a path inside a covered workspace directory — the static fixture directories
 * above are covered regardless of extension.
 */
const INCLUDED_EXTENSIONS = [".ts", ".tsx", ".css", ".json", ".jsonc"]

/**
 * Whether a path counts toward the fingerprint — pure, so it is the one thing both the reader below
 * and `pages/build-fingerprint.test.ts` call directly.
 *
 * @param relativePath Repository-relative path, `/`-separated (as `node:path`'s `relative` and
 * `join` produce on the platforms this runs on).
 */
export function isCovered(relativePath: string): boolean {
  const segments = relativePath.split("/")
  if (segments.some((segment) => IGNORED_DIRECTORY_NAMES.has(segment))) return false

  if ((ROOT_FILES as readonly string[]).includes(relativePath)) return true

  const inStaticFixture = STATIC_FIXTURE_DIRECTORIES.some((directory) =>
    relativePath === directory || relativePath.startsWith(`${directory}/`)
  )
  if (inStaticFixture) return true

  const inWorkspaceDirectory = WORKSPACE_DIRECTORIES.some((directory) =>
    relativePath === directory || relativePath.startsWith(`${directory}/`)
  )
  if (!inWorkspaceDirectory) return false

  return INCLUDED_EXTENSIONS.some((extension) => relativePath.endsWith(extension))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Hash a set of `{ path, bytes }` entries — pure, so `pages/build-fingerprint.test.ts` exercises it
 * with in-memory fixtures rather than real files.
 *
 * @param entries Each covered file's repo-relative path and content; order does not matter.
 * @returns A hex SHA-256 digest over each entry's path and content, sorted by path first — same
 * entries in, same digest out, regardless of the order they were given in.
 */
export async function hashEntries(
  entries: readonly { path: string; bytes: Uint8Array }[],
): Promise<string> {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path))

  const manifestLines: string[] = []
  for (const entry of sorted) {
    const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(entry.bytes))
    manifestLines.push(`${entry.path}:${toHex(new Uint8Array(digest))}`)
  }

  const manifestDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(manifestLines.join("\n")),
  )
  return toHex(new Uint8Array(manifestDigest))
}

/** List every file under `directory`, as paths relative to `repoRoot`, pruning ignored directories. */
async function collectRelativePaths(
  directory: string,
  repoRoot: string,
  out: string[],
): Promise<void> {
  for await (const entry of Deno.readDir(directory)) {
    const path = join(directory, entry.name)
    if (entry.isDirectory) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) continue
      await collectRelativePaths(path, repoRoot, out)
    } else if (entry.isFile) {
      out.push(relative(repoRoot, path))
    }
  }
}

/**
 * Hash every source the pages build depends on, deterministically. The thin, untested reader —
 * see this module's own doc for why {@link isCovered} and {@link hashEntries} carry the logic that
 * is actually unit-tested.
 *
 * @param repoRoot Absolute path to the repository root (the directory holding the root
 * `deno.jsonc`).
 * @returns {@link hashEntries} over every file {@link isCovered} accepts.
 */
export async function computeBuildFingerprint(repoRoot: string): Promise<string> {
  const candidates: string[] = []

  for (const directory of WORKSPACE_DIRECTORIES) {
    try {
      await collectRelativePaths(join(repoRoot, directory), repoRoot, candidates)
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
      // A workspace member listed in `deno.jsonc` but not yet created (see that file's own
      // comment on the point) contributes nothing to hash — there is nothing there to read.
    }
  }

  for (const name of ROOT_FILES) {
    try {
      await Deno.stat(join(repoRoot, name))
      candidates.push(name)
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
    }
  }

  const covered = candidates.filter(isCovered)
  const entries = await Promise.all(covered.map(async (path) => ({
    path,
    bytes: await Deno.readFile(join(repoRoot, path)),
  })))

  return hashEntries(entries)
}
