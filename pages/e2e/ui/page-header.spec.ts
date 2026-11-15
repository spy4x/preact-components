import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** How one line of text in the long-titled header is drawn. */
interface DrawnText {
  /** The box's height in lines of its own line height. */
  lines: number
  /** Whether text is cut: the content runs past the box down or sideways. */
  cut: boolean
}

/** What the layout spec reads off the `PageHeader` card's long-titled header. */
interface PageHeaderLayout {
  title: DrawnText
  subtitle: DrawnText
  /** Whether the actions sit on the title's row: their box and the heading's overlap vertically. */
  actionsOnTitleRow: boolean
  /** Whether the actions start right of the heading's box. */
  actionsRightOfTitle: boolean
  /** How far the header's right edge runs past the viewport, in pixels; above 0 is off-screen. */
  pastViewport: number
  /** The smallest side among the back arrow, the primary action and the menu trigger, in pixels. */
  smallestTarget: number
  /** The primary action's label width, in pixels: 1 or less while it is screen-reader-only. */
  labelWidth: number
}

/** Read the long-titled header of the `PageHeader` card at the page's current width. */
async function pageHeaderLayout(page: Page): Promise<PageHeaderLayout> {
  const heading = page.locator(`#demo-PageHeader [data-e2e="page-header-long-title"]`)
  return await heading.evaluate((h1) => {
    const header = h1.closest("header")
    const actions = header?.lastElementChild
    const title = h1.querySelector("span")
    const subtitle = h1.parentElement?.querySelector("p")
    if (!header || !actions || actions.contains(h1) || !title || !subtitle) {
      throw new Error("the long-titled header has no title, subtitle or actions")
    }
    const drawn = (element: HTMLElement) => ({
      lines: Math.round(
        element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight),
      ),
      cut: element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
    })
    const box = h1.getBoundingClientRect()
    const row = actions.getBoundingClientRect()
    const controls = [
      header.querySelector(`[data-e2e="page-back"]`),
      actions.querySelector(`button:not([aria-haspopup])`),
      actions.querySelector(`button[aria-haspopup="menu"]`),
    ].map((control) => control?.getBoundingClientRect())
    const label = actions.querySelector(`button:not([aria-haspopup]) span`)
    return {
      title: drawn(title),
      subtitle: drawn(subtitle),
      actionsOnTitleRow: row.top < box.bottom && row.bottom > box.top,
      actionsRightOfTitle: row.left >= box.right,
      pastViewport: Math.ceil(
        header.getBoundingClientRect().right - document.documentElement.clientWidth,
      ),
      smallestTarget: Math.min(
        ...controls.map((control) => control ? Math.min(control.width, control.height) : 0),
      ),
      labelWidth: label ? label.getBoundingClientRect().width : -1,
    }
  })
}

/** Throws with what was seen when `ok` is false. */
function expectThat(what: string, ok: boolean, seen: unknown): void {
  if (!ok) throw new Error(`${what}: ${JSON.stringify(seen)}`)
}

/**
 * The `PageHeader` card's long title and subtitle at `width` (#579, #1260): each is cut short with
 * an ellipsis after `lines` lines, and the primary action with the More actions menu stay on the
 * title's row, right of it, inside the window.
 */
async function measure(page: Page, width: number, lines: number): Promise<PageHeaderLayout> {
  await page.setViewportSize({ width, height: 900 })
  await page.locator(`#demo-PageHeader`).scrollIntoViewIfNeeded()
  const layout = await pageHeaderLayout(page)
  for (const part of ["title", "subtitle"] as const) {
    expectThat(
      `the long ${part} is cut after ${lines} line(s)`,
      layout[part].lines === lines && layout[part].cut,
      layout[part],
    )
  }
  expectThat(
    "the actions stay on the title's row, right of it, inside the window",
    layout.actionsOnTitleRow && layout.actionsRightOfTitle && layout.pastViewport <= 0,
    layout,
  )
  return layout
}

export const specs: readonly Spec[] = [
  {
    name: "PageHeader at 375 px: a long title and subtitle each take two lines, cut short, " +
      "the actions stay beside them as 44 px icon buttons, and the card passes axe",
    pageId: "ui",
    run: async (page) => {
      const layout = await measure(page, 375, 2)
      expectThat("every control is a 44 px touch target", layout.smallestTarget >= 44, layout)
      expectThat(
        "the primary action shows its icon alone",
        layout.labelWidth >= 0 && layout.labelWidth <= 1,
        layout,
      )
      const { violations } = await new AxeBuilder({ page }).include("#demo-PageHeader").analyze()
      expectThat("the card passes axe", violations.length === 0, violations.map((v) => v.id))
      return `title ${layout.title.lines} lines, subtitle ${layout.subtitle.lines} lines, ` +
        `smallest target ${Math.round(layout.smallestTarget)} px`
    },
  },
  {
    name: "PageHeader at 1440 px: a long title and subtitle each keep to one line, cut short, " +
      "with the action's label beside its icon",
    pageId: "ui",
    run: async (page) => {
      const layout = await measure(page, 1440, 1)
      expectThat("the primary action shows its label", layout.labelWidth > 1, layout)
      return `title ${layout.title.lines} line, subtitle ${layout.subtitle.lines} line, ` +
        `label ${Math.round(layout.labelWidth)} px wide`
    },
  },
  {
    name: "PageHeader's heading leaves room for the whole focus ring of a button in its heading " +
      "slot",
    pageId: "ui",
    run: async (page) => {
      const button = page.locator(`#demo-PageHeader [data-card-part="demo"]`)
        .getByRole("heading").getByRole("button", { name: "Packing list" })
      await button.focus()
      await button.and(page.locator(":focus")).waitFor()
      // The ring is measured as geometry, so this holds whether or not the browser draws
      // `:focus-visible` for a scripted focus: no box between the button and its header may hide
      // overflow while cutting into the button's box grown by the 4 px ring (#579).
      const clippers = await button.evaluate((control) => {
        const ring = 4
        const box = control.getBoundingClientRect()
        const header = control.closest("header")
        const found: string[] = []
        for (let at = control.parentElement; at && header?.contains(at); at = at.parentElement) {
          const style = getComputedStyle(at)
          if (style.overflowX === "visible" && style.overflowY === "visible") continue
          const edge = at.getBoundingClientRect()
          if (
            edge.left > box.left - ring || edge.top > box.top - ring ||
            edge.right < box.right + ring || edge.bottom < box.bottom + ring
          ) {
            found.push(`${at.tagName.toLowerCase()} overflow ${style.overflowX}/${style.overflowY}`)
          }
        }
        return header ? found : ["no header around the button"]
      })
      if (clippers.length > 0) throw new Error(`boxes that clip the ring: ${clippers.join(", ")}`)
      return "boxes that clip the ring: none"
    },
  },
]
