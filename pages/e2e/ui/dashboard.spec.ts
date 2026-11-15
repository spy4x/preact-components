import { AxeBuilder } from "@axe-core/playwright"
import type { Spec } from "../runner.ts"

/** Specs of the dashboard cards: `WidgetCard`, `LayoutCustomiser`, and the picker's preset. */
const dashboardSpecs: Spec[] = [
  {
    name:
      "WidgetCard: a load shows its skeleton after the delay; Try again calls the retry and keeps focus on the card",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-WidgetCard")
      const widget = card.locator(`[data-e2e="widget-card-demo"]`)
      await card.locator(`[data-e2e="widget-status-loading"]`).click()
      await widget.and(page.locator(`[aria-busy="true"]`)).waitFor()
      await widget.locator("[data-widget-skeleton]").waitFor()

      await card.locator(`[data-e2e="widget-status-error"]`).click()
      await widget.getByRole("alert").filter({ hasText: "We could not load the note count." })
        .waitFor()
      const retry = widget.getByRole("button", { name: "Try again", exact: true })
      await retry.focus()
      await page.keyboard.press("Enter")
      await card.locator(`[data-e2e="widget-retries"]`).getByText("Retries: 1", { exact: true })
        .waitFor()
      // The button is gone; focus is on the card, not the page, and stays there once data arrives.
      await widget.and(page.locator(":focus")).waitFor()
      await widget.and(page.locator(`[data-widget-status="ready"]`)).waitFor()
      await widget.and(page.locator(":focus")).waitFor()
    },
  },
  {
    name:
      "WidgetStat: a long value fits a 10 rem card on one line, is text-3xl in a wide card, a short value is text-3xl, a value too long for every step wraps inside its card, and the card passes axe",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-WidgetStat")
      const short = card.locator(`[data-e2e="widget-stat-short"] p.tabular-nums`)
      const narrow = card.locator(`[data-e2e="widget-stat-long"]`)
      const wide = card.locator(`[data-e2e="widget-stat-long-wide"]`)
      await short.waitFor()

      /** The value's font size, its line count, and how it sits in its card's content box. */
      const measure = (value: typeof short) =>
        value.evaluate((el: HTMLElement) => {
          const style = getComputedStyle(el)
          const box = el.closest("[data-e2e]") as HTMLElement
          const boxStyle = getComputedStyle(box)
          const outer = box.getBoundingClientRect()
          // The text's own extent, not the paragraph's box, which is always the card's width.
          const range = document.createRange()
          range.selectNodeContents(el)
          const inner = range.getBoundingClientRect()
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
          return {
            fontSize: parseFloat(style.fontSize),
            text3xl: parseFloat(style.getPropertyValue("--text-3xl")) * rem,
            lines: Math.round(el.getBoundingClientRect().height / parseFloat(style.lineHeight)),
            overflow: el.scrollWidth - el.clientWidth,
            cardWidth: outer.width / rem,
            inside: inner.left >= outer.left + parseFloat(boxStyle.paddingLeft) - 0.5 &&
              inner.right <= outer.right - parseFloat(boxStyle.paddingRight) + 0.5,
          }
        })
      /** Throws with the measurement when it breaks a rule. */
      const expectThat = (what: string, ok: boolean, seen: unknown) => {
        if (!ok) throw new Error(`${what}: ${JSON.stringify(seen)}`)
      }

      const shortSize = await measure(short)
      expectThat(
        "a short value draws at text-3xl",
        shortSize.fontSize === shortSize.text3xl,
        shortSize,
      )

      const longValue = narrow.locator("p.tabular-nums")
      const long = await measure(longValue)
      expectThat("the long value's card is 10 rem wide", long.cardWidth === 10, long)
      expectThat(
        "a 14-character value fits a 10 rem card on one line, smaller than text-3xl",
        long.overflow <= 0 && long.inside && long.lines === 1 && long.fontSize < long.text3xl,
        long,
      )

      const wideLong = await measure(wide.locator("p.tabular-nums"))
      expectThat(
        "the same value in an 18 rem card draws at text-3xl on one line",
        wideLong.fontSize === wideLong.text3xl && wideLong.lines === 1 && wideLong.inside,
        wideLong,
      )

      const { violations } = await new AxeBuilder({ page }).include("#demo-WidgetStat").analyze()
      expectThat("the card passes axe", violations.length === 0, violations.map((v) => v.id))

      // Past the last step the value keeps its smallest size and wraps rather than overflowing.
      await longValue.evaluate((el) => (el.textContent = "₫123,456,789,012,345,678"))
      const absurd = await measure(longValue)
      expectThat(
        "a value too long for every step wraps inside its card",
        absurd.overflow <= 0 && absurd.inside && absurd.lines > 1,
        absurd,
      )
    },
  },
  {
    name: "LayoutCustomiser: a switch hides a widget from the page at once, Reset brings it back",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-LayoutCustomiser")
      const order = card.locator(`[data-e2e="layout-order"]`)
      await card.locator(`[data-e2e="layout-open"]`).click()
      const dialog = page.locator(`dialog[data-e2e="layout-customiser"]`)
      await dialog.waitFor()
      const toggle = dialog.getByRole("switch", { name: "Show Notes", exact: true })
      await toggle.click()
      await toggle.and(page.locator(`[aria-checked="false"]`)).waitFor()
      await order.getByText("Shown: Notes changed, Notes over time", { exact: true }).waitFor()
      await card.locator(`#demo-LayoutCustomiser [role="region"] h2`).filter({ hasText: /^Notes$/ })
        .waitFor({ state: "detached" })

      await dialog.getByRole("button", { name: "Reset to default", exact: true }).click()
      await order.getByText("Shown: Notes, Notes changed, Notes over time", { exact: true })
        .waitFor()
      await dialog.getByRole("button", { name: "Done", exact: true }).click()
      await dialog.waitFor({ state: "hidden" })
    },
  },
  {
    name: "LayoutCustomiser: the keyboard moves a widget and the page follows",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-LayoutCustomiser")
      await card.locator(`[data-e2e="layout-open"]`).click()
      const dialog = page.locator(`dialog[data-e2e="layout-customiser"]`)
      const handle = dialog.getByRole("button", { name: "Reorder Notes over time", exact: true })
      await handle.focus()
      await page.keyboard.press("Space")
      await page.keyboard.press("ArrowUp")
      await page.keyboard.press("ArrowUp")
      await page.keyboard.press("Space")
      await card.locator(`[data-e2e="layout-order"]`)
        .getByText("Shown: Notes over time, Notes, Notes changed", { exact: true }).waitFor()
      await card.locator(`[data-e2e="layout-changes"]`).getByText("Changes: 1", { exact: true })
        .waitFor()
    },
  },
  {
    name: "DateRangePicker: onChange reports the preset the person chose",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-DateRangePicker")
      await card.locator("button[aria-controls]").first().click()
      await card.getByRole("button", { name: "This month", exact: true }).click()
      await card.locator(`[data-e2e="controlled-preset"]`)
        .getByText("preset: this-month", { exact: true }).waitFor()
    },
  },
]

export const specs: readonly Spec[] = [
  ...dashboardSpecs,
]
