/**
 * Holds this repository's own packages to the spacing scale (#331): every padding, margin, gap,
 * `space-x/y` and scroll margin/padding class in them uses a step from `SPACING_STEPS`, never an
 * arbitrary value. There is no allow-list: a component that needs an off-scale value takes the
 * nearest step. `docs/spacing.md` has the rule; `@spy4x/preact-theme/spacing` has the checker.
 *
 * It reads every `.ts`, `.tsx` and `.css` file of the covered packages, test files excepted: a
 * test asserts on classes, and the checker's own test has to spell out the classes it must
 * report. What a test asserts still has to match the component, so a test file cannot keep an
 * off-scale class the component no longer renders.
 *
 * `ui-guide/` and `pages/` joined with #328, which redesigns the guide. The section files the
 * redesign's later pull requests rewrite still carry off-scale values; they are listed in
 * {@link OFF_SCALE_UNTIL_328}, one line per file, and each of those pull requests deletes its own
 * line. The list must be empty before #328 closes.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { findOffScaleSpacing } from "../../theme/spacing.ts"

/** The packages the scale covers today. */
export const SPACING_PACKAGES = [
  "theme",
  "ui",
  "system",
  "crud",
  "charts",
  "map",
  "ui-guide",
  "pages",
] as const

/**
 * Files that still carry off-scale spacing while #328 moves the guide's sections to the new design,
 * one per line so each section's pull request deletes only its own. Temporary: it must be empty
 * before #328 closes, and a listed file that has become clean fails the test, so the list only
 * shrinks.
 */
export const OFF_SCALE_UNTIL_328: readonly string[] = [
  "ui-guide/sections/display.tsx",
  "ui-guide/sections/feedback.tsx",
  "ui-guide/sections/forms.tsx",
  "ui-guide/sections/inputs.tsx",
  "ui-guide/sections/theme-examples.tsx",
]

/** Build output under a covered directory: generated, not source. */
const SKIPPED_DIRECTORIES = ["pages/dist"]

const ROOT = new URL("../../", import.meta.url)

/**
 * Files `deno task --cwd theme generate` writes from other files: the CSS mirrors carry the text of
 * the `.css` files this test reads anyway, and `component-classes.ts` lists the classes of every
 * published package, which this test reads in their own sources.
 */
const GENERATED = [
  "theme/tokens-css.ts",
  "theme/preset-css.ts",
  "theme/ink-css.ts",
  "theme/component-classes.ts",
]

/** Whether `path` is a source file the check reads. */
function isChecked(path: string): boolean {
  return /\.(ts|tsx|css)$/.test(path) && !/\.test\.tsx?$/.test(path) && !GENERATED.includes(path)
}

/** Every checked file under `directory`, as a path relative to the repository root, sorted. */
async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  for await (const entry of Deno.readDir(new URL(`${directory}/`, ROOT))) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory && SKIPPED_DIRECTORIES.includes(path)) continue
    if (entry.isDirectory) files.push(...await sourceFiles(path))
    else if (entry.isFile && isChecked(path)) files.push(path)
  }
  return files.sort()
}

/** Reads a file by its path relative to the repository root. */
function readSource(path: string): Promise<string> {
  return Deno.readTextFile(new URL(path, ROOT))
}

/** One line per off-scale class in `files`: `path:line:column class — reason`. */
async function offScale(
  files: string[],
  read: (path: string) => Promise<string> = readSource,
): Promise<string[]> {
  const found: string[] = []
  for (const path of files) {
    const text = await read(path)
    for (const { line, column, className, reason } of findOffScaleSpacing(text)) {
      found.push(`${path}:${line}:${column} ${className} — ${reason}`)
    }
  }
  return found
}

describe("spacing scale", () => {
  it("finds no spacing class off the scale in the covered packages", async () => {
    const files = (await Promise.all(SPACING_PACKAGES.map(sourceFiles))).flat()
      .filter((path) => !OFF_SCALE_UNTIL_328.includes(path))
    expect(await offScale(files)).toEqual([])
  })

  it("lists only files that still carry an off-scale value until #328 closes", async () => {
    const clean: string[] = []
    for (const path of OFF_SCALE_UNTIL_328) {
      if ((await offScale([path])).length === 0) clean.push(path)
    }
    expect(clean, "these files are on the scale now: delete their lines").toEqual([])
  })

  it("reads the components and the preset, and skips test files and generated files", async () => {
    const files = (await Promise.all(SPACING_PACKAGES.map(sourceFiles))).flat()
    for (
      const path of [
        "theme/preset.css",
        "theme/spacing.ts",
        "ui/button.tsx",
        "system/rail-shell.tsx",
        "crud/crud-list.tsx",
        "charts/line-chart.tsx",
        "map/map.tsx",
        "ui-guide/shell.tsx",
        "ui-guide/card.tsx",
        "pages/src/app.tsx",
      ]
    ) {
      expect(files).toContain(path)
    }
    expect(files.filter((path) => path.includes(".test."))).toEqual([])
    expect(files.filter((path) => GENERATED.includes(path))).toEqual([])
    expect(files.filter((path) => path.startsWith("pages/dist/"))).toEqual([])
  })

  it("names the file, line, column, class and reason of each off-scale value", async () => {
    const sources: Record<string, string> = {
      "ui/a.tsx": `export const A = <div class="p-4" />`,
      "ui/b.tsx": `export const B = <div class="gap-2" />\nexport const C = <p class="sm:mt-5" />`,
    }
    expect(await offScale(Object.keys(sources), (path) => Promise.resolve(sources[path])))
      .toEqual([
        "ui/b.tsx:2:28 sm:mt-5 — step 5 is not on the scale (0 px 1 2 3 4 6 8 12 16)",
      ])
  })
})
