/**
 * What a browser bundle of a library component carries (#471).
 *
 * `tailwind-merge` is about 28 KB minified, and `cn` brings it into every bundle that imports it.
 * `Button`, `ImageGallery`, `Lightbox` (#471), `Field`, `Input`, `Textarea`, `EnhancedForm`
 * (#511), `PricingTable` (#523), `DemoVideo`, `RadioChips`, `ScreenTour`, `CommandPalette`,
 * `Combobox`, `Modal` and `Toastr` (#943) compose their classes with `join` instead, so an island
 * that renders one of them must not carry it. Each fixture under `testdata/` is such an island, and is
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

/** A string only `Button`'s hotkey code carries: the attribute it writes for its `hotkey` prop. */
const BUTTON_HOTKEY_MARKER = "aria-keyshortcuts"

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
 * `ScreenTour` renders `Lightbox` (29.5 KB on its own) and keeps its state in signals, as the
 * library's rule for local state asks: `@preact/signals` is about 7.3 KB minified, which a Fresh
 * app already ships for its islands. It measured 43.4 KB.
 */
const ISLAND_CEILINGS: Readonly<Record<string, number>> = {
  // A palette and a toaster, the forgiving matcher and the hotkeys included: 49.2 KB (#943).
  "island-command-palette.tsx": 52_000,
  // A modal over a combobox, with the modal's `Button` and its hotkey code: 45.1 KB (#943).
  "island-modal-combobox.tsx": 48_000,
  // An article figure: `Explorable`, a `Slider`, stacked `Bars` and a `DotPlot`: 33.6 KB (#958).
  "island-explorable-bars.tsx": 36_000,
  "island-image-gallery.tsx": 35_000,
  "island-pricing-table.tsx": 33_000,
  "island-screen-tour.tsx": 45_000,
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
      "island-demo-video.tsx",
      "island-radio-chips.tsx",
      "island-screen-tour.tsx",
      "island-command-palette.tsx",
      "island-modal-combobox.tsx",
      "island-toastr.tsx",
      "island-explorable-bars.tsx",
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

  it("carries none of Button's hotkey code for an island that renders only Toastr", async () => {
    // `Button` is what writes `aria-keyshortcuts`; the string in this bundle means `Toastr`
    // imported something that imports `Button`, which once cost 19 KB minified for one class-name
    // constant (#671).
    expect(await bundle("island-toastr.tsx")).not.toContain(BUTTON_HOTKEY_MARKER)
  })
})
