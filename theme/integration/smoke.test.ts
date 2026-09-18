import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { compile } from "tailwindcss"
import { fileURLToPath } from "node:url"
import { stylesheetLoader } from "./load-stylesheet.ts"
import { canCompile, SKIP_REASON } from "./permissions.ts"

/** Must stay in step with the `tailwindcss` pin in the repo root `deno.jsonc`. */
const TAILWIND_VERSION = "4.1.12"

const THEME_DIRECTORY = fileURLToPath(new URL("../", import.meta.url))

/**
 * The stylesheet an app writes, plus Tailwind's own internals.
 *
 * `@import "tailwindcss"` expands to `theme.css` + `preflight.css` + the
 * `utilities` layer, in that order. This suite compiles from the package
 * directory rather than through a build tool, so the three are imported by name
 * and Tailwind's `index.css` — which contains all three — is never read. That
 * keeps the assertion trail short: everything the preset emits is reachable
 * from the preset.
 *
 * @param documentsCss Extra CSS placed between the tokens and the preset, where
 *   an app's own overrides go.
 * @returns The stylesheet to compile.
 */
function entrypointCss(documentsCss = ""): string {
  return `@import "tailwindcss/theme.css";\n` +
    `@import "tailwindcss/preflight.css";\n` +
    `@import "./tokens.css";\n` +
    `${documentsCss}` +
    `@import "./preset.css";\n` +
    `@import "tailwindcss/utilities.css";\n`
}

/**
 * Compile the shipped preset with Tailwind 4 and emit only `candidates`.
 *
 * The stylesheets are read inside the test rather than at module scope, so a
 * permission-less run reaches `it.skip` instead of dying on an import.
 *
 * @param css Entrypoint stylesheet, as an app would write it.
 * @param candidates Class names to emit.
 * @param requiredStylesheets Basenames the compiler must have read.
 * @returns The compiled CSS.
 * @throws If the compiler skipped a required stylesheet.
 */
async function compilePreset(
  css: string,
  candidates: string[],
  requiredStylesheets = ["tokens.css", "preset.css"],
): Promise<string> {
  const imported = new Set<string>()
  const load = stylesheetLoader(TAILWIND_VERSION)
  const compiler = await compile(css, {
    // Tailwind only hands the loader a base path when `base` is set here; it
    // ignores `from` for that purpose, and the loader refuses an empty base.
    base: THEME_DIRECTORY,
    async loadStylesheet(id, base) {
      const stylesheet = await load(id, base)
      imported.add(stylesheet.path)
      return stylesheet
    },
    // Reached only by `@plugin` and `@config`, which the preset does not use.
    loadModule() {
      throw new Error("the theme preset loads no JavaScript modules")
    },
  })

  for (const name of requiredStylesheets) {
    if (!imported.has(`${THEME_DIRECTORY}${name}`)) {
      throw new Error(`the compiler did not read ${name}`)
    }
  }

  return compiler.build(candidates)
}

/** Every class the preset is expected to emit, standing in for component output. */
const CANDIDATES = [
  "bg-canvas",
  "bg-danger",
  "bg-primary",
  "bg-surface",
  "bg-success",
  "bg-warning",
  "bar",
  "border-control",
  "border-primary",
  "border-subtle",
  "btn",
  "btn-danger",
  "btn-danger-outline",
  "btn-disabled",
  "btn-icon",
  "btn-input-icon",
  "btn-link",
  "btn-primary",
  "btn-primary-outline",
  "btn-success",
  "btn-success-outline",
  "btn-warning",
  "btn-warning-outline",
  "card",
  "card-body",
  "card-footer",
  "card-header",
  "checkbox",
  "dark:btn-primary",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "input",
  "kpi",
  "kpi-label",
  "kpi-value",
  "label",
  "link",
  "list-ul",
  "num",
  "page-layout",
  "radio",
  "rounded-primary",
  "scrollbar",
  "select",
  "text-danger",
  "text-muted",
  "text-primary",
  "text-success",
  "text-warning",
  "textarea",
  "theme-base",
]

/** The declarations of the first rule matching `selector`, for substring asserts. */
function declarationsOf(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) {
    throw new Error(`${selector} is not in the compiled output`)
  }

  return css.slice(start, css.indexOf("}", start))
}

if (!await canCompile()) {
  describe("theme preset", () => {
    it.skip(SKIP_REASON, () => {})
  })
} else {
  describe("theme preset", () => {
    /*
     * Compiled once for the whole suite. Memoised as a promise rather than
     * awaited at module scope: bdd's `describe` callback is synchronous, and the
     * compile must not run before the permission gate above has passed.
     */
    let compiled: Promise<string> | undefined
    const preset = () => {
      compiled = compiled ?? compilePreset(entrypointCss(), CANDIDATES)
      return compiled
    }

    it("emits every class the components style against", async () => {
      const css = await preset()
      for (const candidate of CANDIDATES) {
        const selector = `.${candidate.replace("dark:", "")}`
        expect(css, `missing ${selector}`).toContain(selector)
      }
    })

    it("emits declarations for a button, not an empty rule", async () => {
      const css = await preset()
      const rule = css.slice(css.indexOf(".btn {"))
      expect(rule).toContain("display: flex")
      expect(rule).toContain("border-radius: var(--radius-primary, 0.5rem)")
    })

    it("colours atoms from tokens instead of literal palette values", async () => {
      const css = await preset()
      expect(declarationsOf(css, ".bg-primary")).toContain(
        "var(--color-primary, oklch(0.38 0.17 293))",
      )
      expect(declarationsOf(css, ".text-primary")).toContain("var(--color-primary-muted, ")
      expect(declarationsOf(css, ".card")).toContain("var(--color-surface, oklch(1 0 0))")
      expect(declarationsOf(css, ".input")).toContain("var(--color-border-control, ")
    })

    it("composes select from the input atom", async () => {
      expect(declarationsOf(await preset(), ".select")).toContain(
        "height: calc(var(--spacing) * 12)",
      )
    })

    it("scopes the dark variant to the .dark class", async () => {
      expect(await preset()).toContain("&:where(.dark, .dark *)")
    })

    it("emits the disabled and focus-visible states of a button", async () => {
      const css = await preset()
      const btn = css.slice(css.indexOf(".btn {"))
      expect(btn).toContain("&:disabled")
      expect(btn).toContain("cursor: not-allowed")
      expect(btn).toContain("&:focus-visible")
      expect(btn).toContain("outline-width: 2px")
    })

    it("emits the scrollbar vendor pseudos and the blink keyframes", async () => {
      const css = await preset()
      expect(css).toContain("&::-webkit-scrollbar-thumb")
      expect(css).toContain("@keyframes blink")
    })

    it("emits the map status rules", async () => {
      expect(declarationsOf(await preset(), ".status-on .map-marker")).toContain(
        "var(--color-success, ",
      )
    })

    it("keeps the document rules opt-in behind .theme-base", async () => {
      const css = await preset()
      expect(css).toContain(".theme-base")
      expect(css).not.toContain("html {")
    })

    it("lets an app override a token with a later declaration", async () => {
      const overridden = await compilePreset(
        entrypointCss(":root {\n  --color-primary: oklch(0.55 0.18 255);\n}\n"),
        ["bg-primary"],
      )
      // The app's declaration survives compilation, and the utility still
      // resolves through the variable, so the new value reaches it.
      expect(overridden).toContain("--color-primary: oklch(0.55 0.18 255)")
      expect(declarationsOf(overridden, ".bg-primary")).toContain(
        "var(--color-primary, oklch(0.38 0.17 293))",
      )
    })

    it("keeps working when an app skips tokens.css", async () => {
      const withoutTokens = await compilePreset(
        `@import "tailwindcss/theme.css";\n@import "tailwindcss/preflight.css";\n` +
          `@import "./preset.css";\n@import "tailwindcss/utilities.css";\n`,
        ["bg-primary", "btn"],
        ["preset.css"],
      )
      expect(declarationsOf(withoutTokens, ".bg-primary")).toContain(
        "var(--color-primary, oklch(0.38 0.17 293))",
      )
    })

    it("ships light tokens in :root and dark tokens on .dark", async () => {
      const css = await preset()
      expect(css).toContain("--radius-primary: 0.5rem")
      expect(css.slice(css.lastIndexOf(".dark {"))).toContain("--color-primary:")
    })

    it("does not ship a utility with no declarations", async () => {
      expect(/\.[a-z][a-z0-9-]* \{\s*\}/.test(await preset())).toBe(false)
    })
  })
}
