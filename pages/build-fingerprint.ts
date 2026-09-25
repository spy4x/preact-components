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
 * **What is covered, and why a walk rather than the bundler's own input list.** Every workspace
 * package's source the demo can import (`ui/`, `system/`, `charts/`, …), `pages/` itself — which
 * covers `pages/src` and every other file the build or the browser checks read — and the config
 * files that change how a specifier resolves: the root `deno.jsonc`, `deno.lock`, and each
 * package's own `deno.json`, picked up by the walk since it lives inside that package's directory.
 * `deno bundle` does not expose the module graph it built from, only the emitted bundle, so
 * reading it back out would mean re-parsing the output to recover what went in; a walk of the
 * workspace, filtered to the extensions the build actually reads, is direct and does not depend on
 * a bundler internal that the pin in `deno.jsonc` could change out from under it.
 *
 * **What is deliberately left out.** `pages/sw-demo`, `pages/form-demo` and `pages/map-demo` are
 * copied into the artefact verbatim (see `build.ts`'s `copyDemoDirectory`), but their files are
 * `.js`, `.html` and `.png` — outside the extensions this module hashes — so a change to one of
 * them will not by itself mark a build stale. Those directories are fixed demo fixtures that change
 * far less often than a component's source; catching a change there is a narrower win than keeping
 * every hashed run fast, and revisiting it is cheap: add their extensions to
 * {@link INCLUDED_EXTENSIONS} if that trade stops holding.
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

/** Directories walked past without descending — build output and caches, never a source. */
const IGNORED_DIRECTORIES = new Set([".git", ".volumes", "coverage", "dist", "node_modules"])

/**
 * Extensions the build actually reads: code, styles, and every package's own config (`deno.json`).
 * A `.md` file, or anything else outside this list, never changes the fingerprint.
 */
const INCLUDED_EXTENSIONS = [".ts", ".tsx", ".css", ".json", ".jsonc"]

function isIncluded(name: string): boolean {
  return INCLUDED_EXTENSIONS.some((extension) => name.endsWith(extension))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function collectFiles(directory: string, out: string[]): Promise<void> {
  for await (const entry of Deno.readDir(directory)) {
    const path = join(directory, entry.name)
    if (entry.isDirectory) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue
      await collectFiles(path, out)
    } else if (entry.isFile && isIncluded(entry.name)) {
      out.push(path)
    }
  }
}

/**
 * Hash every source the pages build depends on, deterministically.
 *
 * @param repoRoot Absolute path to the repository root (the directory holding the root
 * `deno.jsonc`).
 * @returns A hex SHA-256 digest over each covered file's repo-relative path and content, sorted by
 * path so the result does not depend on directory-walk order — same tree in, same digest out, on
 * any machine.
 */
export async function computeBuildFingerprint(repoRoot: string): Promise<string> {
  const files: string[] = []

  for (const directory of WORKSPACE_DIRECTORIES) {
    try {
      await collectFiles(join(repoRoot, directory), files)
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
      // A workspace member listed in `deno.jsonc` but not yet created (see that file's own
      // comment on the point) contributes nothing to hash — there is nothing there to read.
    }
  }

  for (const name of ROOT_FILES) {
    const path = join(repoRoot, name)
    try {
      await Deno.stat(path)
      files.push(path)
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
    }
  }

  files.sort()

  const manifestLines: string[] = []
  for (const path of files) {
    const bytes = await Deno.readFile(path)
    const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))
    manifestLines.push(`${relative(repoRoot, path)}:${toHex(new Uint8Array(digest))}`)
  }

  const manifestDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(manifestLines.join("\n")),
  )
  return toHex(new Uint8Array(manifestDigest))
}
