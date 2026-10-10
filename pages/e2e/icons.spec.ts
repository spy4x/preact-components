/** Playwright specs for `icons/`, on the guide's icon gallery. */
import type { Spec } from "./runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "IconSpinner and IconLoading spin, and stop under reduced motion",
    pageId: "icons",
    run: async (page) => {
      const spinners = page.locator("svg.animate-spin")
      await spinners.first().waitFor()
      const names = () =>
        spinners.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName))

      const moving = await names()
      await page.emulateMedia({ reducedMotion: "reduce" })
      const reduced = await names()

      if (moving.length < 2 || moving.some((found) => found !== "spin")) {
        throw new Error(`without reduced motion: animations [${moving}], expected two spinning`)
      }
      if (reduced.some((found) => found !== "none")) {
        throw new Error(`under reduced motion still runs [${reduced}]`)
      }
      return `stopped ${reduced.length} spinning icons`
    },
  },
]
