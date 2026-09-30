/**
 * Holds the guide's chrome to the theme's accent scale (#432): no source file under `ui-guide/`
 * names a fixed `purple-*` step, which an app's `--color-accent` cannot recolour. The accent scale
 * draws the same purple by default; `pages/checks/ui-guide.ts` proves that in the browser.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"

const ROOT = new URL("./", import.meta.url)

/** `text-purple-800`, `dark:bg-purple-950/60`; not the word "purple" or a `color="purple"` prop. */
const FIXED_PURPLE = /(?<![\w-])(?:[\w\-\[\]&>*]+:)*[a-z]+(?:-[a-z]+)*-purple-\d{2,3}(?:\/\d+)?/g

/** Every `.ts` and `.tsx` source file under `directory`, test files excepted. */
async function sourceFiles(directory: URL, prefix = ""): Promise<string[]> {
  const files: string[] = []
  for await (const entry of Deno.readDir(directory)) {
    const path = `${prefix}${entry.name}`
    if (entry.isDirectory) {
      files.push(...await sourceFiles(new URL(`${entry.name}/`, directory), `${path}/`))
    } else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) files.push(path)
  }
  return files.sort()
}

describe("the guide's chrome colours", () => {
  it("names no fixed purple step", async () => {
    const found: string[] = []
    for (const path of await sourceFiles(ROOT)) {
      const text = await Deno.readTextFile(new URL(path, ROOT))
      text.split("\n").forEach((line, index) => {
        for (const match of line.matchAll(FIXED_PURPLE)) {
          found.push(`${path}:${index + 1} ${match[0]}`)
        }
      })
    }
    expect(found).toEqual([])
  })
})
