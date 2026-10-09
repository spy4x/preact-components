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
  /**
   * Whether the dev server serves the worker at `/<fileName>` (under Vite's `base`). Default
   * `true`.
   */
  dev?: boolean
}

/** The build id the worker gets from the dev server, where there is no build to hash. */
const DEV_BUILD_ID = `dev`

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
 * the worker as `__BUILD_ID__` (see `buildIdName`); the worker uses it in its cache name. A failed
 * app build builds no worker, so the app build's own error is the one reported. With several
 * environments, the worker goes into the output folder of the environment whose `closeBundle` runs
 * it (Vite 6+).
 *
 * The dev server serves the same worker from memory at `/<fileName>` (under Vite's `base`), built
 * with the same settings, with `__BUILD_ID__` set to `"dev"` and `Cache-Control:
 * no-cache`. It rebuilds the worker on every request, so an edit shows on the next fetch; a failed
 * build answers 500 with the error's message. `dev: false` turns this off.
 *
 * @param options See {@link ServiceWorkerOptions}.
 */
export function serviceWorker(options: ServiceWorkerOptions): VitePlugin {
  const fileName = options.fileName ?? `sw.js`
  const buildIdName = options.buildIdName ?? `__BUILD_ID__`
  let command = ``
  let base = `/`
  let root = ``
  let outDir = ``
  let appBuildFailed = false
  /** The worker build's config: `out` adds output settings to the shared ones. */
  const config = (buildId: string, out: Record<string, unknown>) => ({
    configFile: false,
    publicDir: false,
    logLevel: `warn`,
    plugins: options.plugins ?? [],
    define: { [buildIdName]: JSON.stringify(buildId) },
    build: {
      ...out,
      lib: { entry: options.entry, formats: [`iife`], name: `sw`, fileName: () => fileName },
    },
  })
  /** Builds the worker in memory and returns its code. */
  const bundle = async () => {
    const result = await options.build(config(DEV_BUILD_ID, { write: false }))
    const outputs = (Array.isArray(result) ? result : [result]) as Array<{
      output?: Array<{ type: string; code?: string }>
    }>
    const chunk = outputs[0]?.output?.find((file) => file.type === `chunk`)
    if (!chunk?.code) throw new Error(`The worker build produced no script`)
    return chunk.code
  }
  return {
    name: `service-worker`,
    configResolved: (resolved) => {
      command = resolved.command
      base = resolved.base ?? `/`
      root = resolved.root
      outDir = resolved.build.outDir
    },
    configureServer(server) {
      if (options.dev === false) return
      const path = `${base.endsWith(`/`) ? base : `${base}/`}${fileName}`
      server.middlewares.use((request, response, next) => {
        if (request.url?.split(`?`)[0] !== path) return next()
        bundle().then((code) => {
          response.statusCode = 200
          response.setHeader(`Content-Type`, `text/javascript`)
          response.setHeader(`Cache-Control`, `no-cache`)
          response.end(code)
        }, (error: unknown) => {
          response.statusCode = 500
          response.setHeader(`Content-Type`, `text/plain`)
          response.setHeader(`Cache-Control`, `no-cache`)
          response.end(error instanceof Error ? error.message : String(error))
        })
      })
    },
    buildEnd(error) {
      appBuildFailed = error !== undefined
    },
    async closeBundle() {
      // The dev server calls `closeBundle` too, when it shuts down.
      if (command !== `build` || appBuildFailed) return
      // With several environments (client and server, as in Fresh), `configResolved` runs once per
      // environment, so its last output folder may not be this one's. Vite 6+ names this one.
      const dir = this?.environment?.config.build.outDir ?? outDir
      const out = dir.startsWith(`/`) ? dir : `${root}/${dir.replace(/^\.\//, ``)}`
      const files = await readFiles(options, out, out, `${out}/${fileName}`)
      await options.build(config(await buildIdOf(files), { outDir: out, emptyOutDir: false }))
    },
  }
}
