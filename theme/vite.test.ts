/**
 * Drives each Vite plugin's hook with the arguments Vite would pass, faked in memory, so no Vite
 * install and no file on disk is needed.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { COMPONENT_CLASSES, INK_CSS, PRESET_CSS, TOKENS_CSS } from "./+index.ts"
import {
  npmSpecifiers,
  NpmVersionMismatchError,
  preactThemeCss,
  requireComponentCss,
  type ViteEnvironment,
  type VitePartialResolvedId,
  type VitePluginContext,
  type ViteResolveContext,
} from "./vite.ts"

/** A plugin context whose `error` throws, the way Rollup's does. */
const pluginContext: VitePluginContext = {
  error(message: string): never {
    throw new Error(message)
  },
}

/** Runs the theme plugin's transform on `code` as the module `id`. */
function transform(code: string, id: string, stylesheet?: string): string | undefined {
  const plugin = preactThemeCss(stylesheet === undefined ? {} : { stylesheet })
  return plugin.transform!.call(pluginContext, code, id)
}

const THEME_IMPORTS = `@import "tailwindcss";
@import "@spy4x/preact-theme/tokens.css";
@import "@spy4x/preact-theme/preset.css";
.app { color: red; }`

/** The line the plugin appends. */
const SOURCE_LINE = `\n@source inline("${COMPONENT_CLASSES}");\n`

describe("preactThemeCss", () => {
  it("replaces the tokens and preset imports with the stylesheets' text", () => {
    const css = transform(THEME_IMPORTS, "/work/app/src/app.css")!
    expect(css).toBe(
      `@import "tailwindcss";\n${TOKENS_CSS}\n${PRESET_CSS}\n.app { color: red; }` + SOURCE_LINE,
    )
  })

  it("replaces the ink import when the stylesheet has one", () => {
    const code = THEME_IMPORTS.replace(
      `@import "@spy4x/preact-theme/preset.css";`,
      `@import "@spy4x/preact-theme/ink.css";\n@import "@spy4x/preact-theme/preset.css";`,
    )
    const css = transform(code, "/work/app/src/app.css")!
    expect(css).toBe(
      `@import "tailwindcss";\n${TOKENS_CSS}\n${INK_CSS}\n${PRESET_CSS}\n.app { color: red; }` +
        SOURCE_LINE,
    )
  })

  it("appends @source inline with the components' class names", () => {
    const css = transform(THEME_IMPORTS, "/work/app/src/app.css")!
    expect(css.endsWith(SOURCE_LINE)).toBe(true)
  })

  it("rewrites the stylesheet the dev server requests with a query", () => {
    expect(transform(THEME_IMPORTS, "/work/app/src/app.css?direct")).toContain(TOKENS_CSS)
  })

  it("leaves every other module alone", () => {
    expect(transform(THEME_IMPORTS, "/work/app/src/other.css")).toBeUndefined()
    expect(transform(THEME_IMPORTS, "/work/app/src/app.css.ts")).toBeUndefined()
  })

  it("rewrites the stylesheet the option names instead of src/app.css", () => {
    expect(transform(THEME_IMPORTS, "/work/app/styles/main.css", "/styles/main.css"))
      .toContain(TOKENS_CSS)
    expect(transform(THEME_IMPORTS, "/work/app/src/app.css", "/styles/main.css"))
      .toBeUndefined()
  })

  it("throws when the stylesheet lacks the tokens or preset import", () => {
    const noTokens = THEME_IMPORTS.replace(`@import "@spy4x/preact-theme/tokens.css";`, ``)
    const noPreset = THEME_IMPORTS.replace(`@import "@spy4x/preact-theme/preset.css";`, ``)
    expect(() => transform(noTokens, "/work/app/src/app.css")).toThrow(
      `/src/app.css must contain @import "@spy4x/preact-theme/tokens.css";`,
    )
    expect(() => transform(noPreset, "/work/app/src/app.css")).toThrow(
      `/src/app.css must contain @import "@spy4x/preact-theme/preset.css";`,
    )
  })
})

/** Runs the guard's generateBundle over `files`, each a file name and its contents. */
function generateBundle(
  files: Array<{ fileName: string; type: string; source?: string | Uint8Array }>,
  selectors?: readonly string[],
): void {
  const plugin = requireComponentCss(selectors === undefined ? {} : { selectors })
  const bundle = Object.fromEntries(files.map((file) => [file.fileName, file]))
  plugin.generateBundle!.call(pluginContext, {}, bundle)
}

const STYLED = `.lg\\:w-64{width:16rem}.focus\\:not-sr-only:focus{position:static}`

describe("requireComponentCss", () => {
  it("runs only in a build", () => {
    expect(requireComponentCss().apply).toBe("build")
  })

  it("passes a build whose CSS has the library's selectors", () => {
    generateBundle([{ fileName: "assets/app.css", type: "asset", source: STYLED }])
  })

  it("reads a CSS asset given as bytes", () => {
    generateBundle([
      { fileName: "assets/app.css", type: "asset", source: new TextEncoder().encode(STYLED) },
    ])
  })

  it("passes when the selectors are split across CSS files", () => {
    generateBundle([
      { fileName: "assets/a.css", type: "asset", source: `.lg\\:w-64{width:16rem}` },
      { fileName: "assets/b.css", type: "asset", source: `.focus\\:not-sr-only:focus{}` },
    ])
  })

  it("fails the build naming each selector the CSS lacks", () => {
    expect(() => generateBundle([{ fileName: "assets/app.css", type: "asset", source: `.btn{}` }]))
      .toThrow(`The built CSS lacks the library's classes: .lg\\:w-64, .focus\\:not-sr-only`)
  })

  it("does not count the selectors when only a script or a non-CSS asset holds them", () => {
    expect(() =>
      generateBundle([
        { fileName: "assets/app.css", type: "asset", source: `.btn{}` },
        { fileName: "assets/app.js", type: "chunk" },
        { fileName: "assets/notes.txt", type: "asset", source: STYLED },
        { fileName: "assets/fake.css", type: "chunk", source: STYLED },
      ])
    ).toThrow(`The built CSS lacks the library's classes`)
  })

  it("checks the selectors the option names instead of the defaults", () => {
    generateBundle([{ fileName: "a.css", type: "asset", source: `.x{}` }], [".x"])
    expect(() => generateBundle([{ fileName: "a.css", type: "asset", source: STYLED }], [".x"]))
      .toThrow(`lacks the library's classes: .x`)
  })
})

/** An error shaped like the one Deno's `readTextFile` rejects with for a missing file. */
function denoNotFound(): Error {
  const error = new Error(`No such file or directory`)
  error.name = "NotFound"
  return error
}

/** A file reader over `files`, rejecting a missing path the way `notFound` builds the error. */
function readerOf(
  files: Record<string, string>,
  notFound: () => unknown = denoNotFound,
): (path: string) => Promise<string> {
  return (path) => path in files ? Promise.resolve(files[path]) : Promise.reject(notFound())
}

interface ResolveSetup {
  /** What `this.resolve` answers for each bare specifier; absent means unresolved. */
  resolves: Record<string, string>
  /** The files the injected reader can read. */
  files: Record<string, string>
  /** How the reader rejects a missing file. */
  notFound?: () => unknown
  /** The environment `this.environment` returns. */
  environment?: ViteEnvironment
}

/** Runs the npm plugin's resolveId, and records what it asked `this.resolve` for. */
async function resolveId(
  source: string,
  setup: ResolveSetup,
  importer: string | undefined = "/cache/jsr/preact-ui/button.tsx",
): Promise<{ result: VitePartialResolvedId | null | undefined; asked: unknown[][] }> {
  const asked: unknown[][] = []
  const context: ViteResolveContext = {
    resolve(bare, from, options) {
      asked.push([bare, from, options])
      const id = setup.resolves[bare]
      return Promise.resolve(id === undefined ? null : { id })
    },
    environment: setup.environment ?? { name: "client" },
  }
  const plugin = npmSpecifiers({ readTextFile: readerOf(setup.files, setup.notFound) })
  const result = await plugin.resolveId!.call(context, source, importer)
  return { result, asked }
}

const SIGNALS_FILE = "/app/node_modules/@preact/signals/dist/signals.mjs"
const SIGNALS_MANIFEST = JSON.stringify({ name: "@preact/signals", version: "2.5.1" })

describe("npmSpecifiers", () => {
  it("runs before other plugins", () => {
    expect(npmSpecifiers({ readTextFile: readerOf({}) }).enforce).toBe("pre")
  })

  it("leaves a specifier without the npm: scheme to the other plugins", async () => {
    const { result, asked } = await resolveId("preact/hooks", { resolves: {}, files: {} })
    expect(result).toBeUndefined()
    expect(asked).toEqual([])
  })

  it("resolves a scoped versioned specifier to the app's copy of the bare package", async () => {
    const { result, asked } = await resolveId("npm:@preact/signals@2.5.1", {
      resolves: { "@preact/signals": SIGNALS_FILE },
      files: { "/app/node_modules/@preact/signals/package.json": SIGNALS_MANIFEST },
    })
    expect(result).toEqual({ id: SIGNALS_FILE })
    expect(asked).toEqual([
      ["@preact/signals", "/cache/jsr/preact-ui/button.tsx", { skipSelf: true }],
    ])
  })

  it("keeps the subpath of a specifier written with a leading slash", async () => {
    const file = "/app/node_modules/preact/hooks/dist/hooks.mjs"
    const { result, asked } = await resolveId("npm:/preact@10.29.8/hooks", {
      resolves: { "preact/hooks": file },
      files: {
        "/app/node_modules/preact/hooks/package.json": JSON.stringify({ name: "preact-hooks" }),
        "/app/node_modules/preact/package.json": JSON.stringify({
          name: "preact",
          version: "10.29.8",
        }),
      },
    })
    expect(result).toEqual({ id: file })
    expect(asked[0][0]).toBe("preact/hooks")
  })

  it("skips a package.json that names another package, and a directory with none", async () => {
    // Walking up from dist/esm: a bundled package's manifest, then no manifest, then the right one.
    const { result } = await resolveId("npm:@preact/signals@2.5.1", {
      resolves: { "@preact/signals": "/app/node_modules/@preact/signals/dist/esm/signals.mjs" },
      files: {
        "/app/node_modules/@preact/signals/dist/esm/package.json": JSON.stringify({
          name: "bundled-helper",
          version: "9.9.9",
        }),
        "/app/node_modules/@preact/signals/package.json": SIGNALS_MANIFEST,
      },
    })
    expect(result).toEqual({ id: "/app/node_modules/@preact/signals/dist/esm/signals.mjs" })
  })

  it("throws NpmVersionMismatchError when the app's copy is another version", async () => {
    const attempt = resolveId("npm:@preact/signals@2.4.0", {
      resolves: { "@preact/signals": SIGNALS_FILE },
      files: { "/app/node_modules/@preact/signals/package.json": SIGNALS_MANIFEST },
    })
    const error = await attempt.then(() => undefined, (error: unknown) => error)
    expect(error).toBeInstanceOf(NpmVersionMismatchError)
    expect((error as Error).message).toBe(
      "npm:@preact/signals@2.4.0 (imported by /cache/jsr/preact-ui/button.tsx) resolved to " +
        "version 2.5.1. Pin the same version in the app's deno.json, or use a library release " +
        "pinned to the app's.",
    )
  })

  it("skips the version check for a specifier that names no version", async () => {
    const { result } = await resolveId("npm:@preact/signals", {
      resolves: { "@preact/signals": SIGNALS_FILE },
      files: {},
    })
    expect(result).toEqual({ id: SIGNALS_FILE })
  })

  it("answers null when the app has no copy of the package", async () => {
    const { result } = await resolveId("npm:@preact/signals@2.5.1", { resolves: {}, files: {} })
    expect(result).toBeNull()
  })

  it("reads a dev server's pre-bundled copy's version from the optimizer's source file", async () => {
    const environment: ViteEnvironment = {
      name: "client",
      depsOptimizer: {
        metadata: {
          optimized: { "preact/hooks": { src: "/app/node_modules/preact/hooks/dist/hooks.mjs" } },
          discovered: {},
        },
      },
    }
    const setup = {
      resolves: { "preact/hooks": "/app/node_modules/.vite/deps/preact_hooks.js?v=1a2b" },
      files: {
        "/app/node_modules/preact/package.json": JSON.stringify({
          name: "preact",
          version: "10.29.8",
        }),
      },
      environment,
    }
    const { result } = await resolveId("npm:/preact@10.29.8/hooks", setup)
    expect(result).toEqual({ id: "/app/node_modules/.vite/deps/preact_hooks.js?v=1a2b" })
    const mismatch = await resolveId("npm:/preact@10.0.0/hooks", setup).catch((e: unknown) => e)
    expect(mismatch).toBeInstanceOf(NpmVersionMismatchError)
  })

  it("falls back to the optimizer's discovered record for a pre-bundled copy", async () => {
    const { result } = await resolveId("npm:preact@10.29.8", {
      resolves: { "preact": "/app/node_modules/.vite/deps/preact.js" },
      files: {
        "/app/node_modules/preact/package.json": JSON.stringify({
          name: "preact",
          version: "10.29.8",
        }),
      },
      environment: {
        name: "client",
        depsOptimizer: {
          metadata: {
            optimized: {},
            discovered: { "preact": { src: "/app/node_modules/preact/dist/preact.mjs" } },
          },
        },
      },
    })
    expect(result).toEqual({ id: "/app/node_modules/.vite/deps/preact.js" })
  })

  it("throws when the optimizer has no record of a pre-bundled copy", async () => {
    const error = await resolveId("npm:preact@10.29.8", {
      resolves: { "preact": "/app/node_modules/.vite/deps/preact.js" },
      files: {},
    }).catch((e: unknown) => e)
    expect((error as Error).message).toBe("Cannot find the source of Vite's pre-bundled preact")
  })

  it("treats Node's ENOENT like Deno's NotFound while walking up", async () => {
    const enoent = () => Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" })
    const { result } = await resolveId("npm:@preact/signals@2.5.1", {
      resolves: { "@preact/signals": "/app/node_modules/@preact/signals/dist/signals.mjs" },
      files: { "/app/node_modules/@preact/signals/package.json": SIGNALS_MANIFEST },
      notFound: enoent,
    })
    expect(result).toEqual({ id: "/app/node_modules/@preact/signals/dist/signals.mjs" })
  })

  it("fails on a read error other than a missing file", async () => {
    const denied = () => Object.assign(new Error("permission denied"), { code: "EACCES" })
    const error = await resolveId("npm:@preact/signals@2.5.1", {
      resolves: { "@preact/signals": SIGNALS_FILE },
      files: {},
      notFound: denied,
    }).catch((e: unknown) => e)
    expect((error as Error).message).toBe("permission denied")
  })

  it("throws when no package.json above the file names the package", async () => {
    const error = await resolveId("npm:@preact/signals@2.5.1", {
      resolves: { "@preact/signals": SIGNALS_FILE },
      files: {},
    }).catch((e: unknown) => e)
    expect((error as Error).message).toBe(
      `Cannot find the package.json of @preact/signals above ${SIGNALS_FILE}`,
    )
  })
})
