/**
 * What a browser bundle of a library component carries (#471).
 *
 * `tailwind-merge` is about 28 KB minified, and `cn` brings it into every bundle that imports it.
 * `DemoVideo` and `RadioChips` compose their classes with `join` instead, so an island that renders
 * one of them must not carry it. `Button`, `Input`, `Textarea`, `Select` and `EnhancedForm` merge a
 * caller's `class` through `cn` since #861 (the owner's pick: a caller's class always wins, and
 * islands carry `tailwind-merge`), so every island that renders one of them — `ImageGallery`,
 * `Lightbox`, `Field` and `PricingTable` through `Button` or `Input` — carries it, under a ceiling
 * of its own. Each fixture under `testdata/` is such an island, and is bundled here the way an
 * app's build bundles one: `deno bundle --platform browser --minify`.
 *
 * `tailwind-merge`'s minified code keeps its class-group names as strings, so its presence is read
 * from one of them. The control fixture calls `cn` and must contain that string: if a
 * `tailwind-merge` upgrade ever drops it, the control fails instead of every other case passing for
 * the wrong reason.
 *
 * Runs on its own in the root `test` task, with `--allow-run=deno`: no other test gets that grant.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { fromFileUrl } from "@std/path"

/** A string `tailwind-merge`'s minified code carries: one of its Tailwind class-group names. */
const TAILWIND_MERGE_MARKER = "oldstyle-nums"

/** A string only `Button`'s hotkey code carries: the attribute it writes for its `hotkey` prop. */
const BUTTON_HOTKEY_MARKER = "aria-keyshortcuts"

/**
 * A ceiling on each island that does not merge, well under the ~28 KB `tailwind-merge` alone
 * would add on top of it. `Button`'s `hotkey` prop (#610) put Preact's hooks, the hotkey parser and the key
 * faces of `Kbd` into every island that renders a `Button`, about 9.8 KB minified (3.8 KB gzipped):
 * the `Button` island went from 13.7 KB to 23.5 KB, and the others that render one to about 29.5 KB.
 */
const ISLAND_CEILING_BYTES = 31_000

/**
 * Islands that carry `tailwind-merge` since #861, each with a ceiling about 3 KB over what it
 * bundled then: its size before #861 plus the ~27.5 KB `tailwind-merge` added (`Button` 24.3 KB
 * became 51.8 KB, `ImageGallery` 33.5 KB 61.1 KB, `Lightbox` 29.4 KB 56.9 KB, `Field` 13.8 KB
 * 41.3 KB, `EnhancedForm` 15.4 KB 42.9 KB, `PricingTable` 32.8 KB 60.3 KB).
 */
const MERGING_ISLAND_CEILINGS: Readonly<Record<string, number>> = {
  "island-button.tsx": 55_000,
  "island-image-gallery.tsx": 64_000,
  "island-lightbox.tsx": 60_000,
  "island-field.tsx": 45_000,
  "island-enhanced-form.tsx": 46_000,
  "island-pricing-table.tsx": 63_000,
}

const REPOSITORY_ROOT = fromFileUrl(new URL("../", import.meta.url))

/**
 * Bundle one fixture for the browser, minified, and return the JavaScript.
 *
 * @param fixture A file name under `ui/testdata/`.
 * @returns The bundle's text.
 * @throws When `deno bundle` fails, with its error output.
 */
async function bundle(fixture: string): Promise<string> {
  const { success, stdout, stderr } = await new Deno.Command("deno", {
    args: ["bundle", "--platform", "browser", "--minify", `ui/testdata/${fixture}`],
    cwd: REPOSITORY_ROOT,
    stdout: "piped",
    stderr: "piped",
  }).output()
  if (!success) {
    throw new Error(`deno bundle ${fixture} failed:\n${new TextDecoder().decode(stderr)}`)
  }
  return new TextDecoder().decode(stdout)
}

describe("a browser bundle of a library component", () => {
  it("carries tailwind-merge when it calls cn, so the marker is real", async () => {
    expect(await bundle("island-cn.tsx")).toContain(TAILWIND_MERGE_MARKER)
  })

  for (const [fixture, ceiling] of Object.entries(MERGING_ISLAND_CEILINGS)) {
    it(`carries tailwind-merge, and stays under its ceiling, for ${fixture}`, async () => {
      const code = await bundle(fixture)
      expect(code).toContain(TAILWIND_MERGE_MARKER)
      expect(new TextEncoder().encode(code).length).toBeLessThan(ceiling)
    })
  }

  for (const fixture of ["island-demo-video.tsx", "island-radio-chips.tsx"]) {
    it(`carries no tailwind-merge, and stays under the ceiling, for ${fixture}`, async () => {
      const code = await bundle(fixture)
      expect(code).not.toContain(TAILWIND_MERGE_MARKER)
      expect(new TextEncoder().encode(code).length).toBeLessThan(ISLAND_CEILING_BYTES)
    })
  }

  it("carries none of Button's hotkey code for an island that renders only Toastr", async () => {
    // `Toastr` calls `cn`, so it cannot join the cases above. `Button` is what writes
    // `aria-keyshortcuts`; the string in this bundle means `Toastr` imported something that
    // imports `Button`, which once cost 19 KB minified for one class-name constant (#671).
    expect(await bundle("island-toastr.tsx")).not.toContain(BUTTON_HOTKEY_MARKER)
  })
})
