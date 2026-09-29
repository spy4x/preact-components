/**
 * Holds this repository's components to the theme's colour tokens (#417): no class in a package's
 * source names a step of the gray, slate, zinc, neutral or stone palette, or `white` or `black`,
 * because a fixed colour ignores the tokens an app sets. `theme/README.md` → "Replacing fixed
 * colours" says which token replaces each class.
 *
 * Packages still holding such classes are in {@link ALLOWED}. That list may only shrink: a lane
 * that converts a file removes it here, the test fails when a listed file no longer has a fixed
 * colour, and it fails on any file that is not listed. Never add a file to the list.
 *
 * It reads every `.ts`, `.tsx` and `.css` file of the covered packages, test files excepted, and
 * skips the generated mirrors of the theme's CSS.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { findFixedColours } from "../../theme/fixed-colours.ts"

/** The packages covered. `pages` is the demo app and stays out. */
const PACKAGES = ["theme", "ui", "system", "crud", "charts", "map", "ui-guide"] as const

/** Generated from other files, or the checker's own text: not source a component reads. */
const SKIPPED = [
  "theme/tokens-css.ts",
  "theme/preset-css.ts",
  "theme/ink-css.ts",
  "theme/component-classes.ts",
  "theme/fixed-colours.ts",
]

/**
 * Files that still hold a fixed colour class. This list may only shrink: remove a file when its
 * classes move to tokens, and never add one.
 */
export const ALLOWED: readonly string[] = [
  "theme/preset.css",
  // The colour-atoms demo paints a white label on every fill it shows, whatever token the fill is.
  "ui-guide/sections/surfaces.tsx",
  "ui/avatar.tsx",
  "ui/badge.tsx",
  "ui/button.tsx",
  "ui/combobox.tsx",
  "ui/confirm-dialog.tsx",
  "ui/data-table.tsx",
  "ui/date-range-picker.tsx",
  "ui/dropdown.tsx",
  "ui/empty-state.tsx",
  "ui/enhanced-form.tsx",
  "ui/field.tsx",
  "ui/file-input.tsx",
  "ui/image-gallery.tsx",
  "ui/inline-edit.tsx",
  "ui/kanban-board.tsx",
  "ui/kbd.tsx",
  "ui/lightbox.tsx",
  "ui/loading-skeleton.tsx",
  "ui/loading-spinner.tsx",
  "ui/modal.tsx",
  "ui/page-title.tsx",
  "ui/pagination.tsx",
  "ui/progress.tsx",
  "ui/shortcuts-dialog.tsx",
  "ui/table.tsx",
  "ui/tabs.tsx",
  "ui/toastr.tsx",
  "ui/toggle-chips.tsx",
  "ui/toggle-field.tsx",
  "ui/toggle-switch.tsx",
  "ui/tooltip.tsx",
]

const ROOT = new URL("../../", import.meta.url)

/** Every checked file under `directory`, relative to the repository root, sorted. */
async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  for await (const entry of Deno.readDir(new URL(`${directory}/`, ROOT))) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory) files.push(...await sourceFiles(path))
    else if (
      entry.isFile && /\.(ts|tsx|css)$/.test(path) && !/\.test\.tsx?$/.test(path) &&
      !SKIPPED.includes(path)
    ) files.push(path)
  }
  return files.sort()
}

/**
 * How many files {@link ALLOWED} names. Adding a file to the list fails here until someone changes
 * this number on purpose; the number may only go down, and a lane that converts a file lowers it
 * with the list.
 */
const ALLOWED_COUNT = 33

describe("fixed colour classes in component source", () => {
  it("has an allow-list that has not grown", () => {
    expect(ALLOWED.length).toBe(ALLOWED_COUNT)
  })

  it("appear only in files the allow-list names", async () => {
    const offenders: string[] = []
    for (const directory of PACKAGES) {
      for (const path of await sourceFiles(directory)) {
        if (ALLOWED.includes(path)) continue
        const found = findFixedColours(await Deno.readTextFile(new URL(path, ROOT)))
        for (const { line, className } of found) offenders.push(`${path}:${line} ${className}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("are still in every file the allow-list names", async () => {
    const stale: string[] = []
    for (const path of ALLOWED) {
      const text = await Deno.readTextFile(new URL(path, ROOT))
      if (findFixedColours(text).length === 0) stale.push(path)
    }
    expect(stale).toEqual([])
  })
})
