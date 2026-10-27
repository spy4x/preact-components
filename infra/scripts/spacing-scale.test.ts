/**
 * Holds this repository's own packages to the spacing scale (#331), and to logical sides (#876): every padding, margin, gap,
 * `space-x/y` and scroll margin/padding class in them uses a step from `SPACING_STEPS`, never an
 * arbitrary value. There is no allow-list: a component that needs an off-scale value takes the
 * nearest step. `docs/spacing.md` has the rule; `@spy4x/preact-theme/spacing` has the checker.
 *
 * It reads every `.ts`, `.tsx` and `.css` file of every workspace member, test files excepted: a
 * test asserts on classes, and the checker's own test has to spell out the classes it must
 * report. What a test asserts still has to match the component, so a test file cannot keep an
 * off-scale class the component no longer renders.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { findOffScaleSpacing, findPhysicalDirection } from "../../theme/spacing.ts"
import { guardFiles } from "../../theme/spacing-runner.ts"
import { ROOT, workspaceMembers } from "./workspace.ts"

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

/**
 * Every checked file of every workspace member, `pages/` included, as a path relative to the
 * repository root, sorted. The package list is the workspace itself, so a new package is walked
 * from the change that adds it, and `workspaceMembers` throws for a package directory the
 * workspace does not list. `guardFiles` skips test files and build output (`pages/dist`), and
 * throws for a member that holds no file to check.
 */
async function sourceFiles(): Promise<string[]> {
  const files = await guardFiles({
    root: ROOT,
    directories: await workspaceMembers(),
    extensions: [".ts", ".tsx", ".css"],
  })
  return files.filter((path) => !GENERATED.includes(path))
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
  it("finds no spacing class off the scale in any workspace member", async () => {
    expect(await offScale(await sourceFiles())).toEqual([])
  })

  it("reads every package, the preset and the demo, and skips test files and generated files", async () => {
    const files = await sourceFiles()
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
        "cn/cn.ts",
        "icons/+index.tsx",
        "signals/+index.ts",
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

/**
 * Files that still name a physical side (`ml-`, `left-`, `text-right`, `border-l` and the rest),
 * which do not flip on a right-to-left page. Steps 3 and 4 of #876 convert them to logical classes
 * and delete each file from this list as they go; the list only shrinks, and #876 closes with it
 * empty. Every other file is held to logical sides now.
 */
const PHYSICAL_SIDES_LEFT = [
  "charts/bars.tsx",
  "charts/donut-chart.tsx",
  "charts/dot-plot.tsx",
  "charts/line-chart.tsx",
  "crud/association-editor.tsx",
  "crud/crud-editor.tsx",
  "crud/crud-list.tsx",
  "crud/deletion-validation.tsx",
  "crud/examples/regions.tsx",
  "map/map.tsx",
  "pages/src/crud-list-url.tsx",
  "system/account-menu.tsx",
  "system/app-shell.tsx",
  "system/auth-form.tsx",
  "system/calendar.tsx",
  "system/rail-parts.tsx",
  "system/rail.tsx",
  "system/settings-layout.tsx",
  "system/shell.tsx",
  "system/sw-updater.tsx",
  "ui/attachment-list.tsx",
  "ui/checkbox.tsx",
  "ui/color-field.tsx",
  "ui/combobox.tsx",
  "ui/command-palette.tsx",
  "ui/comparison-table.tsx",
  "ui/data-table.tsx",
  "ui/date-range-picker.tsx",
  "ui/dropdown.tsx",
  "ui/explorable.tsx",
  "ui/field.tsx",
  "ui/file-input.tsx",
  "ui/filter-bar.tsx",
  "ui/frame-chrome.tsx",
  "ui-guide/card.tsx",
  "ui-guide/instructions.tsx",
  "ui-guide/mini-app.tsx",
  "ui-guide/overview.tsx",
  "ui-guide/sections/crud.tsx",
  "ui-guide/sections/display.tsx",
  "ui-guide/sections/forms.tsx",
  "ui-guide/sections/surfaces.tsx",
  "ui-guide/sections/system.tsx",
  "ui-guide/shell.tsx",
  "ui/hotkey-hint.tsx",
  "ui/input-button.tsx",
  "ui/lightbox.tsx",
  "ui/list-field.tsx",
  "ui/notice.tsx",
  "ui/on-off-buttons.tsx",
  "ui/page-header.tsx",
  "ui/screen-tour.tsx",
  "ui/slider.tsx",
  "ui/sortable-list.tsx",
  "ui/steps.tsx",
  "ui/tag-input.tsx",
  "ui/timeline.tsx",
  "ui/tldr-box.tsx",
  "ui/toastr.tsx",
  "ui/toggle-field.tsx",
  "ui/tooltip.tsx",
  "ui/tour.tsx",
]

/** One line per class in `files` that names a physical side: `path:line:column class → logical`. */
async function physicalSides(files: string[]): Promise<string[]> {
  const found: string[] = []
  for (const path of files) {
    for (
      const { line, column, className, logical } of findPhysicalDirection(await readSource(path))
    ) {
      found.push(`${path}:${line}:${column} ${className} → ${logical}`)
    }
  }
  return found
}

describe("logical sides", () => {
  it("finds no class naming a physical side outside the files #876 has yet to convert", async () => {
    const files = await sourceFiles()
    expect(await physicalSides(files.filter((path) => !PHYSICAL_SIDES_LEFT.includes(path))))
      .toEqual([])
    const left = await physicalSides(PHYSICAL_SIDES_LEFT)
    console.log(
      `${left.length} physical side(s) left in ${PHYSICAL_SIDES_LEFT.length} file(s), #876`,
    )
  })

  it("lists only files that exist and still name a physical side", async () => {
    const files = await sourceFiles()
    const stale: string[] = []
    for (const path of PHYSICAL_SIDES_LEFT) {
      if (!files.includes(path) || (await physicalSides([path])).length === 0) stale.push(path)
    }
    expect(stale).toEqual([])
  })
})
