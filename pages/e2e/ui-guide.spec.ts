/** Playwright specs for the guide as a whole: axe-core on every page, in both palettes. */
import { AxeBuilder } from "@axe-core/playwright"
import { type GuidePageId, guidePageIds } from "@spy4x/preact-ui-guide/registry"
import type { Spec } from "./runner.ts"

/**
 * The axe rules each page breaks today, in either palette. They were found when axe first ran
 * (#667) and are left for the owner to turn into issues; the components were not changed.
 *
 * A rule listed here is not held on that page, and is still held on every other page. A page that
 * stops breaking a listed rule fails too, so the list can only shrink: delete the entry with the fix.
 */
export const KNOWN_VIOLATIONS: Record<GuidePageId, readonly string[]> = {
  overview: ["color-contrast"],
  ui: ["color-contrast", "heading-order", "image-alt", "link-name", "scrollable-region-focusable"],
  icons: ["heading-order"],
  theme: ["color-contrast", "scrollable-region-focusable"],
  charts: [],
  map: [],
  system: [
    "aria-prohibited-attr",
    "color-contrast",
    "heading-order",
    "landmark-main-is-top-level",
    "landmark-no-duplicate-main",
    "landmark-unique",
    "scrollable-region-focusable",
  ],
  crud: ["heading-order"],
}

/**
 * One page in one palette: every axe rule passes except the ones the page is known to break.
 *
 * axe reports what it cannot decide (text over a gradient, for one) as "incomplete", not as a
 * violation, so this proves nothing about those elements.
 */
function axeSpec(pageId: GuidePageId, colorScheme: "light" | "dark"): Spec {
  return {
    name: `axe: the ${pageId} page breaks only its known rules in the ${colorScheme} palette`,
    pageId,
    colorScheme,
    run: async (page) => {
      // The guide follows the system palette; without this a dark run could scan the light page.
      const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
      if (dark !== (colorScheme === "dark")) {
        throw new Error(`the page is drawn ${dark ? "dark" : "light"}, not ${colorScheme}`)
      }

      const { violations, passes } = await new AxeBuilder({ page }).analyze()
      const known = KNOWN_VIOLATIONS[pageId]
      const fresh = violations.filter((violation) => !known.includes(violation.id)).map((
        { id, nodes },
      ) => `${id} on ${nodes.length}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`)
      const fixed = known.filter((id) => !violations.some((violation) => violation.id === id))
        .map((id) => `${id} no longer fails here: remove it from KNOWN_VIOLATIONS`)
      const problems = [...fresh, ...fixed]
      if (problems.length > 0) throw new Error(problems.join(" | "))

      return `${passes.length} rules pass` +
        (known.length > 0 ? `; known and not held: ${known.join(", ")}` : "")
    },
  }
}

export const uiGuideSpecs: readonly Spec[] = (["light", "dark"] as const).flatMap((colorScheme) =>
  guidePageIds.map((pageId) => axeSpec(pageId, colorScheme))
)
