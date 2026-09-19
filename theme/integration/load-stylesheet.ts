/**
 * Stylesheet loading for the Tailwind 4 compiler.
 *
 * Tailwind's `compile()` runs inside a host build tool that is expected to read
 * `@import`ed files for it. This module is that reader in plain Deno, so
 * `smoke.test.ts` can compile the shipped CSS without a Vite or PostCSS
 * toolchain and without a local `node_modules` directory.
 *
 * It is a test helper, not part of the package's public surface: `deno.json`
 * exports the stylesheets and nothing else.
 */

import { basename, dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const PACKAGE_NAME = "tailwindcss"

/**
 * The package's own `package.json`, which its `exports` map publishes.
 *
 * Resolved through the workspace import map rather than spelled as an `npm:`
 * specifier, so Deno answers with the file it actually installed — wherever
 * `DENO_DIR` points.
 */
const MANIFEST_SPECIFIER = `${PACKAGE_NAME}/package.json`

const packageRoots = new Map<string, string>()

/** Drop the memoised package locations. Only tests that re-point the cache need this. */
export function resetStylesheetCache(): void {
  packageRoots.clear()
}

/**
 * The reader Tailwind's `compile()` calls for every `@import`.
 *
 * Declared as an interface rather than a function type because `tailwindcss`
 * does not export the shape and callers have to bind their own version to it.
 */
export interface StylesheetLoader {
  /**
   * @param id The import id as written in the CSS.
   * @param base Absolute path of the importing stylesheet.
   * @returns The resolved path and the file's contents.
   */
  (id: string, base: string): Promise<{ path: string; base: string; content: string }>
}

/**
 * Pick the version directory to use out of what the cache holds.
 *
 * Versions are compared numerically, not as strings: `"4.1.8" > "4.1.12"` in
 * lexicographic order but not in semver, and the cache holds several.
 *
 * @param versions Directory names found in the cache, in any order.
 * @param requested Preferred version.
 * @returns The requested version, or the highest cached one as a fallback.
 * @throws If the cache holds no versions of the package.
 */
export function chooseCachedVersion(versions: string[], requested?: string): string {
  if (requested && versions.includes(requested)) {
    return requested
  }

  const [newest] = [...versions].sort((a, b) => compareVersions(b, a))
  if (!newest) {
    throw new Error(`no ${PACKAGE_NAME} in the Deno npm cache — run \`deno cache\` first`)
  }

  return newest
}

/**
 * Compare two dot-separated version strings numerically.
 *
 * @param a Left version.
 * @param b Right version.
 * @returns Negative when `a` precedes `b`, positive when it follows, else 0.
 */
function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number)
  const right = b.split(".").map(Number)

  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

/**
 * Locate an installed Tailwind CSS package through Deno's own resolver.
 *
 * The location is never guessed: Deno is asked to resolve the package's
 * `package.json`, which the workspace import map turns into the pinned `npm:`
 * specifier. Deriving the path from `HOME` — what this used to do — ignores
 * `DENO_DIR` and fails wherever the cache lives elsewhere, CI containers
 * included.
 *
 * An earlier docstring here claimed `import.meta.resolve()` hands the `npm:`
 * specifier back unchanged. That is true only of a bare `npm:tailwindcss@<v>`,
 * which is not part of the module graph; a specifier the import map resolves
 * comes back as a `file:` URL naming the installed copy.
 *
 * @param version Preferred version. Deno resolves one version — the pin — so any
 *   other version is used only when the cache already holds it beside that copy.
 * @returns Absolute path to the directory holding the package's `package.json`.
 * @throws If `tailwindcss` does not resolve to a file path.
 */
export function tailwindPackageRoot(version?: string): string {
  const root = dirname(fileURLToPath(resolvePackageManifest()))
  const versionsDirectory = dirname(root)
  const versions = readDirectoryNames(versionsDirectory)

  // The copy Deno resolved is authoritative, and its parent is only a version
  // directory when that copy lives in it: true of the npm registry cache Deno
  // fills, false of a `node_modules` tree, where the package sits alone.
  if (!version || !versions.includes(basename(root))) {
    return root
  }

  return join(versionsDirectory, chooseCachedVersion(versions, version))
}

/**
 * Names of the directories directly inside `directory`.
 *
 * @param directory Directory to enumerate.
 * @returns The entry names, or an empty list when the directory is unreadable.
 */
function readDirectoryNames(directory: string): string[] {
  const names: string[] = []
  try {
    for (const entry of Deno.readDirSync(directory)) {
      if (entry.isDirectory) {
        names.push(entry.name)
      }
    }
    return names
  } catch {
    return []
  }
}

/**
 * Resolve the pinned package's `package.json` through the workspace import map.
 *
 * @returns The resolved `file:` URL.
 * @throws If Deno answers with the specifier itself instead of a path.
 */
function resolvePackageManifest(): string {
  let resolved = ""
  try {
    resolved = import.meta.resolve(MANIFEST_SPECIFIER)
  } catch (cause) {
    throw cannotLocatePackage(`deno could not resolve "${MANIFEST_SPECIFIER}" (${cause})`)
  }

  if (!resolved.startsWith("file:")) {
    throw cannotLocatePackage(
      `deno resolved "${MANIFEST_SPECIFIER}" to "${resolved}" rather than to a path`,
    )
  }

  return resolved
}

/**
 * Build the failure every unsolvable lookup shares.
 *
 * @param detail What Deno did instead of resolving the manifest.
 * @returns The error to throw, naming the missing piece and the command that fixes it.
 */
function cannotLocatePackage(detail: string): Error {
  return new Error(
    `cannot locate ${PACKAGE_NAME}: ${detail}. The workspace import map must map ` +
      `"${PACKAGE_NAME}/" to its pinned npm specifier — run ` +
      "`deno cache theme/integration/smoke.test.ts` to populate the npm cache.",
  )
}

/**
 * Resolve an `@import` id the way a Tailwind build would.
 *
 * Relative ids and `file:` URLs resolve against the importing stylesheet. The
 * only supported bare ids are Tailwind's own assets (`tailwindcss`,
 * `tailwindcss/index.css`), which come from `version`.
 *
 * @param id The import id exactly as written in the CSS.
 * @param from Path of the importing stylesheet, or of its directory.
 * @param version Tailwind version to resolve bare ids against.
 * @returns Absolute path of the imported stylesheet.
 * @throws If the id is not a path and not a Tailwind asset.
 */
export function resolveStylesheetPath(id: string, from: string, version: string): string {
  const isPath = id.startsWith("./") || id.startsWith("../") || id.startsWith("/") ||
    id.startsWith("file:")
  if (isPath) {
    return fileURLToPath(new URL(id, pathToFileURL(from)))
  }

  const [name, ...rest] = id.split("/")
  if (name !== PACKAGE_NAME) {
    throw new Error(`cannot resolve @import "${id}" — only ${PACKAGE_NAME} assets are supported`)
  }

  const cacheKey = `${PACKAGE_NAME}@${version}`
  let root = packageRoots.get(cacheKey)
  if (!root) {
    root = tailwindPackageRoot(version)
    packageRoots.set(cacheKey, root)
  }

  return `${root}/${rest.join("/") || "index.css"}`
}

/**
 * Bind a Tailwind version to `resolveStylesheetPath` and hand back a reader
 * `compile()` accepts.
 *
 * @param version Tailwind version to resolve bare ids against.
 * @returns A loader for `compile()`.
 */
export function stylesheetLoader(version: string): StylesheetLoader {
  return async (id, base) => {
    // Tailwind leaves `base` empty when the compiled CSS came in as a string
    // rather than as a file, which would silently resolve relative imports
    // against the process CWD. A public entrypoint reads `tailwindcss` itself,
    // so that case only appears here when a test compiles the wrong stylesheet.
    if (!base) {
      throw new Error(`cannot resolve @import "${id}" without a base path`)
    }

    const path = resolveStylesheetPath(id, base, version)
    return { path, base: path, content: await Deno.readTextFile(path) }
  }
}
