/**
 * `webManifest` — writes the web app manifest (`manifest.webmanifest`) from a typed object, with
 * the defaults an installable app needs, and serves the same file from the dev server.
 *
 * The page still links it with one line in its `<head>`:
 * `<link rel="manifest" href="/manifest.webmanifest">`.
 *
 * @module
 */

import type { VitePlugin } from "./vite.ts"

/** One manifest icon. */
export interface WebManifestIcon {
  /** The image's address, such as `/icons/icon-512.png`. */
  src: string
  /** Its size as `"512x512"`, or `"any"` for an SVG. */
  sizes: string
  /** Its media type, such as `image/png`. */
  type?: string
  /**
   * `maskable` is an icon with its subject inside the middle 80%, which Android may crop to any
   * shape; `any` is shown as it is. Defaults to `any`.
   */
  purpose?: "any" | "maskable" | "monochrome" | "any maskable"
}

/** The manifest fields a caller writes; everything but `name` and `icons` has a default. */
export interface WebManifestInput {
  /** The app's full name, on the install dialog and the splash screen. */
  name: string
  /** The name under the home-screen icon. Defaults to `name`. */
  short_name?: string
  /** One sentence on what the app does. */
  description?: string
  /** The app's identity across manifest changes. Defaults to `start_url`. */
  id?: string
  /** The page the installed app opens on. Defaults to Vite's `base`, usually `/`. */
  start_url?: string
  /** The addresses that stay inside the installed app. Defaults to Vite's `base`. */
  scope?: string
  /** How the installed app shows. Defaults to `standalone`: its own window, no browser bar. */
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser"
  /** The splash screen's background. Defaults to `#ffffff`. */
  background_color?: string
  /** The colour of the title bar or status bar. */
  theme_color?: string
  /** The page's language, such as `en`. */
  lang?: string
  /** Lock the installed app to one orientation. */
  orientation?: "any" | "portrait" | "landscape"
  /**
   * The icons. Browsers ask for a 192x192 and a 512x512 one to offer install, and Android crops a
   * `maskable` one to its own shape, so all three are required.
   */
  icons: WebManifestIcon[]
}

/** A manifest with every default filled in, as written to the file. */
export interface WebManifest extends WebManifestInput {
  short_name: string
  id: string
  start_url: string
  scope: string
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser"
  background_color: string
}

/** Whether `icon` is offered at `size`, such as `"512x512"`. */
function hasSize(icon: WebManifestIcon, size: string): boolean {
  return icon.sizes.split(/\s+/).includes(size)
}

/**
 * The manifest with its defaults filled in.
 *
 * @param input The fields to write.
 * @param base Vite's `base`, the default `start_url` and `scope`. Defaults to `/`.
 * @throws When `name` is empty, or `icons` lacks a 192x192 icon, a 512x512 one or a maskable one:
 * a browser would then not offer to install the app, or Android would crop the icon.
 */
export function buildWebManifest(input: WebManifestInput, base = "/"): WebManifest {
  if (!input.name.trim()) throw new Error("webManifest: `name` is required")
  const missing = [
    input.icons.some((icon) => hasSize(icon, "192x192")) ? "" : "a 192x192 icon",
    input.icons.some((icon) => hasSize(icon, "512x512")) ? "" : "a 512x512 icon",
    input.icons.some((icon) => icon.purpose?.split(" ").includes("maskable"))
      ? ""
      : `an icon with purpose "maskable"`,
  ].filter(Boolean)
  if (missing.length > 0) throw new Error(`webManifest: \`icons\` needs ${missing.join(", ")}`)
  const start = input.start_url ?? base
  return {
    ...input,
    short_name: input.short_name ?? input.name,
    id: input.id ?? start,
    start_url: start,
    scope: input.scope ?? base,
    display: input.display ?? "standalone",
    background_color: input.background_color ?? "#ffffff",
  }
}

/** Options for {@link webManifest}. */
export interface WebManifestOptions {
  /** The manifest's fields; see {@link buildWebManifest} for the defaults and what it requires. */
  manifest: WebManifestInput
  /** Writes a text file: `Deno.writeTextFile`. */
  writeTextFile: (path: string, text: string) => Promise<void>
  /** The file's name in the output folder. Defaults to `manifest.webmanifest`. */
  fileName?: string
}

/**
 * Writes the manifest into the output folder once the app build is written, and serves it from the
 * dev server at `/<fileName>` (under Vite's `base`, or at the root when `base` is relative, as
 * `./` is). The manifest is checked when the config
 * resolves, so a missing icon fails `vite build` and `vite dev` at once.
 *
 * @param options See {@link WebManifestOptions}.
 */
export function webManifest(options: WebManifestOptions): VitePlugin {
  const fileName = options.fileName ?? "manifest.webmanifest"
  let command = ""
  let base = "/"
  let root = ""
  let outDir = ""
  let text = ""
  let appBuildFailed = false
  return {
    name: "web-manifest",
    configResolved(resolved) {
      command = resolved.command
      base = resolved.base ?? "/"
      root = resolved.root
      outDir = resolved.build.outDir
      text = JSON.stringify(buildWebManifest(options.manifest, base), null, 2) + "\n"
    },
    configureServer(server) {
      // A relative base (`./` or empty) is relative to the page, and the dev server serves the page
      // from its root, so the page's link resolves against `/`.
      const prefix = base.startsWith("/") ? base : "/"
      const path = `${prefix.endsWith("/") ? prefix : `${prefix}/`}${fileName}`
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== path) return next()
        response.statusCode = 200
        response.setHeader("Content-Type", "application/manifest+json")
        response.setHeader("Cache-Control", "no-cache")
        response.end(text)
      })
    },
    buildEnd(error) {
      appBuildFailed = error !== undefined
    },
    async closeBundle() {
      // The dev server calls `closeBundle` too, when it shuts down.
      if (command !== "build" || appBuildFailed) return
      const dir = this?.environment?.config.build.outDir ?? outDir
      const out = dir.startsWith("/") ? dir : `${root}/${dir.replace(/^\.\//, "")}`
      await options.writeTextFile(`${out}/${fileName}`, text)
    },
  }
}
