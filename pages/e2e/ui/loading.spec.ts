import type { Locator } from "playwright-core"
import type { Spec } from "../runner.ts"

/**
 * Read the computed `animation-name` of every element each locator matches.
 *
 * @param groups The elements to read, by a name for the report.
 * @returns The names found, per group, in document order.
 */
async function animationNames(
  groups: Record<string, Locator>,
): Promise<Record<string, string[]>> {
  const found: Record<string, string[]> = {}
  for (const [name, marks] of Object.entries(groups)) {
    found[name] = await marks.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).animationName)
    )
  }
  return found
}

export const specs: readonly Spec[] = [
  {
    name:
      "LoadingSpinner, LoadingSkeleton and a busy Button animate, and stop under reduced motion",
    pageId: "ui",
    run: async (page) => {
      await page.locator(`#demo-Button [data-e2e="busy-confirm"]`).click()
      const animated = {
        "LoadingSpinner": page.locator("#demo-LoadingSpinner .animate-spin"),
        "LoadingSkeleton": page.locator("#demo-LoadingSkeleton .animate-pulse"),
        "busy Button": page.locator(`#demo-Button [data-e2e="busy-confirm"] .animate-spin`),
      }
      for (const marks of Object.values(animated)) await marks.first().waitFor()

      const moving = await animationNames(animated)
      await page.emulateMedia({ reducedMotion: "reduce" })
      const reduced = await animationNames(animated)

      const expected = {
        "LoadingSpinner": "spin",
        "LoadingSkeleton": "pulse",
        "busy Button": "spin",
      }
      for (const [name, animation] of Object.entries(expected)) {
        if (moving[name].length === 0 || moving[name].some((found) => found !== animation)) {
          throw new Error(`${name} without reduced motion: animations [${moving[name]}]`)
        }
        if (reduced[name].some((found) => found !== "none")) {
          throw new Error(`${name} under reduced motion still runs [${reduced[name]}]`)
        }
      }
      return `stopped ${Object.values(reduced).flat().length} animated elements`
    },
  },
]
