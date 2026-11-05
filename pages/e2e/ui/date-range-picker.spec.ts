import type { Spec } from "../runner.ts"

/**
 * The week presets of `DateRangePicker` (#1162): a Sunday-start "This week" is the week from that
 * Sunday and stays pressed.
 */
function dateRangePickerWeekSpecs(): Spec[] {
  return [
    {
      name: "DateRangePicker: with firstWeekday 7, This week on Sunday 15 February 2026 is " +
        "15 to 21 February and stays pressed",
      pageId: "ui",
      run: async (page) => {
        const trigger = page.locator(`[data-e2e="guide-date-range-week"]`)
        const picker = trigger.locator("xpath=..")
        await trigger.scrollIntoViewIfNeeded()
        await trigger.click()
        await picker.getByRole("button", { name: "This week" }).click()
        await page.locator(`[data-e2e="week-value"]`)
          .filter({ hasText: "2026-02-15 … 2026-02-21" }).waitFor()
        if (!await picker.getByRole("button", { name: "This week" }).isVisible()) {
          await trigger.click()
        }
        await picker.locator(`button[aria-pressed="true"]`, { hasText: "This week" }).waitFor()
        return "This week → 2026-02-15 … 2026-02-21, pressed"
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...dateRangePickerWeekSpecs(),
]
