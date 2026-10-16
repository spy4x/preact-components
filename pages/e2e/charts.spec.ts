/** Playwright specs for `charts/` components, on the guide's charts page. */
import type { Spec } from "./runner.ts"

/** The left and right edge of one X label, in pixels, with its text. */
interface LabelBox {
  text: string
  left: number
  right: number
}

/**
 * A 30-day `LineChart` drawn `width` pixels wide shows its first and its last date, and no two of
 * its X labels touch.
 */
function labelsApartSpec(width: number): Spec {
  return {
    name: `LineChart: at ${width} px a 30-day chart's date labels do not overlap, and the first ` +
      "and the last are shown",
    pageId: "charts",
    run: async (page) => {
      const frame = page.locator(`#demo-LineChart [data-e2e="chart-30-days"]`)
      await frame.evaluate((element, px) => {
        ;(element as HTMLElement).style.width = `${px}px`
      }, width)
      // The plot and the label row both sit in an `inset-x-3` box; the label row is the last one.
      const row = frame.locator(`[data-chart="line"] .inset-x-3`).last()
      // The chart measures its axis after a resize and picks its labels again; wait for that pass.
      await page.evaluate(() =>
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      )
      const boxes = await row.evaluate((element): LabelBox[] =>
        [...element.querySelectorAll("span")].map((span) => {
          const box = span.getBoundingClientRect()
          return { text: span.textContent ?? "", left: box.left, right: box.right }
        })
      )
      if (boxes.length < 2) throw new Error(`only ${boxes.length} label drawn`)
      for (let index = 1; index < boxes.length; index++) {
        if (boxes[index].left < boxes[index - 1].right) {
          throw new Error(
            `"${boxes[index - 1].text}" ends at ${boxes[index - 1].right}px and ` +
              `"${boxes[index].text}" starts at ${boxes[index].left}px`,
          )
        }
      }
      const shown = boxes.map((box) => box.text)
      if (shown[0] !== "Oct 1" || shown.at(-1) !== "Oct 30") {
        throw new Error(`the labels run from "${shown[0]}" to "${shown.at(-1)}"`)
      }
      return shown.join(", ")
    },
  }
}

export const specs: readonly Spec[] = [labelsApartSpec(320), labelsApartSpec(1280)]
