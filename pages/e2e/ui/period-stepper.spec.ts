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
    {
      name: "PeriodStepper: right-aligned at 1440 px, the arrows stay put through 12 months and " +
        "7 weeks whose names differ in width (#1368)",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        // The guide's font, not a fallback, decides each name's width.
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        const said: string[] = []
        const cases = [
          // January to December 2026, September and May included: `[` back from October, then `]`.
          { e2e: "guide-period-month", back: 9, forward: 11, next: "Next month", keys: true },
          // Sunday weeks from 1 November 2026; the keys are off, so the arrow is clicked. The
          // fifth, 29 November to 5 December, crosses a month.
          { e2e: "guide-period-week", back: 0, forward: 6, next: "Next week", keys: false },
        ]
        for (const { e2e, back, forward, next, keys } of cases) {
          const example = page.locator(`[data-e2e="${e2e}"]`)
          const name = example.locator(`[aria-live="polite"]`)
          const previousArrow = example.getByRole("button", { name: /^Previous/ })
          const nextArrow = example.getByRole("button", { name: next })
          // As in a page header: the stepper as wide as its content, at the end of the row.
          await example.evaluate((element: HTMLElement) => {
            element.style.display = "flex"
            element.style.flexDirection = "column"
            element.style.alignItems = "flex-end"
          })
          await example.scrollIntoViewIfNeeded()
          const step = async (press: () => Promise<void>) => {
            const before = await name.innerText()
            await press()
            await name.filter({ hasNotText: before }).waitFor()
          }
          for (let i = 0; i < back; i++) await step(() => page.locator("body").press("["))
          const seen: { name: string; previous: number; next: number }[] = []
          const record = async () => {
            const previousBox = await previousArrow.boundingBox()
            const nextBox = await nextArrow.boundingBox()
            if (!previousBox || !nextBox) throw new Error(`${e2e}: an arrow has no box`)
            seen.push({ name: await name.innerText(), previous: previousBox.x, next: nextBox.x })
          }
          await record()
          for (let i = 0; i < forward; i++) {
            await step(() => keys ? page.locator("body").press("]") : nextArrow.click())
            await record()
          }
          const moved = seen.filter((at) =>
            at.previous !== seen[0].previous || at.next !== seen[0].next
          )
          if (moved.length > 0) {
            throw new Error(`${e2e}: the arrows moved: ${JSON.stringify(seen)}`)
          }
          said.push(
            `${e2e}: ${seen.map((at) => at.name).join(", ")} with arrows at ` +
              `${seen[0].previous} and ${seen[0].next}`,
          )
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
 * does not read as a move: the return button's slot, both arrows, and the start corner of the
 * name's text (its width follows the month's name, so only where it starts must hold). The text's
 * own box, not the element's, so a name aligned to the end of a full-width line reads as moving.
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
  const text = await view.name.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const { x, y } = range.getBoundingClientRect()
    return { x, y }
  })
  return {
    back: await box(view.backSlot),
    previous: await box(view.previous),
    next: await box(view.next),
    nameStart: { x: Math.round(text.x - origin.x), y: Math.round(text.y - origin.y) },
  }
}

export const specs: readonly Spec[] = [
  ...periodAndUsageSpecs(),
]
