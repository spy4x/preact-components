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

import { fileURLToPath, pathToFileURL } from "node:url"

const PACKAGE_NAME = "tailwindcss"

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
 * Locate an installed Tailwind CSS package in the Deno npm registry cache.
 *
 * `import.meta.resolve()` hands back the `npm:` specifier unchanged rather than
 * a file path, so the cache is read directly. The requested version wins: older
 * versions of the same package are often cached alongside it and their file
 * layout is not interchangeable.
 *
 * @param version Preferred version; falls back to the highest cached version.
 * @returns Absolute path to the directory holding the package's `package.json`.
 * @throws If `HOME` is unset or the package is not cached.
 */
export function tailwindPackageRoot(version?: string): string {
  const home = Deno.env.get("HOME")
  if (!home) {
    throw new Error("HOME is required to locate the Deno npm cache")
  }

  const versionsDirectory = `${home}/.cache/deno/npm/registry.npmjs.org/${PACKAGE_NAME}`
  const versions: string[] = []
  for (const entry of Deno.readDirSync(versionsDirectory)) {
    if (entry.isDirectory) {
      versions.push(entry.name)
    }
  }

  return `${versionsDirectory}/${chooseCachedVersion(versions, version)}`
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
