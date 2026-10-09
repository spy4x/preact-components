/**
 * What a browser bundle of a library component carries (#471).
 *
 * `tailwind-merge` is about 28 KB minified, and `cn` brings it into every bundle that imports it.
 * `Button`, `ImageGallery`, `Lightbox` (#471), `Field`, `Input`, `Textarea`, `EnhancedForm`
 * (#511) and `PricingTable` (#523) compose their classes with `join` instead, so an island that
 * renders one of them must not carry it. Each fixture under `testdata/` is such an island, and is
 * bundled here the way an app's build bundles one: `deno bundle --platform browser --minify`.
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

/**
 * A ceiling on each component island, well under the ~28 KB `tailwind-merge` alone would add on
 * top of it. `Button`'s `hotkey` prop (#610) put Preact's hooks, the hotkey parser and the key
 * faces of `Kbd` into every island that renders a `Button`, about 9.8 KB minified (3.8 KB gzipped):
 * the `Button` island went from 13.7 KB to 23.5 KB, and the others that render one to about 29.5 KB.
 */
const ISLAND_CEILING_BYTES = 31_000

/**
 * Islands allowed more than {@link ISLAND_CEILING_BYTES}, each with its reason. `ImageGallery`'s
 * strip measures its row for the counter and Previous/Next (#567), about 2.6 KB on top of the
 * 23.2 KB it bundled before, and #610 added 7.2 KB more; with `tailwind-merge` it would still be
 * over 60 KB. `PricingTable`'s forms became `EnhancedForm`s for `pending` (#568), which put the
 * form's busy guard, live region and focus recovery into its island: 29.6 KB became 31.6 KB.
 */
const ISLAND_CEILINGS: Readonly<Record<string, number>> = {
  "island-image-gallery.tsx": 35_000,
  "island-pricing-table.tsx": 33_000,
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

  for (
    const fixture of [
      "island-button.tsx",
      "island-image-gallery.tsx",
      "island-lightbox.tsx",
      "island-field.tsx",
      "island-enhanced-form.tsx",
      "island-pricing-table.tsx",
    ]
  ) {
    it(`carries no tailwind-merge, and stays under the ceiling, for ${fixture}`, async () => {
      const code = await bundle(fixture)
      expect(code).not.toContain(TAILWIND_MERGE_MARKER)
      expect(new TextEncoder().encode(code).length).toBeLessThan(
        ISLAND_CEILINGS[fixture] ?? ISLAND_CEILING_BYTES,
      )
    })
  }
})
