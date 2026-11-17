import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

/** The scrolling box of the guide's `ComparisonTable` card: 0 compares four products, 1 two. */
function comparisonScroller(page: Page, index: 0 | 1): Locator {
  return page.locator(`#demo-ComparisonTable [data-e2e="comparison-scroller"]`).nth(index)
}

/**
 * `ComparisonTable` on a 390 px phone (#881): a two-product table fits whole, a wider one shows a
 * shadow at its right edge until it is scrolled to the end, and its held column draws its edge.
 */
function comparisonTablePhoneSpecs(): Spec[] {
  return [
    {
      name: "ComparisonTable: at 390px a two-product table shows both product columns whole, " +
        "with nothing to scroll",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const box = comparisonScroller(page, 1)
        await box.scrollIntoViewIfNeeded()
        const fit = await box.evaluate((node) => {
          const right = node.getBoundingClientRect().right
          return {
            overflow: node.scrollWidth - node.clientWidth,
            past: [...node.querySelectorAll("thead th")].map((cell) =>
              Math.round(cell.getBoundingClientRect().right - right)
            ),
          }
        })
        if (fit.past.length !== 3) throw new Error(`${fit.past.length} column headers, expected 3`)
        if (fit.overflow > 0 || fit.past.some((past) => past > 0)) {
          throw new Error(
            `the box overflows by ${fit.overflow}px; headers end ${fit.past.join(", ")}px past it`,
          )
        }
        return `headers end ${fit.past.join(", ")}px from the box's right edge`
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `ComparisonTable: at 390px a table too wide to fit shows a shadow at its right edge ` +
        `until it is scrolled to the end, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const box = comparisonScroller(page, 0)
        await box.scrollIntoViewIfNeeded()
        // The values are hidden, so the strip shows only what the box paints behind the cells.
        const room = await box.evaluate((node) => {
          for (const value of node.querySelectorAll<HTMLElement>("td > *")) {
            value.style.visibility = "hidden"
          }
          return node.scrollWidth - node.clientWidth
        })
        if (room <= 0) throw new Error("the table fits, so the spec proves nothing")
        const strip = async () => {
          const outer = await box.boundingBox()
          const body = await box.locator("tbody").boundingBox()
          if (outer === null || body === null) throw new Error("the table has no box")
          return page.screenshot({
            animations: "disabled",
            clip: { x: outer.x + outer.width - 8, y: body.y + 4, width: 6, height: 24 },
          })
        }
        const atRest = await strip()
        const short = await box.evaluate((node) => {
          node.scrollLeft = node.scrollWidth
          return node.scrollWidth - node.clientWidth - node.scrollLeft
        })
        if (short > 1) throw new Error(`the box stopped ${short}px before its end`)
        const atEnd = await strip()
        if (atRest.equals(atEnd)) {
          throw new Error("the right edge looks the same with more to the right and at the end")
        }
      },
    })),
    ...(["light", "dark", "ink"] as const).map((palette): Spec => ({
      name: `ComparisonTable: the last product's header paints one colour to its right end, with ` +
        `no band cut out of it, ${palette}`,
      pageId: "ui",
      colorScheme: palette === "light" ? "light" : "dark",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        if (palette === "ink") {
          await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
          await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
        }
        // The two-product table fits, so no shadow is drawn and the header's ground is all there is.
        const header = comparisonScroller(page, 1).locator("thead th").last()
        await header.scrollIntoViewIfNeeded()
        await header.evaluate((cell) => (cell as HTMLElement).style.color = "transparent")
        const box = await header.boundingBox()
        if (box === null) throw new Error("the last product's header has no box")
        const strip = (x: number) =>
          page.screenshot({
            animations: "disabled",
            clip: { x, y: box.y + box.height / 2 - 4, width: 4, height: 8 },
          })
        const start = await strip(box.x + 2)
        const end = await strip(box.x + box.width - 8)
        if (!start.equals(end)) {
          throw new Error("the header's right end is painted another colour than its start")
        }
      },
    })),
    {
      name: "ComparisonTable: at 390px every cell of the held first column draws its right edge",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const edges = await comparisonScroller(page, 0).evaluate((node) =>
          [...node.querySelectorAll("tr > th:first-child")].map((cell) => {
            const style = getComputedStyle(cell)
            return `${style.borderRightStyle} ${style.borderRightWidth}`
          })
        )
        if (edges.length < 2 || edges.some((edge) => edge !== "solid 1px")) {
          throw new Error(`right edges: ${edges.join(", ")}`)
        }
      },
    },
  ]
}

/**
 * A row's source link (#1387): Tab reaches it from the scrolling box, it shows the focus ring and
 * is at least 24 px tall, axe passes, and in a right-to-left page it starts its line on the right.
 */
function comparisonTableSourceSpecs(): Spec[] {
  return [
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `ComparisonTable, ${colorScheme}: Tab goes from the scrolling box to the first row's ` +
        "source link, which shows a focus ring; every source link is at least 24px tall; axe passes",
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const box = comparisonScroller(page, 0)
        const link = box.getByRole("link", { name: "Product A help page, read 1 October 2026" })
        await box.focus()
        await page.keyboard.press("Tab")
        await link.and(page.locator(":focus")).waitFor()
        const look = await link.evaluate((element) => {
          const style = getComputedStyle(element)
          // The shortest link of the card, one line of small text, must still be 24 px tall.
          const heights = [...document.querySelectorAll("#demo-ComparisonTable tbody th a")]
            .map((node) => node.getBoundingClientRect().height)
          return {
            ring: style.boxShadow,
            underline: style.textDecorationLine,
            height: Math.min(...heights),
          }
        })
        // Tailwind lists transparent shadows even with no ring, so only a coloured one counts.
        const ring = look.ring.split(/,(?![^(]*\))/).map((part) => part.trim())
          .filter((part) => !part.startsWith("rgba(0, 0, 0, 0)") && /0px [1-9]\d*px$/.test(part))
        if (ring.length === 0) {
          throw new Error(`the focused source link shows no focus ring: ${look.ring}`)
        }
        if (!look.underline.includes("underline")) throw new Error("the link is not underlined")
        if (look.height < 24) throw new Error(`a link is ${look.height}px tall, under 24`)
        const axe = await axeCleanIn(page, "#demo-ComparisonTable")
        return `ring ${ring.join(", ")}, shortest link ${look.height}px, axe ${axe}`
      },
    })),
    {
      name: "ComparisonTable: in a right-to-left page a row's source link starts on the right, " +
        "under its capability",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ComparisonTable")
        await card.evaluate((element) => element.setAttribute("dir", "rtl"))
        const header = comparisonScroller(page, 0).locator(`tbody th:has(a)`).first()
        await header.scrollIntoViewIfNeeded()
        const gap = await header.evaluate((cell) => {
          const link = cell.querySelector("a")
          if (link === null) return Number.NaN
          const inner = cell.getBoundingClientRect().right -
            parseFloat(getComputedStyle(cell).paddingRight)
          return Math.round(inner - link.getBoundingClientRect().right)
        })
        if (!(Math.abs(gap) <= 1)) {
          throw new Error(`the link ends ${gap}px from the cell's right content edge`)
        }
        return `the link ends ${gap}px from the cell's right content edge`
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...comparisonTablePhoneSpecs(),
  ...comparisonTableSourceSpecs(),
]
