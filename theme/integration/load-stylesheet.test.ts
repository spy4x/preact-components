import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { fileURLToPath } from "node:url"
import {
  chooseCachedVersion,
  resetStylesheetCache,
  resolveStylesheetPath,
  type StylesheetLoader,
  stylesheetLoader,
  tailwindPackageRoot,
} from "./load-stylesheet.ts"

/** Must stay in step with the `tailwindcss` pin in the repo root `deno.jsonc`. */
const VERSION = "4.1.12"

const PRESET = fileURLToPath(new URL("../preset.css", import.meta.url))
const TOKENS = fileURLToPath(new URL("../tokens.css", import.meta.url))
/** This package: `<worktree>/theme/`. */
const PACKAGE_DIRECTORY = fileURLToPath(new URL("../../", import.meta.url))
/** The shipped stylesheets: `<worktree>/theme/theme/`. */
const THEME_DIRECTORY = fileURLToPath(new URL("../", import.meta.url))

describe("chooseCachedVersion", () => {
  it("prefers the requested version over a newer cached one", () => {
    expect(chooseCachedVersion(["4.1.8", "4.1.12"], "4.1.8")).toBe("4.1.8")
  })

  it("compares versions numerically, not as strings", () => {
    expect(chooseCachedVersion(["4.1.9", "4.1.12"], "4.2.0")).toBe("4.1.12")
  })

  it("falls back to the highest cached version when none is requested", () => {
    expect(chooseCachedVersion(["4.1.12", "4.1.8"])).toBe("4.1.12")
  })

  it("throws when the cache holds no version of the package", () => {
    expect(() => chooseCachedVersion([], "4.1.12")).toThrow(
      "no tailwindcss in the Deno npm cache",
    )
  })
})

describe("resolveStylesheetPath", () => {
  it("resolves a relative import against the importing stylesheet", () => {
    expect(resolveStylesheetPath("./tokens.css", PRESET, VERSION)).toBe(TOKENS)
  })

  it("resolves a relative import when the reader is handed a directory", () => {
    expect(resolveStylesheetPath("./tokens.css", THEME_DIRECTORY, VERSION)).toBe(TOKENS)
  })

  it("resolves a parent-relative import out of the importing directory", () => {
    // `theme/theme/` -> up one -> `theme/`, where the test helper lives.
    expect(resolveStylesheetPath("../integration/load-stylesheet.ts", THEME_DIRECTORY, VERSION))
      .toBe(`${PACKAGE_DIRECTORY}integration/load-stylesheet.ts`)
  })

  it("resolves a file URL the compiler passes back", () => {
    const presetUrl = new URL("../preset.css", import.meta.url).href
    expect(resolveStylesheetPath(presetUrl, PRESET, VERSION)).toBe(PRESET)
  })

  it("rejects a bare id that is not a Tailwind asset", () => {
    expect(() => resolveStylesheetPath("@tailwindcss/forms", PRESET, VERSION)).toThrow(
      "only tailwindcss assets are supported",
    )
  })
})

describe("stylesheets that resolve through the Tailwind cache", () => {
  it("resolves Tailwind's own entrypoint", () => {
    const path = resolveStylesheetPath("tailwindcss", PRESET, VERSION)
    expect(path.endsWith(`/tailwindcss/${VERSION}/index.css`)).toBe(true)
  })

  it("resolves a Tailwind subpath", () => {
    const path = resolveStylesheetPath("tailwindcss/preflight.css", PRESET, VERSION)
    expect(path.endsWith(`/tailwindcss/${VERSION}/preflight.css`)).toBe(true)
  })

  it("finds the pinned version in the Deno npm cache", () => {
    expect(tailwindPackageRoot(VERSION).endsWith(`/tailwindcss/${VERSION}`))
      .toBe(true)
  })

  it("resolves the package exactly where deno resolves it", () => {
    // Regression guard: the root used to be built from `HOME`
    // (`${HOME}/.cache/deno/npm/registry.npmjs.org/...`), which ignores `DENO_DIR`
    // and therefore misses the cache in CI. Deno's own resolution always names
    // the installed copy, whatever `DENO_DIR` and `HOME` point at.
    const manifest = fileURLToPath(import.meta.resolve("tailwindcss/package.json"))
    expect(tailwindPackageRoot(VERSION)).toBe(manifest.slice(0, manifest.lastIndexOf("/")))
  })

  it("returns a directory holding the assets the preset imports", () => {
    const root = tailwindPackageRoot(VERSION)
    for (const asset of ["package.json", "theme.css", "preflight.css", "utilities.css"]) {
      expect(Deno.statSync(`${root}/${asset}`).isFile).toBe(true)
    }
  })

  it("falls back to a cached version when the requested one is absent", () => {
    const root = tailwindPackageRoot("0.0.1-not-cached")
    expect(root).toContain("/registry.npmjs.org/tailwindcss/")
    expect(Deno.statSync(`${root}/package.json`).isFile).toBe(true)
  })

  it("memoises the package location across resolutions", () => {
    resetStylesheetCache()
    const first = resolveStylesheetPath("tailwindcss", PRESET, VERSION)
    const second = resolveStylesheetPath("tailwindcss/preflight.css", PRESET, VERSION)
    expect(first.replace("index.css", "preflight.css")).toBe(second)
  })

  it("returns a function the compiler can call", () => {
    const load: StylesheetLoader = stylesheetLoader(VERSION)
    expect(typeof load).toBe("function")
  })

  it("reads the bytes of the resolved stylesheet", async () => {
    const loaded = await stylesheetLoader(VERSION)("./tokens.css", PRESET)
    expect(loaded.path).toBe(TOKENS)
    expect(loaded.content).toContain("--color-primary")
  })

  it("rejects a stylesheet that does not exist", async () => {
    await expect(stylesheetLoader(VERSION)("./nope.css", PRESET)).rejects.toThrow()
  })

  it("refuses a relative import with no base path", async () => {
    await expect(stylesheetLoader(VERSION)("./tokens.css", "")).rejects.toThrow(
      "without a base path",
    )
  })
})
