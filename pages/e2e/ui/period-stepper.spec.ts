import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

/**
 * `PeriodStepper` and `UsageMeter` (#1162): the keys step the month and the live region names it,
 * the return button hands focus to the next arrow, the arrows stay put when it hides (#1347), and
 * axe passes on both cards at both widths in both palettes.
 */
function periodAndUsageSpecs(): Spec[] {
  const month = (page: Page) => {
    const example = page.locator(`[data-e2e="guide-period-month"]`)
    return {
      example,
      name: example.locator(`[aria-live="polite"]`),
      value: example.locator(`[data-e2e="guide-period-month-value"]`),
      back: example.getByRole("button", { name: "This month" }),
      group: example.locator(`:scope > [role="group"]`),
      /** The return button, the only button directly in the stepper; found while hidden too. */
      backSlot: example.locator(`:scope > [role="group"] > button`),
      previous: example.getByRole("button", { name: "Previous month" }),
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
        "the return button hides, and [ steps back",
      pageId: "ui",
      run: async (page) => {
        const view = month(page)
        await view.example.scrollIntoViewIfNeeded()
        await view.name.filter({ hasText: "October 2026" }).waitFor()
        await page.locator("body").press("]")
        await view.name.filter({ hasText: "November 2026" }).waitFor()
        await view.value.filter({ hasText: "2026-11-01 … 2026-11-30" }).waitFor()
        await view.back.waitFor({ state: "hidden" })
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
        await view.back.waitFor({ state: "hidden" })
        await view.next.and(page.locator(":focus")).waitFor()
        return "Enter on This month → November 2026, focus on Next month"
      },
    },
    {
      name: "PeriodStepper: the return button sits before the arrows, and the arrows and the " +
        "name's start stay put, relative to the stepper, from October 2026 to November 2026 and " +
        "back, at 1440 and 390 px",
      pageId: "ui",
      run: async (page) => {
        const view = month(page)
        const said: string[] = []
        // The guide's font, not a fallback, decides whether a month's name fits on a line.
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        for (const width of [1440, 390]) {
          // A phone's scrollbar overlays the page; headless Chromium's takes 15 px of the layout.
          // Without adding it back, the stepper is 309 px wide at 390 px, so "October 2026" wraps
          // as well as "November 2026" and a name that wraps by its length goes unnoticed.
          await page.setViewportSize({ width, height: 900 })
          const scrollbar = await page.evaluate(() =>
            innerWidth - document.documentElement.clientWidth
          )
          await page.setViewportSize({ width: width + scrollbar, height: 900 })
          await view.example.scrollIntoViewIfNeeded()
          await view.name.filter({ hasText: "October 2026" }).waitFor()
          await view.back.waitFor()
          const october = await stepperBoxes(view)
          if (october.back.x + october.back.width > october.previous.x) {
            throw new Error(
              `at ${width} px the return button ${JSON.stringify(october.back)} ` +
                `is not before the previous arrow ${JSON.stringify(october.previous)}`,
            )
          }
          await page.locator("body").press("]")
          await view.name.filter({ hasText: "November 2026" }).waitFor()
          await view.back.waitFor({ state: "hidden" })
          const november = await stepperBoxes(view)
          await page.locator("body").press("[")
          await view.name.filter({ hasText: "October 2026" }).waitFor()
          await view.back.waitFor()
          const octoberAgain = await stepperBoxes(view)
          const later = { November: november, "October again": octoberAgain }
          for (const [label, boxes] of Object.entries(later)) {
            const moved = (["previous", "next", "nameStart", "back"] as const).filter((part) =>
              JSON.stringify(october[part]) !== JSON.stringify(boxes[part])
            )
            if (moved.length > 0) {
              throw new Error(
                `at ${width} px ${moved.join(", ")} moved: October ` +
                  `${JSON.stringify(october)}, ${label} ${JSON.stringify(boxes)}`,
              )
            }
          }
          said.push(`${width} px: ${JSON.stringify(november)}`)
        }
        return said.join("; ")
      },
    },
    axeSpec("light"),
    axeSpec("dark"),
  ]
}

/** A box rounded to whole pixels, so sub-pixel noise does not read as a move. */
interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The boxes a person aims at, relative to the stepper's top-left corner so a card growing above it
 * does not read as a move: the return button's slot, both arrows, and the name's start corner (its
 * width follows the month's name, so only where it starts must hold).
 */
async function stepperBoxes(
  view: { group: Locator; backSlot: Locator; previous: Locator; next: Locator; name: Locator },
): Promise<{ back: Box; previous: Box; next: Box; nameStart: { x: number; y: number } }> {
  const origin = await view.group.boundingBox()
  if (!origin) throw new Error(`${view.group} has no box`)
  const box = async (locator: Locator): Promise<Box> => {
    const found = await locator.boundingBox()
    if (!found) throw new Error(`${locator} has no box`)
    return {
      x: Math.round(found.x - origin.x),
      y: Math.round(found.y - origin.y),
      width: Math.round(found.width),
      height: Math.round(found.height),
    }
  }
  const name = await box(view.name)
  return {
    back: await box(view.backSlot),
    previous: await box(view.previous),
    next: await box(view.next),
    nameStart: { x: name.x, y: name.y },
  }
}

export const specs: readonly Spec[] = [
  ...periodAndUsageSpecs(),
]
