/** Playwright specs for the guide as a whole: axe-core on every page, in both palettes. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import { type GuidePageId, guidePageIds } from "@spy4x/preact-ui-guide/registry"
import type { Spec } from "./runner.ts"

/** How many elements fail one rule on one page: `[light, dark]`. */
type KnownCount = readonly [light: number, dark: number]

/**
 * How many elements break each axe rule on each page today, per palette. They were found when axe
 * first ran (#667) and are left for the owner to turn into issues; no component was changed.
 *
 * The count is exact. One more failing element fails the page's spec, and so does one fewer, so a
 * fix lowers its number in the same change and the list can only shrink. A rule that is not
 * listed for a page allows no failing element there.
 */
const KNOWN_VIOLATIONS: Record<GuidePageId, Readonly<Record<string, KnownCount>>> = {
  overview: {},
  ui: {
    "heading-order": [2, 2],
    "image-alt": [1, 1],
    "link-name": [1, 1],
    "scrollable-region-focusable": [1, 1],
  },
  icons: { "heading-order": [1, 1] },
  theme: { "scrollable-region-focusable": [1, 1] },
  charts: {},
  map: {},
  system: {
    "aria-prohibited-attr": [1, 1],
    "heading-order": [1, 1],
    "landmark-main-is-top-level": [2, 2],
    "landmark-no-duplicate-main": [1, 1],
    "landmark-unique": [4, 4],
    "scrollable-region-focusable": [1, 1],
  },
  crud: { "heading-order": [3, 3] },
}

/**
 * What a page draws after hydration, which axe has to wait for: scanned too early, the page has
 * less on it, or has it half drawn. A page with no entry is complete once it has hydrated.
 */
const READY: Partial<Record<GuidePageId, (page: Page) => Promise<unknown>>> = {
  // The Map mounts Leaflet in an effect and fades each tile in. `verify` points it at a local
  // tile on the preview server, so the tiles load with no network.
  map: (page) =>
    page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll("#demo-Map img.leaflet-tile")]
      return tiles.length > 0 && tiles.every((tile) =>
        tile.classList.contains("leaflet-tile-loaded") && getComputedStyle(tile).opacity === "1"
      )
    }),
}

/**
 * An element whose contrast another spec measures, so the page's scan runs every rule on it except
 * that one. A page with no entry is scanned whole.
 */
const CONTRAST_ELSEWHERE: Partial<Record<GuidePageId, string>> = {
  // The Map's credit line is opaque and lies over tiles Leaflet blends with `plus-lighter`. axe
  // 4.13 has no formula for that blend mode: it throws on this one element and then reports no
  // contrast for the whole page. `map.spec.ts` measures the line with the tiles kept away.
  map: '#demo-Map [data-e2e="map-attribution"]',
}

/**
 * One page in one palette: each axe rule fails on exactly as many elements as is known, and on
 * none when the rule is not listed.
 *
 * axe reports what it cannot decide (text over an image, for one) as "incomplete", not as a
 * violation, so this proves nothing about those elements.
 */
function axeSpec(pageId: GuidePageId, colorScheme: "light" | "dark"): Spec {
  return {
    name: `axe: the ${pageId} page has no new and no fixed violation in the ${colorScheme} palette`,
    pageId,
    colorScheme,
    run: async (page) => {
      // The guide follows the system palette; without this a dark run could scan the light page.
      const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
      if (dark !== (colorScheme === "dark")) {
        throw new Error(`the page is drawn ${dark ? "dark" : "light"}, not ${colorScheme}`)
      }
      await READY[pageId]?.(page)

      const apart = CONTRAST_ELSEWHERE[pageId]
      const whole = new AxeBuilder({ page })
      const scans = [await (apart ? whole.exclude(apart) : whole).analyze()]
      if (apart) {
        scans.push(
          await new AxeBuilder({ page }).include(apart).disableRules(["color-contrast"]).analyze(),
        )
      }
      const passes = scans[0].passes
      const incomplete = scans.flatMap((scan) => scan.incomplete)
      const known = KNOWN_VIOLATIONS[pageId]
      const expected = (rule: string) => known[rule]?.[colorScheme === "light" ? 0 : 1] ?? 0
      const found = new Map<string, typeof passes[number]["nodes"]>()
      for (const { id, nodes } of scans.flatMap((scan) => scan.violations)) {
        found.set(id, [...found.get(id) ?? [], ...nodes])
      }

      const problems: string[] = []
      for (const [rule, nodes] of found) {
        if (nodes.length > expected(rule)) {
          problems.push(
            `${rule} fails on ${nodes.length}, known ${expected(rule)}: ` +
              nodes.map((node) => node.target.join(" ")).join(", "),
          )
        }
      }
      for (const rule of Object.keys(known)) {
        const now = found.get(rule)?.length ?? 0
        if (now < expected(rule)) {
          problems.push(
            `${rule} fails on ${now}, known ${expected(rule)}: lower it in KNOWN_VIOLATIONS`,
          )
        }
      }
      // A rule axe could not run comes back as "incomplete" too, with this check on the element
      // it stopped at. It measured nothing, so it must not pass as "nothing found".
      for (const { id, nodes } of incomplete) {
        for (const node of nodes) {
          const crash = [...node.any, ...node.all, ...node.none]
            .find((check) => check.id === "error-occurred")
          if (crash) {
            problems.push(
              `${id} did not run, at ${node.target.join(" ")}: ${JSON.stringify(crash.data)}`,
            )
          }
        }
      }
      if (problems.length > 0) throw new Error(problems.join(" | "))

      const measured = passes.find(({ id }) => id === "color-contrast")?.nodes.length ?? 0
      const listed = Object.keys(known).filter((rule) => expected(rule) > 0)
        .map((rule) => `${rule} ×${expected(rule)}`)
      return `${passes.length} rules pass, contrast on ${measured} elements` +
        (listed.length > 0 ? `; known and not held: ${listed.join(", ")}` : "")
    },
  }
}

export const specs: readonly Spec[] = (["light", "dark"] as const).flatMap((colorScheme) =>
  guidePageIds.map((pageId) => axeSpec(pageId, colorScheme))
)
