/**
 * Build the Pages demo: `pages/dist`, which is exactly what `actions/deploy-pages` publishes.
 *
 * One static directory, no server. `index.html` carries the whole catalogue prerendered, plus the
 * href and src of two content-hashed assets, so a redeploy can never serve a new document against a
 * cached island or stylesheet. It also carries the **route echo** — every hash route the navigation
 * links to — which the build reads back and holds against the resolver, since under hash routing the
 * one document is the whole site and a link the resolver would not accept must fail here.
 *
 * **Why Deno-only.** `template` and another app bundle with Vite, and Vite would work here — but it would
 * need a `package.json`, a `node_modules` tree and a second lockfile in CI, plus hand-written
 * aliases for every `@preact-components/*` member Vite cannot see, only to bundle 37 modules and
 * 60 kB of CSS. `deno bundle --platform browser` and Tailwind's own `compile()` API do both from the
 * workspace's existing pinned dependencies, through the same import map the packages already use.
 *
 * Steps, in order:
 *
 * 1. `deno check` over this directory's sources, which reaches the whole catalogue through them.
 *    It no longer catches a component with no demo — that is `coverage.ts`'s rule, and it fails
 *    `deno task test` — but it is still what stops the page shipping a graph that does not compile:
 *    a demo whose component changed its props, a section whose card no longer type-checks, and the
 *    per-component prop records (`Record<ButtonVariant, …>`) that go red when a variant is added
 *    and the catalogue does not show it.
 * 2. Tailwind compiles `styles.css` over the sources its `@source` rules name (`ui/`, `ui-guide/`,
 *    `icons/`, the host page).
 * 3. `deno bundle` produces the island.
 * 4. `App` prerenders, `renderDocument` frames it, and the artefact is written.
 * 5. The route echo is read out of the rendered document and round-tripped through the resolver.
 */

import { leafletStylesheet } from "../map/leaflet-css.ts"
import { Scanner } from "@tailwindcss/oxide"
import { compile } from "tailwindcss"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { BUILD_HASH_FILE, computeBuildFingerprint } from "./build-fingerprint.ts"
import { demoElementId } from "./src/deep-link.ts"
import { renderDocument } from "./src/document.tsx"
import { renderApp } from "./src/prerender.tsx"
import { routeTableFromHtml } from "./src/route-echo.ts"
import { catalogueNames } from "@preact-components/ui-guide/registry"
import { routeTable, routeTableDrift } from "@preact-components/ui-guide/routes"
import { DEFAULT_BASE, DEFAULT_ORIGIN, normalizeBase } from "./src/site.ts"
import { normalizeSources } from "./src/tailwind-sources.ts"

/** This file's directory: the demo's root, `pages/`. */
const PAGES_DIRECTORY = dirname(fileURLToPath(import.meta.url))
/** The repository root — where the root `deno.jsonc` and `deno.lock` live. */
const REPO_ROOT = dirname(PAGES_DIRECTORY)
/** What the artefact is built into. Gitignored, and excluded from the repo's own checks. */
const DIST_DIRECTORY = join(PAGES_DIRECTORY, "dist")
/** GitHub Pages serves a project site from `/<repo>/`; `PAGES_BASE` overrides it for a custom domain. */
const BASE = normalizeBase(Deno.env.get("PAGES_BASE") ?? DEFAULT_BASE)
/** Origin written into the canonical and Open Graph URLs. */
const ORIGIN = Deno.env.get("PAGES_ORIGIN") ?? DEFAULT_ORIGIN
/**
 * Directory copied verbatim into the artefact for the `SWUpdater` card: an inert service worker and
 * one page inside its scope. Copied rather than bundled — a service worker is fetched by URL, and
 * its scope is the directory it is served from, which is the whole point of keeping it here rather
 * than at the site root. See `sw-demo/sw.js` for why a published site can carry it safely.
 */
const SW_DEMO_DIRECTORY = "sw-demo"
/**
 * Directory copied verbatim into the artefact for the `EnhancedForm`, `NewsletterForm` and
 * `ContactForm` cards: one static page that stands in for "a server answered" when no script has
 * run. `pages/serve.ts`, which `deno task verify` runs against, never looks at `request.method`, so
 * it answers a POST with this same file; the published GitHub Pages copy is served by a static host
 * that answers a POST with `405 Method Not Allowed` instead — nothing here claims the published site
 * accepts one, and `pages/checks/ui.ts`'s no-JavaScript check reads the method and the body off the
 * recorded network request rather than assuming either.
 */
const FORM_DEMO_DIRECTORY = "form-demo"
/**
 * Directory copied verbatim into the artefact for the `Map` card's tile layer: one tiny PNG, reused
 * for every `{z}/{x}/{y}` Leaflet asks for, so `deno task verify`'s browser phase never makes a
 * request past the local preview server — see issue #143's security requirement and
 * `pages/checks/map.ts`, which asserts the tiles it loads come from here.
 */
const MAP_DEMO_DIRECTORY = "map-demo"

/** Sources `deno check` must accept before a single byte is emitted. */
const CHECKED_ENTRIES = [
  "build.ts",
  "serve.ts",
  "verify.ts",
  "src/prerender.tsx",
  "src/+main.tsx",
]

/**
 * Run a command in this directory and fail the build when it does.
 *
 * Output is inherited rather than captured: a type error names the file and the line that caused it,
 * and that is the whole value of the message.
 *
 * @param command Executable to run.
 * @param args Arguments, in order.
 * @throws If the command exits non-zero.
 */
async function run(command: string, args: string[]): Promise<void> {
  const { success, code } = await new Deno.Command(command, {
    args,
    cwd: PAGES_DIRECTORY,
    stdout: "inherit",
    stderr: "inherit",
  }).output()

  if (!success) {
    throw new Error(`${command} ${args.join(" ")} exited with ${code}`)
  }
}

/** Short content hash, for an asset filename that changes when the bytes do. */
async function fingerprint(content: Uint8Array): Promise<string> {
  // `Uint8Array.from` narrows the buffer to a plain `ArrayBuffer`, which is what `subtle.digest`
  // takes; the bytes read out of `dist` and out of the bundler are not always typed that narrowly.
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", Uint8Array.from(content)),
  )
  return Array.from(digest.slice(0, 4), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Resolve one `@import` id the way Tailwind expects its host to.
 *
 * Relative ids resolve against the importing stylesheet; a bare id is a package, and packages are
 * resolved through the import map this workspace already has.
 */
function resolveStylesheet(id: string, base: string): URL {
  if (id.startsWith(".") || id.startsWith("/")) {
    return new URL(id, pathToFileURL(base))
  }

  const resolved = new URL(import.meta.resolve(id))
  // `@import "tailwindcss"` names a package, not a module: `import.meta.resolve` would hand back
  // `dist/lib.mjs`. Tailwind's CSS entry for that package is `index.css`.
  return resolved.pathname.endsWith(".css")
    ? resolved
    : new URL(import.meta.resolve(`${id}/index.css`))
}

/**
 * Compile `styles.css` and the classes the scanned sources use, then append Leaflet's own
 * stylesheet.
 *
 * The candidate list comes from Tailwind's own Rust scanner, driven by the stylesheet's `@source`
 * rules — the same pipeline the Tailwind CLI runs, so a class that only appears inside a template
 * string is emitted exactly as it would be for an app.
 *
 * Leaflet's CSS is not run through Tailwind at all — it is not Tailwind-authored, needs no token or
 * `@apply` resolution, and simply concatenating it is what `../map/leaflet-css.ts` exists for (see
 * that module's own doc and `map/README.md` → "Leaflet's stylesheet"). That file is not published —
 * `import.meta.resolve` on an npm subpath carries no dependency record a consumer's own resolver
 * could follow, so it would throw for anyone outside this workspace — which is why this reads it by a
 * relative import rather than as `@preact-components/map`'s own subpath. A real consuming app has no
 * equivalent shortcut; `map/README.md` → "Leaflet's stylesheet" documents the route that works for
 * one: add `leaflet` as its own dependency and include the stylesheet in its own build.
 *
 * @returns The compiled stylesheet: `tokens.css` and `preset.css` inlined by Tailwind, with
 * Leaflet's `dist/leaflet.css` appended verbatim.
 */
async function compileStylesheet(): Promise<Uint8Array> {
  const entry = await Deno.readTextFile(join(PAGES_DIRECTORY, "styles.css"))
  const compiler = await compile(entry, {
    // Tailwind hands `base` back for every relative `@import`, and only when it is set here. A
    // directory base has to keep its trailing slash to resolve as one.
    base: `${PAGES_DIRECTORY}/`,
    async loadStylesheet(id, base) {
      const url = resolveStylesheet(id, base)
      return {
        path: fileURLToPath(url),
        base: fileURLToPath(url),
        content: await Deno.readTextFile(url),
      }
    },
    loadModule(id) {
      throw new Error(`styles.css must not load a JavaScript plugin — it asked for ${id}`)
    },
  })

  const scanner = new Scanner({ sources: normalizeSources(compiler.sources) })
  const candidates = scanner.scan()
  const tailwindCss = compiler.build(candidates)
  const leafletCss = await leafletStylesheet()
  const css = new TextEncoder().encode(`${tailwindCss}\n${leafletCss}`)
  console.log(
    `  tailwind: ${candidates.length} candidates, theme inlined\n` +
      `  leaflet.css appended, ${leafletCss.length} bytes`,
  )
  return css
}

/**
 * Bundle the island for the browser.
 *
 * @returns The bundle's bytes; the caller names and writes the file.
 */
async function bundleIsland(): Promise<Uint8Array> {
  const outputDirectory = await Deno.makeTempDir({ prefix: "pages-island-" })
  try {
    await run("deno", [
      "bundle",
      "--platform",
      "browser",
      "--packages",
      "bundle",
      "--minify",
      "--outdir",
      outputDirectory,
      "src/+main.tsx",
    ])

    const produced = [...Deno.readDirSync(outputDirectory)].filter((entry) => entry.isFile)
    const bundle = produced.find((entry) => entry.name.endsWith(".js"))
    if (!bundle) {
      throw new Error(`deno bundle wrote no JavaScript: ${produced.map((e) => e.name).join(", ")}`)
    }

    return await Deno.readFile(join(outputDirectory, bundle.name))
  } finally {
    await Deno.remove(outputDirectory, { recursive: true })
  }
}

/** Human-readable size, for the build report. */
function kilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`
}

/**
 * Copy one directory into the artefact verbatim, file by file — `sw-demo/` for the `SWUpdater`
 * card and `form-demo/` for `EnhancedForm`/`NewsletterForm`/`ContactForm`, both plain static pages
 * fetched by URL at runtime rather than bundled, which is why neither goes through the island
 * bundler above.
 *
 * An empty or missing directory, or one missing a file the demo needs, throws instead of shipping a
 * catalogue whose card depends on a file that is not there: the card would show its own broken
 * state, and the browser check that drives it would fail with a message about the wrong thing.
 *
 * @param directory Name of the directory, under both `pages/` and the artefact root.
 * @param requiredFiles File names that must be present, or this throws.
 * @param usedBy One line naming the card(s) this directory is for, for the throw message.
 * @returns The file names copied, for the build report.
 */
async function copyDemoDirectory(
  directory: string,
  requiredFiles: readonly string[],
  usedBy: string,
): Promise<string[]> {
  const source = join(PAGES_DIRECTORY, directory)
  const target = join(DIST_DIRECTORY, directory)
  await Deno.mkdir(target, { recursive: true })

  const copied: string[] = []
  for await (const entry of Deno.readDir(source)) {
    if (!entry.isFile) continue
    await Deno.copyFile(join(source, entry.name), join(target, entry.name))
    copied.push(entry.name)
  }

  const missing = requiredFiles.filter((name) => !copied.includes(name))
  if (missing.length > 0) {
    throw new Error(
      `${source} must hold ${requiredFiles.join(", ")} for ${usedBy} — found ` +
        `${copied.join(", ") || "nothing"}, missing ${missing.join(", ")}`,
    )
  }

  return copied.sort()
}

/** Build the artefact. */
async function main(): Promise<void> {
  console.log(`pages build → ${DIST_DIRECTORY}`)

  await run("deno", ["check", ...CHECKED_ENTRIES])
  const [stylesheet, island] = [await compileStylesheet(), await bundleIsland()]
  const appHtml = renderApp()
  // Every route the guide can be opened at, derived from the catalogue's registry rather than kept
  // here: the echo further down is this value, read back out of the document that ships it.
  const routes = routeTable()

  // The one thing this page adds to the catalogue is its deep links, and they address `demo-<Name>`
  // ids the guide renders. The navigation has a chip per card in every section — `ui/`'s and the
  // other packages' alike — so the assertion is over the whole catalogue rather than over the ui
  // barrel: a card missing from any section would ship a link that points nowhere.
  const missing = catalogueNames.filter((name) => !appHtml.includes(`id="${demoElementId(name)}"`))
  if (missing.length > 0) {
    throw new Error(`no demo card for ${missing.join(", ")} — deep links would point nowhere`)
  }

  const assetNames = {
    css: `main.${await fingerprint(stylesheet)}.css`,
    js: `main.${await fingerprint(island)}.js`,
  }

  const html = renderDocument({
    base: BASE,
    origin: ORIGIN,
    cssHref: `${BASE}assets/${assetNames.css}`,
    islandSrc: `${BASE}assets/${assetNames.js}`,
    appHtml,
    routeTable: routes,
  })

  // Under hash routing the one `index.html` *is* every route, so the emission check is this: read
  // the route table back out of the document that is about to be published and hold every entry
  // against the resolver that has to accept it. A href the resolver would not open — a renamed
  // section, a demo keyed to another section's card, a hand-edited payload — fails here rather than
  // shipping a link the page cannot follow. The table is read from the rendered HTML and not from
  // the value passed in, so what is checked is what ships. This runs before `dist/` is cleared: a
  // build that cannot ship its own links should leave the previous artefact alone.
  const emitted = routeTableFromHtml(html)
  const drift = routeTableDrift(emitted)
  if (drift.length > 0) {
    throw new Error(
      `the route echo does not round-trip through the resolver:\n  ${drift.join("\n  ")}`,
    )
  }

  await Deno.remove(DIST_DIRECTORY, { recursive: true }).catch(() => {})
  await Deno.mkdir(join(DIST_DIRECTORY, "assets"), { recursive: true })

  await Deno.writeFile(join(DIST_DIRECTORY, "assets", assetNames.css), stylesheet)
  await Deno.writeFile(join(DIST_DIRECTORY, "assets", assetNames.js), island)

  await Deno.writeFile(join(DIST_DIRECTORY, "index.html"), new TextEncoder().encode(html))
  const swDemo = await copyDemoDirectory(
    SW_DEMO_DIRECTORY,
    ["sw.js", "index.html"],
    "the SWUpdater card",
  )
  const formDemo = await copyDemoDirectory(
    FORM_DEMO_DIRECTORY,
    ["index.html"],
    "the EnhancedForm/NewsletterForm/ContactForm cards",
  )
  const mapDemo = await copyDemoDirectory(
    MAP_DEMO_DIRECTORY,
    ["tile.png"],
    "the Map card",
  )

  // Written last, after every other artefact file, so a build that throws partway through never
  // leaves a hash on disk that claims a `dist/` newer than what actually got written — `verify.ts`
  // reads this file and refuses to run against a `dist/` that does not match the working tree
  // (#280).
  const buildFingerprint = await computeBuildFingerprint(REPO_ROOT)
  await Deno.writeTextFile(join(DIST_DIRECTORY, BUILD_HASH_FILE), buildFingerprint)

  console.log(
    `  index.html ${kilobytes(html.length)} · prerendered ${catalogueNames.length} components\n` +
      `  routes ${routes.sections.length} sections, ${routes.demos.length} demos, all resolved\n` +
      `  assets/${assetNames.css} ${kilobytes(stylesheet.length)}\n` +
      `  assets/${assetNames.js} ${kilobytes(island.length)}\n` +
      `  ${SW_DEMO_DIRECTORY}/ ${swDemo.join(", ")} — registered only when a visitor asks\n` +
      `  ${FORM_DEMO_DIRECTORY}/ ${formDemo.join(", ")} — the no-JavaScript forms post here\n` +
      `  ${MAP_DEMO_DIRECTORY}/ ${
        mapDemo.join(", ")
      } — the local tile the Map card's layer requests\n` +
      `  served from ${ORIGIN}${BASE}`,
  )
}

if (import.meta.main) {
  await main()
}
