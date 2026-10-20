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
 * It reads every `.ts`, `.tsx` and `.css` file of every workspace member but the demo app, test
 * files excepted, and skips the generated mirrors of the theme's CSS.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { findFixedColours } from "../../theme/fixed-colours.ts"
import { guardFiles } from "../../theme/spacing-runner.ts"
import { ROOT, workspaceMembers } from "./workspace.ts"

/**
 * Workspace members left out, each with why. Every other member is covered, so a new package is
 * checked from the change that adds it.
 */
const EXCLUDED: Record<string, string> = {
  pages: "The demo app: it shows the library and ships no component an app renders.",
}

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
]

/**
 * Every checked file of every covered member, relative to the repository root, sorted.
 * `workspaceMembers` throws for a package directory the workspace does not list, and `guardFiles`
 * skips test files and throws for a member that holds no file to check.
 */
async function sourceFiles(): Promise<string[]> {
  const members = await workspaceMembers()
  const stale = Object.keys(EXCLUDED).filter((id) => !members.includes(id))
  if (stale.length > 0) throw new Error(`EXCLUDED names ${stale}, which is not a workspace member`)
  const files = await guardFiles({
    root: ROOT,
    directories: members.filter((id) => !(id in EXCLUDED)),
    extensions: [".ts", ".tsx", ".css"],
  })
  return files.filter((path) => !SKIPPED.includes(path))
}

/**
 * How many files {@link ALLOWED} names. Adding a file to the list fails here until someone changes
 * this number on purpose; the number may only go down, and a lane that converts a file lowers it
 * with the list.
 */
const ALLOWED_COUNT = 1

describe("fixed colour classes in component source", () => {
  it("has an allow-list that has not grown", () => {
    expect(ALLOWED.length).toBe(ALLOWED_COUNT)
  })

  it("appear only in files the allow-list names", async () => {
    const offenders: string[] = []
    for (const path of await sourceFiles()) {
      if (ALLOWED.includes(path)) continue
      const found = findFixedColours(await Deno.readTextFile(new URL(path, ROOT)))
      for (const { line, className } of found) offenders.push(`${path}:${line} ${className}`)
    }
    expect(offenders).toEqual([])
  })

  it("are looked for in every package, not only the ones that had them", async () => {
    const files = await sourceFiles()
    for (const path of ["cn/cn.ts", "icons/+index.tsx", "signals/+index.ts", "ui/button.tsx"]) {
      expect(files).toContain(path)
    }
    expect(files.filter((path) => path.startsWith("pages/"))).toEqual([])
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
