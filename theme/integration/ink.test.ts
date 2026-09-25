/**
 * Compiles the ink theme with the real Tailwind 4 compiler, the same way `smoke.test.ts` compiles
 * the default preset — proof that `[data-theme="ink"]` is valid CSS Tailwind can build, not merely
 * text that looks right.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { compile } from "tailwindcss"
import { fileURLToPath } from "node:url"
import { stylesheetLoader } from "./load-stylesheet.ts"

/** Must stay in step with the `tailwindcss` pin in the repo root `deno.jsonc`. */
const TAILWIND_VERSION = "4.1.12"

const THEME_DIRECTORY = fileURLToPath(new URL("../", import.meta.url))

/**
 * Compile `tokens.css` + `ink.css` + `preset.css`, and confirm the compiler actually read all
 * three — a typo in an `@import` id fails silently otherwise, resolving to nothing rather than to
 * an error.
 *
 * @param candidates Class names to emit.
 * @returns The compiled CSS.
 */
async function compileInk(candidates: string[]): Promise<string> {
  const imported = new Set<string>()
  const load = stylesheetLoader(TAILWIND_VERSION)
  const css = `@import "tailwindcss/theme.css";\n` +
    `@import "tailwindcss/preflight.css";\n` +
    `@import "./tokens.css";\n` +
    `@import "./ink.css";\n` +
    `@import "./preset.css";\n` +
    `@import "tailwindcss/utilities.css";\n`

  const compiler = await compile(css, {
    base: THEME_DIRECTORY,
    async loadStylesheet(id, base) {
      const stylesheet = await load(id, base)
      imported.add(stylesheet.path)
      return stylesheet
    },
    loadModule() {
      throw new Error("the ink theme loads no JavaScript modules")
    },
  })

  for (const name of ["tokens.css", "ink.css", "preset.css"]) {
    if (!imported.has(`${THEME_DIRECTORY}${name}`)) {
      throw new Error(`the compiler did not read ${name}`)
    }
  }

  return compiler.build(candidates)
}

describe("the ink theme", () => {
  it("compiles through the real Tailwind compiler", async () => {
    const css = await compileInk(["btn", "btn-primary", "card", "bg-canvas", "bg-primary"])
    expect(css).toContain('.dark[data-theme="ink"]')
  })

  it("carries the surface scale, hairline, text-tone, nav-active and focus tokens", async () => {
    const css = await compileInk(["btn-primary"])
    const rule = css.slice(
      css.indexOf('.dark[data-theme="ink"]'),
      css.indexOf("}", css.indexOf('.dark[data-theme="ink"]')) + 1,
    )
    for (
      const token of [
        "--color-surface-page",
        "--color-surface-rail",
        "--color-surface-card",
        "--color-surface-active",
        "--color-hairline",
        "--color-text",
        "--color-text-muted",
        "--color-nav-active",
        "--color-focus-ring",
      ]
    ) {
      expect(rule, `missing ${token}`).toContain(token)
    }
  })

  it("repaints .btn-primary's fill without any change to preset.css", async () => {
    const css = await compileInk(["btn", "btn-primary"])
    const rule = css.slice(
      css.indexOf(".btn-primary {"),
      css.indexOf("}", css.indexOf(".btn-primary {")),
    )
    expect(rule).toContain("var(--color-primary,")
  })
})
