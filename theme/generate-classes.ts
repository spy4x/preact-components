/**
 * Regenerates `component-classes.ts`: every Tailwind class the published components can render.
 *
 * An app that installs these packages from JSR cannot point Tailwind's file scanner at them. Deno
 * keeps JSR modules in its own cache, under hashed names, not in `node_modules`, and inside the
 * `denoland/deno:alpine-*` images the scanner reads none of those files at all (#323). So the
 * library scans its own sources here, once, and ships the result as a string an app hands to
 * `@source inline("…")` — no scan of the library happens in the app's build.
 *
 * The list comes from the same Rust scanner `pages/build.ts` uses (`@tailwindcss/oxide`), over
 * every file each published package uploads (its `.ts`/`.tsx` files minus its `publish.exclude`).
 * The scanner reports every word that could be a class; the list keeps only the words Tailwind
 * compiles to CSS against `tailwindcss` plus this package's `tokens.css`, `ink.css` and
 * `preset.css`, the same stylesheets an app compiles against. That drops prose and identifiers
 * and keeps the preset's own utilities (`btn`, `pc-card`, …), which are `@utility` rules and so are
 * emitted only when named.
 *
 * Run it after changing a class in any package:
 *
 * ```bash
 * deno task --cwd theme generate
 * ```
 *
 * `component-classes.test.ts` fails when the committed list and this script's output differ.
 */

import { Scanner } from "@tailwindcss/oxide"
import { __unstable__loadDesignSystem } from "tailwindcss"
import { fileURLToPath } from "node:url"
import { memberConfig, readConfig, workspaceMembers } from "../infra/scripts/workspace.ts"
import { stylesheetLoader } from "./integration/load-stylesheet.ts"

/** The Tailwind version the root import map pins; the stylesheets are resolved at it. */
const TAILWIND_VERSION = "4.1.12"

/** The repository root, as a directory URL. */
const ROOT = new URL("../", import.meta.url)

/** The generated module, relative to this file. */
export const GENERATED_FILE = "./component-classes.ts"

/**
 * Characters that cannot sit inside `@source inline("…")` as written: `"` and `\` end or escape
 * the CSS string, and Tailwind expands `{a,b}` inside it as a brace pattern.
 */
const UNSAFE_IN_INLINE = /["\\{}]/

/** One `@source` entry, in the shape the scanner takes. */
interface SourceEntry {
  /** Directory the pattern is relative to. */
  base: string
  /** Glob pattern, relative to {@link base}. */
  pattern: string
  /** Whether the entry excludes what it matches. */
  negated: boolean
}

/**
 * The directories of every published package except this one.
 *
 * A published package is a workspace member whose `deno.json` has a `name` (`pages/` has
 * none). `theme/` itself is left out: its classes are defined in its CSS, and scanning it would
 * scan the generated list too.
 *
 * @returns Each package's directory name and its `publish.exclude` patterns, sorted by name.
 */
export async function publishedPackages(): Promise<{ id: string; exclude: string[] }[]> {
  const packages: { id: string; exclude: string[] }[] = []
  for (const id of await workspaceMembers()) {
    if (id === "theme") continue
    const config = await readConfig(await memberConfig(id))
    if (!config.name) continue
    packages.push({ id, exclude: config.publish?.exclude ?? [] })
  }
  return packages.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Turn one `publish.exclude` entry into a negated scanner pattern: `probe/` excludes everything
 * under that directory, anything else is a glob as written.
 */
function excludePattern(pattern: string): string {
  return pattern.endsWith("/") ? `${pattern}**/*` : pattern
}

/**
 * The characters after which a `/` starts a regular expression rather than a division: an operator
 * or an opening bracket, or the start of the text.
 */
const REGEX_BEFORE = /[(,=:[!&|?{};+\-*%<>~^]$/

/**
 * A source with every `//` and `/* *\/` comment blanked out, so a class a JSDoc only mentions is
 * not scanned as one a component renders. Each comment character becomes a space and every line
 * break is kept, so the scanner sees the code where it was.
 *
 * Strings, template literals (with their `${…}` parts) and regular expressions are copied as they
 * are, so a `//` in a URL survives. A quote or backtick in JSX text is read as starting a string;
 * a quoted string never crosses a line break, so such a misread ends at the end of its line and
 * only keeps text, never drops it.
 *
 * @param source A `.ts` or `.tsx` module's text.
 */
export function stripComments(source: string): string {
  let out = ""
  let i = 0
  /** Template literal depth: each entry counts the open braces inside one `${…}`. */
  const templates: number[] = []
  const lastCode = () => out.trimEnd().slice(-1)

  /** Copies a quoted string from `i`, which is at its quote, up to its end or the line's. */
  const copyString = (quote: string) => {
    const start = i++
    while (i < source.length && source[i] !== quote && source[i] !== "\n") {
      i += source[i] === "\\" ? 2 : 1
    }
    if (source[i] === quote) i++
    out += source.slice(start, i)
  }

  /** Copies template text from `i` up to the closing backtick or the next `${`. */
  const copyTemplateText = () => {
    const start = i
    while (i < source.length && source[i] !== "`" && !source.startsWith("${", i)) {
      i += source[i] === "\\" ? 2 : 1
    }
    if (source[i] === "`") i++
    else if (i < source.length) {
      i += 2
      templates.push(0)
    }
    out += source.slice(start, i)
  }

  while (i < source.length) {
    const char = source[i]
    if (source.startsWith("//", i)) {
      while (i < source.length && source[i] !== "\n") {
        out += " "
        i++
      }
    } else if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2)
      const stop = end === -1 ? source.length : end + 2
      out += source.slice(i, stop).replace(/[^\n]/g, " ")
      i = stop
    } else if (char === '"' || char === "'") {
      copyString(char)
    } else if (char === "`") {
      out += char
      i++
      copyTemplateText()
    } else if (char === "/" && (lastCode() === "" || REGEX_BEFORE.test(lastCode()))) {
      const start = i++
      let inClass = false
      while (i < source.length && source[i] !== "\n" && (inClass || source[i] !== "/")) {
        if (source[i] === "[") inClass = true
        else if (source[i] === "]") inClass = false
        i += source[i] === "\\" ? 2 : 1
      }
      i++
      out += source.slice(start, i)
    } else if (templates.length > 0 && char === "{") {
      templates[templates.length - 1]++
      out += char
      i++
    } else if (templates.length > 0 && char === "}") {
      out += char
      i++
      if (templates[templates.length - 1]-- === 0) {
        templates.pop()
        copyTemplateText()
      }
    } else {
      out += char
      i++
    }
  }
  return out
}

/**
 * Scan every published package's shipped `.ts`/`.tsx` files, comments left out.
 *
 * @returns Every candidate the scanner reports, unfiltered.
 */
export async function scanCandidates(): Promise<string[]> {
  const sources: SourceEntry[] = []
  for (const { id, exclude } of await publishedPackages()) {
    const base = fileURLToPath(new URL(id, ROOT))
    sources.push({ base, pattern: "**/*.{ts,tsx}", negated: false })
    for (const pattern of exclude) {
      sources.push({ base, pattern: excludePattern(pattern), negated: true })
    }
  }
  const files = new Scanner({ sources }).files
  if (files.length === 0) throw new Error("the scanner found no published source file")
  const contents = await Promise.all(files.map(async (file) => ({
    content: stripComments(await Deno.readTextFile(file)),
    extension: file.slice(file.lastIndexOf(".") + 1),
  })))
  return new Scanner({}).scanFiles(contents)
}

/**
 * Keep the candidates Tailwind compiles to CSS against the stylesheets an app uses.
 *
 * @param candidates Scanner output.
 * @returns The classes that produce CSS, deduplicated and sorted.
 * @throws When a class that produces CSS contains a character `@source inline` cannot carry.
 */
export async function keepClasses(candidates: string[]): Promise<string[]> {
  const theme = fileURLToPath(new URL("./", import.meta.url))
  const entry = `@import "tailwindcss";\n@import "./tokens.css";\n@import "./ink.css";\n` +
    `@import "./preset.css";\n`
  const system = await __unstable__loadDesignSystem(entry, {
    base: theme,
    loadStylesheet: stylesheetLoader(TAILWIND_VERSION),
  })
  const unique = [...new Set(candidates)]
  const css = system.candidatesToCss(unique)
  const classes = unique.filter((_, index) => css[index] !== null)
  const unsafe = classes.filter((name) => UNSAFE_IN_INLINE.test(name))
  if (unsafe.length > 0) {
    throw new Error(`these classes cannot be written inside @source inline("…"): ${unsafe}`)
  }
  return classes.sort()
}

/** Every class the published components can render, as the generated module lists them. */
export async function componentClasses(): Promise<string[]> {
  return keepClasses(await scanCandidates())
}

/**
 * The generated module's source text for a class list.
 *
 * @param classes The classes, already sorted.
 * @returns Module text, before `deno fmt`.
 */
export function renderModule(classes: string[]): string {
  return `// AUTO-GENERATED by generate-classes.ts from every published package's sources — do not edit
// by hand. Run \`deno task --cwd theme generate\` after changing a class; see
// component-classes.test.ts.

/**
 * Every Tailwind class the published \`@spy4x/preact-*\` components can render, separated by
 * spaces, for an app's \`@source inline("…")\` (${classes.length} classes). See README.md →
 * "Install".
 */
export const COMPONENT_CLASSES: string = ${JSON.stringify(classes.join(" "))}
`
}

if (import.meta.main) {
  const classes = await componentClasses()
  await Deno.writeTextFile(new URL(GENERATED_FILE, import.meta.url), renderModule(classes))
  console.log(`generated component-classes.ts: ${classes.length} classes`)
}
