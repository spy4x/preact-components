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
