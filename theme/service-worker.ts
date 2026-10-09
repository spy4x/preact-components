/**
 * `serviceWorker` — builds a service worker after the app build, with the build's own hash baked
 * in, so a deploy changes the worker's bytes (browsers see an update) and can name its cache after
 * the build (the old cache is dropped).
 *
 * A browser cannot load a worker that imports a `jsr:` or `npm:` specifier, so the worker's source
 * is bundled into one classic script. This module takes no `vite` dependency and calls no
 * Deno-only API: the app passes Vite's `build`, the plugins that worker build needs, and the two
 * file readers.
 *
 * @module
 */

import type { VitePlugin } from "./vite.ts"

/**
 * A short hash of files, by path and content, so a change to any one of them, or a rename, changes
 * it. The order of the map does not matter.
 *
 * @param files Content by path.
 * @returns Twelve hex digits.
 */
export async function buildIdOf(files: ReadonlyMap<string, Uint8Array>): Promise<string> {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  for (const path of [...files.keys()].sort()) {
    parts.push(encoder.encode(`${path}\0`), files.get(path)!, encoder.encode(`\0`))
  }
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  const digest = new Uint8Array(await crypto.subtle.digest(`SHA-256`, joined))
  return [...digest.slice(0, 6)].map((byte) => byte.toString(16).padStart(2, `0`)).join(``)
}

/** The part of a directory entry {@link ServiceWorkerOptions.readDir} yields. */
export interface ServiceWorkerDirEntry {
  /** The entry's name. */
  name: string
  /** Whether the entry is a directory. */
  isDirectory: boolean
}

/** Options for {@link serviceWorker}. */
export interface ServiceWorkerOptions {
  /** Absolute path of the worker's source file. */
  entry: string
  /** Vite's `build`, imported by the app: `import { build } from "vite"`. */
  build: (config: Record<string, unknown>) => Promise<unknown>
  /** Plugins the worker build needs to resolve its imports, such as `[deno()]`. */
  plugins?: unknown[]
  /** Lists a directory: `Deno.readDir`. */
  readDir: (path: string) => AsyncIterable<ServiceWorkerDirEntry>
  /** Reads a file: `Deno.readFile`. */
  readFile: (path: string) => Promise<Uint8Array>
  /** The worker's file name in the output folder. Default `sw.js`. */
  fileName?: string
  /** The global the build id is defined as in the worker. Default `__BUILD_ID__`. */
  buildIdName?: string
}

/** Every file below `dir` except `skip`, keyed by its path relative to `base`. */
async function readFiles(
  options: ServiceWorkerOptions,
  dir: string,
  base: string,
  skip: string,
  into = new Map<string, Uint8Array>(),
): Promise<Map<string, Uint8Array>> {
  for await (const entry of options.readDir(dir)) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory) await readFiles(options, path, base, skip, into)
    else if (path !== skip) into.set(path.slice(base.length), await options.readFile(path))
  }
  return into
}

/**
 * Builds the worker at `entry` into the output folder once the app build is written, as one
 * classic script (`iife`). The build id, a hash of every other file in that folder, is defined in
 * the worker as `__BUILD_ID__` (see `buildIdName`); the worker uses it in its cache name.
 *
 * A production build only (`apply: "build"`).
 *
 * @param options See {@link ServiceWorkerOptions}.
 */
export function serviceWorker(options: ServiceWorkerOptions): VitePlugin {
  const fileName = options.fileName ?? `sw.js`
  const buildIdName = options.buildIdName ?? `__BUILD_ID__`
  let outDir = ``
  return {
    name: `service-worker`,
    apply: `build`,
    configResolved: (config) => {
      const dir = config.build.outDir
      outDir = dir.startsWith(`/`) ? dir : `${config.root}/${dir.replace(/^\.\//, ``)}`
    },
    async closeBundle() {
      const files = await readFiles(options, outDir, outDir, `${outDir}/${fileName}`)
      await options.build({
        configFile: false,
        publicDir: false,
        logLevel: `warn`,
        plugins: options.plugins ?? [],
        define: { [buildIdName]: JSON.stringify(await buildIdOf(files)) },
        build: {
          outDir,
          emptyOutDir: false,
          lib: {
            entry: options.entry,
            formats: [`iife`],
            name: `sw`,
            fileName: () => fileName,
          },
        },
      })
    },
  }
}
