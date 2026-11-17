/**
 * What a browser bundle of a library component carries (#471).
 *
 * `tailwind-merge` is about 28 KB minified, and `cn` brings it into every bundle that imports it.
 * `ImageGallery`, `Lightbox` (#471), `PricingTable` (#523), `DemoVideo`, `LoopVideo`,
 * `YouTubeVideo`, `RadioChips`, `ScreenTour`, `CommandPalette`, `Combobox`, `Modal` and `Toastr`
 * (#943) compose their own classes with `join` instead, so an island that renders only them must
 * not carry it. `Button`, `Input`, `Textarea`, `Select` and `EnhancedForm` merge a caller's `class`
 * through `cn` since #861 (the owner's pick: a caller's class always wins, and islands carry
 * `tailwind-merge`), so every island that renders one of them — `ImageGallery`, `Lightbox`, `Field`,
 * `PricingTable`, `ScreenTour` and the modal over a combobox, through `Button` or `Input` — carries
 * it, under a ceiling of its own. `buttonClassesJoined` (#1367) composes `Button`'s classes with
 * `join`, so an island that styles a link as a button through it carries neither `tailwind-merge`
 * nor `Button`'s own code. Each fixture under `testdata/` is such an island, and is bundled
 * here the way an app's build bundles one: `deno bundle --platform browser --minify`.
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
 * A ceiling on each island that does not merge, well under the ~28 KB `tailwind-merge` alone would
 * add on top of it. `Button`'s `hotkey` prop (#610) put Preact's hooks, the hotkey parser and the
 * key faces of `Kbd` into every island that renders a `Button`, about 9.8 KB minified (3.8 KB
 * gzipped): the `Button` island went from 13.7 KB to 23.5 KB, and the others that render one to
 * about 29.5 KB.
 */
const ISLAND_CEILING_BYTES = 31_000

/** Islands without `tailwind-merge` allowed more than {@link ISLAND_CEILING_BYTES}, with reasons. */
const ISLAND_CEILINGS: Readonly<Record<string, number>> = {
  // A palette and a toaster, the forgiving matcher and the hotkeys included: 50.8 KB (#943, #524).
  // Command rows (icon, state badge, keys, disabled and kept-open commands): 52.6 KB (#878).
  // The alternative pick, PageUp/PageDown, submenus, the text mode and ">": 55.8 KB (#1234).
  // Recent picks, the best match, the result count and the key hints: 58.1 KB (#1235).
  // The icon trigger's tooltip, `Tooltip`'s behaviour without tailwind-merge, and the link the
  // trigger is until hydration: 61.6 KB (#940).
  // Early answers through `show`, the highlight they keep, and a failure beside the field: 62.1 KB
  // (#1298).
  "island-command-palette.tsx": 63_000,
  // An article figure: `Explorable`, a `Slider`, stacked `Bars` and a `DotPlot`: 36.0 KB (#958, #524).
  // Eight series colours instead of five, in the chart's palette class: 36.2 KB (#957).
  "island-explorable-bars.tsx": 37_000,
  // Below the default: a docs page's only island, Preact and the clipboard helper alone. 14.1 KB.
  "island-prose-code-copy.tsx": 16_000,
}

/**
 * Islands that carry `tailwind-merge` since #861, each with a ceiling about 3 KB over what it
 * bundled then: its size before #861 plus the ~27.5 KB `tailwind-merge` added. Measured when #861
 * merged: `Button` 53.5 KB, `ImageGallery` 63.5 KB, `Lightbox` 59.0 KB, `Field` 41.6 KB,
 * `EnhancedForm` 44.8 KB, `PricingTable` 64.8 KB, `ScreenTour` 73.9 KB (`Lightbox` and signals, 45.8
 * KB before) and the modal over a combobox 80.8 KB (the modal's `Button`, 53.0 KB before).
 */
const MERGING_ISLAND_CEILINGS: Readonly<Record<string, number>> = {
  "island-button.tsx": 56_000,
  "island-image-gallery.tsx": 66_000,
  "island-lightbox.tsx": 62_000,
  "island-field.tsx": 45_000,
  "island-enhanced-form.tsx": 47_000,
  "island-pricing-table.tsx": 67_000,
  "island-screen-tour.tsx": 76_000,
  "island-modal-combobox.tsx": 83_000,
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

  for (
    const fixture of [
      "island-demo-video.tsx",
      "island-loop-video.tsx",
      "island-youtube-video.tsx",
      "island-radio-chips.tsx",
      "island-command-palette.tsx",
      "island-toastr.tsx",
      "island-explorable-bars.tsx",
      "island-prose-code-copy.tsx",
      // A link styled as a button: 12.1 KB, Preact and the class tables alone (#1367).
      "island-button-classes-joined.tsx",
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

  it("carries none of Button's code for the island that wires Prose's copy buttons", async () => {
    // The island copies through the shared clipboard helper, not through `CopyButton`, whose
    // module renders a `Button`: a docs page that ships only this island stays small.
    expect(await bundle("island-prose-code-copy.tsx")).not.toContain(BUTTON_HOTKEY_MARKER)
  })

  it("carries none of Button's code for an island that styles a link with buttonClassesJoined", async () => {
    // `button-classes.ts` holds the class tables alone; reaching `button.tsx` would bring its
    // hotkeys and, through `cn`, `tailwind-merge` (#1367).
    expect(await bundle("island-button-classes-joined.tsx")).not.toContain(BUTTON_HOTKEY_MARKER)
  })
})
