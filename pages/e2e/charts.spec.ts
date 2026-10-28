/** Playwright specs for `charts/` components, on the guide's charts page. */
import { axeCleanIn } from "./axe-clean.ts"
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

/**
 * #855: in `card`'s first chart, focusing `plot` shows the first item, ArrowDown moves to the same
 * next item ArrowRight does, and ArrowUp comes back.
 */
function arrowDownSpec(component: string, plot: string): Spec {
  return {
    name: `${component}: ArrowDown moves to the next item, as ArrowRight does, and ArrowUp back`,
    pageId: "charts",
    run: async (page) => {
      const card = page.locator(`#demo-${component}`)
      const target = card.locator(plot).first()
      const heading = card.locator("[data-chart-tooltip]").first().locator("strong")
      const read = async () => (await heading.textContent())?.trim() ?? ""
      const exactly = (text: string) =>
        new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`)
      await target.and(page.locator("[tabindex]")).waitFor()
      await target.focus()
      await heading.waitFor()
      const first = await read()
      await target.press("ArrowDown")
      await heading.filter({ hasNotText: exactly(first) }).waitFor()
      const down = await read()
      await target.press("ArrowUp")
      await heading.filter({ hasText: exactly(first) }).waitFor()
      await target.press("ArrowRight")
      await heading.filter({ hasNotText: exactly(first) }).waitFor()
      const right = await read()
      if (down !== right) throw new Error(`ArrowDown went to "${down}", ArrowRight to "${right}"`)
      return `${first} → ArrowDown ${down} → ArrowUp ${first} → ArrowRight ${right}`
    },
  }
}

/**
 * #863: `useInView` observes an element that first appears after a loading state. The guide's
 * deferred donut serves a loading bar and renders its watched box only after hydration; once that
 * box is scrolled into view, the chart inside it is drawn.
 */
function deferredChartSpec(): Spec {
  return {
    name:
      "useInView: a chart whose box appears after a loading state is drawn once scrolled into view",
    pageId: "charts",
    run: async (page) => {
      const box = page.locator(`#demo-DonutChart [data-e2e="chart-deferred"]`)
      await box.scrollIntoViewIfNeeded()
      await box.locator("[data-chart-ring]").waitFor({ timeout: 10_000 })
      return "drawn after the loading bar"
    },
  }
}

/**
 * The hidden data table of a 30-day `LineChart` takes no room: on a 390 px page the chart's box
 * holds nothing that scrolls below it, and the page does not scroll sideways.
 */
function hiddenTableSpec(): Spec {
  return {
    name: "LineChart: at 390 px the hidden data table adds no scroll height and no sideways scroll",
    pageId: "charts",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const chart = page.locator(`#demo-LineChart [data-e2e="chart-30-days"] [data-chart="line"]`)
      await chart.locator("[data-chart-table] tr").nth(30).waitFor({ state: "attached" })
      const sizes = await chart.evaluate((element) => {
        const table = element.querySelector("[data-chart-table]") as HTMLElement
        return {
          overflow: element.scrollHeight - element.clientHeight,
          table: table.getBoundingClientRect().height,
          sideways: document.documentElement.scrollWidth - globalThis.innerWidth,
        }
      })
      if (sizes.overflow > 1) throw new Error(`the chart scrolls ${sizes.overflow} px below itself`)
      if (sizes.table > 1) throw new Error(`the hidden table is ${sizes.table} px tall`)
      if (sizes.sideways > 0) throw new Error(`the page scrolls ${sizes.sideways} px sideways`)
      return `table ${sizes.table} px tall, no overflow`
    },
  }
}

/** `RankedBars` and `Kpi`'s change line, both drawn for spy4x/seed#485. */
function statsPieceSpecs(): Spec[] {
  const axeSpec = (colorScheme: "light" | "dark"): Spec => ({
    name: "RankedBars and Kpi's change line: axe finds no violation at 390 and 1440 px " +
      `in the ${colorScheme} palette`,
    pageId: "charts",
    colorScheme,
    run: async (page) => {
      const said: string[] = []
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        for (const selector of [`[data-e2e="bars-ranked"]`, `[data-e2e="kpi-change"]`]) {
          await page.locator(selector).scrollIntoViewIfNeeded()
          said.push(`${width} px ${selector}: ${await axeCleanIn(page, selector)}`)
        }
      }
      return said.join("; ")
    },
  })

  return [
    {
      name: "RankedBars: a row's button sets the filter by Enter and by a click anywhere " +
        "on its row, and its focus ring is drawn",
      pageId: "charts",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        const ranked = page.locator(`[data-e2e="bars-ranked"]`)
        const filter = ranked.locator(`[data-e2e="bars-ranked-filter"]`)
        const shows = (name: string) =>
          filter.getByText(`Chart shows: ${name}`, { exact: true }).waitFor()
        await ranked.scrollIntoViewIfNeeded()
        const zalo = ranked.getByRole("button", { name: "Zalo group A", exact: true })
        await zalo.focus()
        await page.keyboard.press("Enter")
        await shows("Zalo group A")
        // Tailwind always sets a shadow list; the ring is the one shadow with a colour and a spread.
        const ring = await zalo.evaluate((button) =>
          getComputedStyle(button, "::after").boxShadow.split(/,(?![^(]*\))/)
            .map((shadow) => shadow.trim())
            .find((shadow) => !shadow.startsWith("rgba(0, 0, 0, 0)") && /\b[1-9]\d*px/.test(shadow))
        )
        if (!ring) throw new Error("the focused row draws no ring")
        // The last cell of Instagram's row, "2.2%", is outside the button but inside its hit area.
        // A real pointer press at the cell's centre: Playwright's own click would refuse a cell
        // whose point the row's button takes, which is the behaviour proven here.
        const row = ranked.getByRole("row").filter({ hasText: "Instagram" })
        const box = await row.getByRole("cell").last().boundingBox()
        if (!box) throw new Error("Instagram's last cell has no box")
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        await shows("Instagram")
        return `ring ${ring}`
      },
    },
    {
      name: "RankedBars: at 390 px each row shows its extra numbers as a muted second " +
        "line, and the page does not scroll sideways",
      pageId: "charts",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const ranked = page.locator(`[data-e2e="bars-ranked"]`)
        await ranked.scrollIntoViewIfNeeded()
        const row = ranked.getByRole("row").filter({ hasText: "Zalo group A" })
        await row.getByText("Order clicks 24 · Order rate 5.0%", { exact: true }).waitFor()
        const hidden = await row.getByRole("cell").count()
        if (hidden !== 1) throw new Error(`${hidden} number cells show at 390 px, expected 1`)
        const sideways = await page.evaluate(() =>
          document.documentElement.scrollWidth - globalThis.innerWidth
        )
        if (sideways > 0) throw new Error(`the page scrolls ${sideways} px sideways`)
        return "two lines, one number cell"
      },
    },
    {
      name: "RankedBars: an item's 40 px photo leads its row and its note follows the extra " +
        "numbers on one muted line, at 390 and 1440 px without sideways scroll",
      pageId: "charts",
      run: async (page) => {
        const said: string[] = []
        const widths: [number, string][] = [[390, "Views 210 · mostly Zalo A"], [
          1440,
          "mostly Zalo A",
        ]]
        for (const [width, line] of widths) {
          await page.setViewportSize({ width, height: 900 })
          const ranked = page.locator(`[data-e2e="bars-ranked"]`)
          await ranked.scrollIntoViewIfNeeded()
          const row = ranked.getByRole("row").filter({ hasText: "Linen shirt, sand" })
          await row.waitFor()
          const read = await row.evaluate((tr) => {
            const image = tr.querySelector("img")!.getBoundingClientRect()
            const link = tr.querySelector("a")!
            // The muted line follows the label's own; innerText leaves out what CSS hides.
            const muted = link.parentElement!.nextElementSibling as HTMLElement
            return {
              image: [image.width, image.height],
              before: image.right <= link.getBoundingClientRect().left,
              line: muted.innerText,
              sideways: document.documentElement.scrollWidth - globalThis.innerWidth,
            }
          })
          const found =
            `${width} px: photo ${read.image.join("×")}, before label ${read.before}, ` +
            `line "${read.line}", sideways ${read.sideways}`
          if (
            read.image[0] !== 40 || read.image[1] !== 40 || !read.before ||
            read.line !== line || read.sideways > 0
          ) throw new Error(found)
          said.push(found)
        }
        return said.join("; ")
      },
    },
    axeSpec("light"),
    axeSpec("dark"),
  ]
}

export const specs: readonly Spec[] = [
  labelsApartSpec(320),
  labelsApartSpec(1280),
  arrowDownSpec("LineChart", "[data-chart-plot]"),
  arrowDownSpec("DonutChart", "[data-chart-ring]"),
  deferredChartSpec(),
  hiddenTableSpec(),
  ...statsPieceSpecs(),
]
