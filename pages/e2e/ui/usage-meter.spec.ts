import type { Spec } from "../runner.ts"

/** How the long label of the guide's `UsageMeter` card lays out. */
interface LabelBox {
  lines: number
  /** The label's text runs wider than its box, as a one-line cut does. */
  cutSideways: boolean
  width: number
}

/**
 * Specs proving a long `UsageMeter` label wraps to two lines on a phone instead of being cut to
 * one, as the house list rule asks of titles.
 */
export const specs: readonly Spec[] = [
  {
    name: "UsageMeter: a long label wraps to two lines at 390 px, not cut to one",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 900 })
      const card = page.locator(`[data-e2e="guide-usage-meter"]`)
      await card.scrollIntoViewIfNeeded()
      const label = card.locator(`[role="meter"] span[id]`).filter({
        hasText: "Home improvement, garden supplies and workshop tools",
      })
      const box = await label.evaluate((element): LabelBox => {
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
        return {
          lines: Math.round(element.getBoundingClientRect().height / lineHeight),
          cutSideways: element.scrollWidth > element.clientWidth,
          width: Math.round(element.getBoundingClientRect().width),
        }
      })
      const evidence = `${box.lines} lines in ${box.width} px`
      if (box.lines !== 2 || box.cutSideways) {
        throw new Error(`${evidence}${box.cutSideways ? ", cut sideways" : ""}; wanted 2 lines`)
      }
      return evidence
    },
  },
]
