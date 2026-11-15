import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

/**
 * `PeriodStepper` and `UsageMeter` (#1162): the keys step the month and the live region names it,
 * the return button hands focus to the next arrow, and axe passes on both cards at both widths in
 * both palettes.
 */
function periodAndUsageSpecs(): Spec[] {
  const month = (page: Page) => {
    const example = page.locator(`[data-e2e="guide-period-month"]`)
    return {
      example,
      name: example.locator(`[aria-live="polite"]`),
      value: example.locator(`[data-e2e="guide-period-month-value"]`),
      back: example.getByRole("button", { name: "This month" }),
      next: example.getByRole("button", { name: "Next month" }),
    }
  }
  const axeSpec = (colorScheme: "light" | "dark"): Spec => ({
    name: `PeriodStepper and UsageMeter: axe finds no violation at 390 and 1440 px in the ` +
      `${colorScheme} palette`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const said: string[] = []
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        for (const card of ["#demo-PeriodStepper", "#demo-UsageMeter"]) {
          await page.locator(card).scrollIntoViewIfNeeded()
          said.push(`${card} at ${width} px: ${await axeCleanIn(page, card)}`)
        }
      }
      return said.join("; ")
    },
  })

  return [
    {
      name: "PeriodStepper: ] steps October 2026 to November 2026, the live region names it, " +
        "the return button goes, and [ steps back",
      pageId: "ui",
      run: async (page) => {
        const view = month(page)
        await view.example.scrollIntoViewIfNeeded()
        await view.name.filter({ hasText: "October 2026" }).waitFor()
        await page.locator("body").press("]")
        await view.name.filter({ hasText: "November 2026" }).waitFor()
        await view.value.filter({ hasText: "2026-11-01 … 2026-11-30" }).waitFor()
        await view.back.waitFor({ state: "detached" })
        await page.locator("body").press("[")
        await view.name.filter({ hasText: "October 2026" }).waitFor()
        await view.back.waitFor()
        return "] → November 2026 (2026-11-01 … 2026-11-30), [ → October 2026"
      },
    },
    {
      name: "PeriodStepper: the return button brings the current month back and leaves focus on " +
        "the next arrow",
      pageId: "ui",
      run: async (page) => {
        const view = month(page)
        await view.example.scrollIntoViewIfNeeded()
        await view.back.focus()
        await page.keyboard.press("Enter")
        await view.name.filter({ hasText: "November 2026" }).waitFor()
        await view.back.waitFor({ state: "detached" })
        await view.next.and(page.locator(":focus")).waitFor()
        return "Enter on This month → November 2026, focus on Next month"
      },
    },
    axeSpec("light"),
    axeSpec("dark"),
  ]
}

export const specs: readonly Spec[] = [
  ...periodAndUsageSpecs(),
]
