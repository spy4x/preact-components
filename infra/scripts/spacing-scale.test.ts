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
 * redesign's later pull requests rewrite still carry off-scale values; each says so in its own
 * first line, {@link OFF_SCALE_MARKER}, and the pull request that moves the file to the scale
 * deletes that line. The marker lives in the file rather than in a list here, so two pull requests
 * that each clear one file never edit the same lines. No file may carry it once #328 closes.
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
 * The line a file carries while it still has off-scale spacing and waits for #328 to move it to
 * the new design. Temporary: a marked file that has become clean fails the test, so a marker only
 * ever goes away, and none may be left when #328 closes.
 */
export const OFF_SCALE_MARKER = /^\/\/ spacing: off-scale until #328\b/m

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

/** The covered files that carry {@link OFF_SCALE_MARKER}. */
async function markedFiles(files: string[]): Promise<string[]> {
  const marked: string[] = []
  for (const path of files) {
    if (OFF_SCALE_MARKER.test(await readSource(path))) marked.push(path)
  }
  return marked
}

describe("spacing scale", () => {
  it("finds no spacing class off the scale in the covered packages", async () => {
    const files = (await Promise.all(SPACING_PACKAGES.map(sourceFiles))).flat()
    const marked = await markedFiles(files)
    expect(await offScale(files.filter((path) => !marked.includes(path)))).toEqual([])
  })

  it("marks only files that still carry an off-scale value until #328 closes", async () => {
    const files = (await Promise.all(SPACING_PACKAGES.map(sourceFiles))).flat()
    const clean: string[] = []
    for (const path of await markedFiles(files)) {
      if ((await offScale([path])).length === 0) clean.push(path)
    }
    expect(clean, "these files are on the scale now: delete their marker line").toEqual([])
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
