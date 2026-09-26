/**
 * `@spy4x/preact-theme/vite` — the Vite plugins a Deno app needs to use the `@spy4x/preact-*`
 * packages.
 *
 * Three plugins, each a factory an app lists in its `vite.config.ts`:
 *
 * - {@link preactThemeCss} answers the theme's `@import` lines in the app's stylesheet with the
 *   text this package exports, and appends `@source inline(...)` with {@link COMPONENT_CLASSES}.
 * - {@link requireComponentCss} fails a build whose CSS lacks the components' classes.
 * - {@link npmSpecifiers} resolves the `npm:` specifiers inside the library's modules to the app's
 *   own copy, and fails when the versions differ.
 *
 * The plugins are typed structurally ({@link VitePlugin}): this package takes no `vite`
 * dependency, and an object of this shape is accepted wherever Vite takes a plugin. Nothing here
 * calls a Deno-only API; the one plugin that reads files takes the reader as an option.
 *
 * @module
 */

import { COMPONENT_CLASSES } from "./component-classes.ts"
import { INK_CSS } from "./ink-css.ts"
import { PRESET_CSS } from "./preset-css.ts"
import { TOKENS_CSS } from "./tokens-css.ts"

/** The part of Rollup's plugin context the hooks below call. */
export interface VitePluginContext {
  /** Fails the build with `message`. */
  error(message: string): never
}

/** What {@link ViteResolveContext.resolve} answers: the id another plugin resolved a module to. */
export interface VitePartialResolvedId {
  /** The resolved module id, usually an absolute file path, possibly with a query. */
  id: string
}

/** The dependency optimizer's record of one pre-bundled import. */
export interface ViteOptimizedDep {
  /** The original file Vite bundled from. */
  src?: string
}

/** The part of a Vite environment {@link npmSpecifiers} reads: the dev server's optimizer. */
export interface ViteEnvironment {
  /** The environment's name, such as `client` or `ssr`. */
  name: string
  /** Present in the dev server; a build environment has none. */
  depsOptimizer?: {
    metadata: {
      optimized: Record<string, ViteOptimizedDep>
      discovered: Record<string, ViteOptimizedDep>
    }
  }
}

/** The plugin context inside `resolveId`. */
export interface ViteResolveContext {
  /** Resolves `source` through every other plugin. */
  resolve(
    source: string,
    importer: string | undefined,
    options: { skipSelf: boolean },
  ): Promise<VitePartialResolvedId | null>
  /** The environment the module is resolved for. */
  environment: ViteEnvironment
}

/** One file of the bundle `generateBundle` receives: a CSS or other asset, or a JS chunk. */
export interface ViteOutputFile {
  /** `asset` or `chunk`. */
  type: string
  /** The file's name in the output directory. */
  fileName: string
  /** An asset's contents; a chunk has none. */
  source?: string | Uint8Array
}

/**
 * The shape of a Vite plugin, cut down to the hooks the plugins here implement.
 *
 * Each field is a subset of the one Vite declares, so a value of this type goes into Vite's
 * `plugins` array as it is (checked by hand against `vite@7.3.6`'s own `Plugin` type; no test here
 * repeats that, because this package takes no `vite` dependency).
 */
export interface VitePlugin {
  /** The plugin's name, shown in Vite's errors and warnings. */
  name: string
  /** `pre` runs the plugin before Vite's own plugins and before those without it. */
  enforce?: "pre" | "post"
  /** Limits the plugin to `vite build` or to the dev server. */
  apply?: "build" | "serve"
  /** Rewrites a module's source. */
  transform?: (
    this: VitePluginContext,
    code: string,
    id: string,
  ) => string | undefined
  /** Resolves an import to a module id. */
  resolveId?: (
    this: ViteResolveContext,
    source: string,
    importer: string | undefined,
  ) => Promise<VitePartialResolvedId | null | undefined>
  /** Runs once the bundle is written in memory, before it reaches disk. */
  generateBundle?: (
    this: VitePluginContext,
    options: unknown,
    bundle: Record<string, ViteOutputFile>,
  ) => void
}

/** The theme's `@import` lines, each with the text it stands for and whether it is required. */
const THEME_STYLESHEETS: ReadonlyArray<{ specifier: string; text: string; required: boolean }> = [
  { specifier: "@spy4x/preact-theme/tokens.css", text: TOKENS_CSS, required: true },
  { specifier: "@spy4x/preact-theme/ink.css", text: INK_CSS, required: false },
  { specifier: "@spy4x/preact-theme/preset.css", text: PRESET_CSS, required: true },
]

/** Options for {@link preactThemeCss}. */
export interface PreactThemeCssOptions {
  /**
   * The end of the stylesheet's module id, from a `/`: the one file the plugin rewrites.
   * Default `/src/app.css`.
   */
  stylesheet?: string
}

/**
 * Gives the app's stylesheet the `@spy4x/preact-*` design system before Tailwind compiles it.
 *
 * JSR cannot publish a CSS file as an importable module, so this package exports each
 * stylesheet's text instead. The plugin replaces each theme `@import` line in the stylesheet with
 * that text — `tokens.css` and `preset.css` are required, `ink.css` is optional — and appends one
 * `@source inline(...)` line with {@link COMPONENT_CLASSES}, so Tailwind emits the components'
 * classes without scanning the library's files. Deno keeps those files in its cache, and inside
 * the Alpine image Tailwind's scanner reads none of them (spy4x/preact-components#323).
 *
 * List it before `@tailwindcss/vite`.
 *
 * @throws From the transform, when the stylesheet lacks the `tokens.css` or `preset.css` import.
 */
export function preactThemeCss(options: PreactThemeCssOptions = {}): VitePlugin {
  const stylesheet = options.stylesheet ?? "/src/app.css"
  return {
    name: "preact-theme-css",
    enforce: "pre",
    transform(code, id) {
      // The dev server asks for a linked stylesheet as `app.css?direct`, so drop the query first.
      if (!id.split("?")[0].endsWith(stylesheet)) return
      let css = code
      for (const { specifier, text, required } of THEME_STYLESHEETS) {
        const line = `@import "${specifier}";`
        if (!css.includes(line)) {
          if (required) throw new Error(`${stylesheet} must contain ${line}`)
          continue
        }
        // A function, so a `$` in the stylesheet is not read as a replacement pattern.
        css = css.replace(line, () => text)
      }
      return `${css}\n@source inline("${COMPONENT_CLASSES}");\n`
    },
  }
}

/** Options for {@link requireComponentCss}. */
export interface RequireComponentCssOptions {
  /**
   * Selectors, escaped as they appear in the built CSS, that the build must contain. Default: two
   * that only the library's components render, `.lg\:w-64` and `.focus\:not-sr-only`. Do not
   * pass a plain class such as `.sr-only`: Tailwind scans the app's `vite.config.ts` too, finds
   * the class written there, and emits it, so the guard could never fail.
   */
  selectors?: readonly string[]
}

/**
 * Fails `vite build` when the CSS it wrote lacks the library's classes.
 *
 * Without them the app renders unstyled, yet Tailwind still exits 0: that is how an Alpine image
 * once shipped without them. A few selectors only the library's components produce are enough to
 * catch a build where the class names never reached Tailwind.
 */
export function requireComponentCss(options: RequireComponentCssOptions = {}): VitePlugin {
  const selectors = options.selectors ?? [".lg\\:w-64", ".focus\\:not-sr-only"]
  return {
    name: "require-component-css",
    apply: "build",
    generateBundle(_options, bundle) {
      const css = Object.values(bundle)
        .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
        .map((file) =>
          typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source)
        )
        .join("\n")
      const missing = selectors.filter((selector) => !css.includes(selector))
      if (missing.length > 0) {
        this.error(`The built CSS lacks the library's classes: ${missing.join(", ")}`)
      }
    },
  }
}

/** Thrown when a library module pins an npm package at a version the app does not have. */
export class NpmVersionMismatchError extends Error {
  override name = "NpmVersionMismatchError"
  /**
   * @param specifier The `npm:` specifier as the library's module wrote it.
   * @param resolvedVersion The version the app's copy of the package carries.
   * @param importer The module that imported it, when Vite knows.
   */
  constructor(specifier: string, resolvedVersion: string, importer: string | undefined) {
    super(
      `${specifier} (imported by ${importer ?? "unknown"}) resolved to version ` +
        `${resolvedVersion}. Pin the same version in the app's deno.json, or use a library ` +
        `release pinned to the app's.`,
    )
  }
}

/** Options for {@link npmSpecifiers}. */
export interface NpmSpecifiersOptions {
  /**
   * Reads a text file, and rejects when it does not exist: `Deno.readTextFile`, or Node's
   * `(path) => readFile(path, "utf8")`. A rejection whose `name` is `NotFound` (Deno) or whose
   * `code` is `ENOENT` (Node) means the file is absent; any other rejection fails the build.
   */
  readTextFile: (path: string) => Promise<string>
}

/** Whether `error` says a file does not exist, in Deno's words or Node's. */
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const { name, code } = error as { name?: unknown; code?: unknown }
  return name === "NotFound" || code === "ENOENT"
}

/** The directory part of a `/`-separated path; the path itself at its root. */
function parentOf(path: string): string {
  const slash = path.lastIndexOf("/")
  if (slash < 0) return path
  if (slash === 0) return "/"
  return path.slice(0, slash)
}

/**
 * The version of npm package `name` that Vite resolved as `resolvedId`, read from the nearest
 * `package.json` above it that names that package. In the dev server `resolvedId` is Vite's
 * pre-bundled copy under `.vite/deps/`, which carries no version, so the original file comes from
 * the dependency optimizer's record of it (`key` is the import it was bundled for, such as
 * `preact/hooks`).
 */
async function resolvedVersion(
  readTextFile: NpmSpecifiersOptions["readTextFile"],
  environment: ViteEnvironment,
  name: string,
  key: string,
  resolvedId: string,
): Promise<string> {
  let file = resolvedId.split("?")[0]
  if (file.includes("/.vite/deps/")) {
    const metadata = environment.depsOptimizer?.metadata
    const source = metadata?.optimized[key]?.src ?? metadata?.discovered[key]?.src
    if (!source) throw new Error(`Cannot find the source of Vite's pre-bundled ${key}`)
    file = source
  }
  for (let dir = parentOf(file); dir !== parentOf(dir); dir = parentOf(dir)) {
    let text: string
    try {
      text = await readTextFile(`${dir}/package.json`)
    } catch (error) {
      if (isNotFound(error)) continue
      throw error
    }
    const manifest = JSON.parse(text) as { name?: string; version?: string }
    if (manifest.name === name && manifest.version) return manifest.version
  }
  throw new Error(`Cannot find the package.json of ${name} above ${file}`)
}

/**
 * Resolves the `npm:` specifiers inside `@spy4x/preact-*` modules to the app's own copy of that
 * package, and refuses one whose pinned version differs from the app's.
 *
 * `@deno/vite-plugin` 1.0.6 turns `npm:@preact/signals@2.5.1` into an empty module id (it cuts a
 * scoped name at its first `@`) and drops the subpath of `npm:/preact@10.29.8/hooks`, so the build
 * fails. A page must load exactly one preact anyway, so each specifier resolves to the bare package
 * plus its subpath, and the build fails with {@link NpmVersionMismatchError} when the app's copy is
 * not the version the specifier names.
 *
 * List it before `deno()` from `@deno/vite-plugin`, so it runs first.
 *
 * Delete it once denoland/deno-vite-plugin#74 is fixed
 * (https://github.com/denoland/deno-vite-plugin/issues/74): that bug is its only reason to exist.
 */
export function npmSpecifiers(options: NpmSpecifiersOptions): VitePlugin {
  return {
    name: "npm-specifiers",
    enforce: "pre",
    async resolveId(source, importer) {
      const match = /^npm:\/?((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(\/.*)?$/.exec(source)
      if (!match) return
      const [, name, version, subpath = ""] = match
      const bare = `${name}${subpath}`
      const resolved = await this.resolve(bare, importer, { skipSelf: true })
      if (!resolved || version === undefined) return resolved
      const actual = await resolvedVersion(
        options.readTextFile,
        this.environment,
        name,
        bare,
        resolved.id,
      )
      if (actual !== version) throw new NpmVersionMismatchError(source, actual, importer)
      return resolved
    },
  }
}
