import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

/** The `SegmentedControl` card's two groups, and the line that prints the period's value. */
function segmented(page: Page) {
  const card = page.locator("#demo-SegmentedControl")
  const period = card.getByRole("radiogroup", { name: "Period" })
  const view = card.getByRole("radiogroup", { name: "View" })
  return {
    card,
    period,
    view,
    /** A segment of the period group, by its whole name. */
    days: (name: string) => period.getByRole("radio", { name, exact: true }),
    /** Waits until `name` is the period's one checked segment, holding the focus, and printed. */
    chosen: async (name: string) => {
      const segment = period.getByRole("radio", { name, exact: true })
      await segment.and(page.locator(`[aria-checked="true"]:focus`)).waitFor()
      const checked = await period.locator(`[aria-checked="true"]`).count()
      if (checked !== 1) throw new Error(`${checked} segments are checked`)
      await card.locator(`[data-e2e="segmented-period-value"]`)
        .getByText(`days: ${name.split(" ")[0]}`, { exact: true }).waitFor()
    },
  }
}

/**
 * `SegmentedControl`'s keyboard and pointer, and axe on it in the light and the dark palette
 * (spy4x/seed#485).
 */
function segmentedControlSpecs(): Spec[] {
  const axeSpec = (colorScheme: "light" | "dark"): Spec => ({
    name:
      `SegmentedControl: axe finds no violation at 390 and 1440 px in the ${colorScheme} palette`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const said: string[] = []
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await page.locator("#demo-SegmentedControl").scrollIntoViewIfNeeded()
        said.push(`${width} px: ${await axeCleanIn(page, "#demo-SegmentedControl")}`)
      }
      return said.join("; ")
    },
  })

  return [
    {
      name: "SegmentedControl: Tab lands on the chosen segment, and the arrow keys, Home and End " +
        "move and choose, wrapping round both ends",
      pageId: "ui",
      run: async (page) => {
        const view = segmented(page)
        await view.card.scrollIntoViewIfNeeded()
        // The view group's chosen segment is the next tab stop after the period group's.
        await view.view.getByRole("radio", { name: "List" }).focus()
        await page.keyboard.press("Shift+Tab")
        await view.days("30 days").and(page.locator(":focus")).waitFor()
        const steps: [string, string][] = [
          ["ArrowRight", "90 days"],
          ["ArrowRight", "7 days"],
          ["ArrowLeft", "90 days"],
          ["Home", "7 days"],
          ["End", "90 days"],
          ["ArrowDown", "7 days"],
          ["ArrowUp", "90 days"],
        ]
        for (const [key, name] of steps) {
          await page.keyboard.press(key)
          await view.chosen(name).catch((error: Error) => {
            throw new Error(`${key} did not choose ${name}: ${error.message.split("\n")[0]}`)
          })
        }
        return steps.map(([key, name]) => `${key} → ${name}`).join(", ")
      },
    },
    {
      name: "SegmentedControl: in a right-to-left page ArrowLeft moves to the next segment",
      pageId: "ui",
      run: async (page) => {
        const view = segmented(page)
        await view.period.evaluate((group) =>
          group.closest("[data-e2e]")?.setAttribute("dir", "rtl")
        )
        await view.days("30 days").focus()
        await page.keyboard.press("ArrowLeft")
        await view.chosen("90 days")
        await page.keyboard.press("ArrowRight")
        await view.chosen("30 days")
        return "ArrowLeft → 90 days, ArrowRight → 30 days"
      },
    },
    {
      name:
        "SegmentedControl: a click chooses a segment, and each is at least 44 px tall at 390 px",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const view = segmented(page)
        await view.days("7 days").click()
        await view.chosen("7 days")
        const heights = await view.period.getByRole("radio").evaluateAll((segments) =>
          segments.map((segment) => segment.getBoundingClientRect().height)
        )
        if (heights.some((height) => height < 44)) throw new Error(`heights ${heights.join(", ")}`)
        return `heights ${heights.join(", ")} px`
      },
    },
    axeSpec("light"),
    axeSpec("dark"),
  ]
}

export const specs: readonly Spec[] = [
  ...segmentedControlSpecs(),
]
