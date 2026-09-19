/**
 * Build the Pages demo: `pages/dist`, which is exactly what `actions/deploy-pages` publishes.
 *
 * One static directory, no server. `index.html` carries the whole catalogue prerendered, plus the
 * href and src of two content-hashed assets, so a redeploy can never serve a new document against a
 * cached island or stylesheet.
 *
 * **Why Deno-only.** `template` and `gb` bundle with Vite, and Vite would work here — but it would
 * need a `package.json`, a `node_modules` tree and a second lockfile in CI, plus hand-written
 * aliases for every `@preact-components/*` member Vite cannot see, only to bundle 37 modules and
 * 60 kB of CSS. `deno bundle --platform browser` and Tailwind's own `compile()` API do both from the
 * workspace's existing pinned dependencies, through the same import map the packages already use.
 *
 * Steps, in order:
 *
 * 1. `deno check` — the catalogue's drift guard *is* a type error, so the build must not skip it.
 * 2. Tailwind compiles `styles.css` over the sources its `@source` rules name (`ui/`, `ui-guide/`,
 *    `icons/`, the host page).
 * 3. `deno bundle` produces the island.
 * 4. `App` prerenders, `renderDocument` frames it, and the artefact is written.
 */

import { Scanner } from "@tailwindcss/oxide"
import { compile } from "tailwindcss"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { demoElementId } from "./src/deep-link.ts"
import { renderDocument } from "./src/document.ts"
import { renderApp } from "./src/prerender.tsx"
import { catalogueNames } from "@preact-components/ui-guide/registry"
import { DEFAULT_BASE, DEFAULT_ORIGIN, normalizeBase } from "./src/site.ts"
import { normalizeSources } from "./src/tailwind-sources.ts"

/** This file's directory: the demo's root, `pages/`. */
const PAGES_DIRECTORY = dirname(fileURLToPath(import.meta.url))
/** What the artefact is built into. Gitignored, and excluded from the repo's own checks. */
const DIST_DIRECTORY = join(PAGES_DIRECTORY, "dist")
/** GitHub Pages serves a project site from `/<repo>/`; `PAGES_BASE` overrides it for a custom domain. */
const BASE = normalizeBase(Deno.env.get("PAGES_BASE") ?? DEFAULT_BASE)
/** Origin written into the canonical and Open Graph URLs. */
const ORIGIN = Deno.env.get("PAGES_ORIGIN") ?? DEFAULT_ORIGIN

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
 * Output is inherited rather than captured: a drift error from `deno check` names the component that
 * caused it, and that is the whole value of the message.
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
 * Compile `styles.css` and the classes the scanned sources use.
 *
 * The candidate list comes from Tailwind's own Rust scanner, driven by the stylesheet's `@source`
 * rules — the same pipeline the Tailwind CLI runs, so a class that only appears inside a template
 * string is emitted exactly as it would be for an app.
 *
 * @returns The compiled stylesheet, with `tokens.css` and `preset.css` inlined.
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
  const css = new TextEncoder().encode(compiler.build(candidates))
  console.log(`  tailwind: ${candidates.length} candidates, theme inlined`)
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

/** Build the artefact. */
async function main(): Promise<void> {
  console.log(`pages build → ${DIST_DIRECTORY}`)

  await run("deno", ["check", ...CHECKED_ENTRIES])
  const [stylesheet, island] = [await compileStylesheet(), await bundleIsland()]
  const appHtml = renderApp()

  // The one thing this page adds to the catalogue is its deep links, and they address `demo-<Name>`
  // ids the guide renders. The navigation has a chip per card in every section — `ui/`'s and the
  // other packages' alike — so the assertion is over the whole catalogue rather than over the ui
  // barrel: a card missing from any section would ship a link that points nowhere.
  const missing = catalogueNames.filter((name) => !appHtml.includes(`id="${demoElementId(name)}"`))
  if (missing.length > 0) {
    throw new Error(`no demo card for ${missing.join(", ")} — deep links would point nowhere`)
  }

  await Deno.remove(DIST_DIRECTORY, { recursive: true }).catch(() => {})
  await Deno.mkdir(join(DIST_DIRECTORY, "assets"), { recursive: true })

  const assetNames = {
    css: `main.${await fingerprint(stylesheet)}.css`,
    js: `main.${await fingerprint(island)}.js`,
  }
  await Deno.writeFile(join(DIST_DIRECTORY, "assets", assetNames.css), stylesheet)
  await Deno.writeFile(join(DIST_DIRECTORY, "assets", assetNames.js), island)

  const html = new TextEncoder().encode(
    renderDocument({
      base: BASE,
      origin: ORIGIN,
      cssHref: `${BASE}assets/${assetNames.css}`,
      islandSrc: `${BASE}assets/${assetNames.js}`,
      appHtml,
    }),
  )
  await Deno.writeFile(join(DIST_DIRECTORY, "index.html"), html)

  console.log(
    `  index.html ${kilobytes(html.length)} · prerendered ${catalogueNames.length} components\n` +
      `  assets/${assetNames.css} ${kilobytes(stylesheet.length)}\n` +
      `  assets/${assetNames.js} ${kilobytes(island.length)}\n` +
      `  served from ${ORIGIN}${BASE}`,
  )
}

if (import.meta.main) {
  await main()
}
