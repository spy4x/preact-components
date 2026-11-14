import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

/**
 * `NumberStepper` (#1283): the keys and the − and + buttons step the number and report each change
 * once, an edge reports nothing, a digit sets the number and 0 reads "Off", Left and Right swap in
 * a right-to-left page, a disabled stepper ignores keys, and axe passes on the card at both widths
 * in both palettes.
 */
function numberStepperSpecs(): Spec[] {
  /** One guide example: its spinbutton, its buttons and the note with its value and change count. */
  const example = (page: Page, e2e: string) => {
    const root = page.locator(`[data-e2e="${e2e}"]`)
    const box = root.getByRole("spinbutton")
    const note = root.locator(`[data-e2e="${e2e}-value"]`)
    return {
      root,
      box,
      minus: root.locator("button").first(),
      plus: root.locator("button").last(),
      /** Waits until the spinbutton shows `now` and `text`, and `onChange` has fired `changes` times. */
      shows: async (now: number, text: string, changes: number) => {
        await box.and(page.locator(`[aria-valuenow="${now}"][aria-valuetext="${text}"]`))
          .filter({ hasText: text }).waitFor()
        await note.filter({ hasText: `value: ${now}, changes: ${changes}` }).waitFor()
      },
      /** Throws unless the note reads exactly this, after the page has run its pending work. */
      reads: async (expected: string) => {
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
        const said = (await note.textContent())?.trim()
        if (said !== expected) throw new Error(`the note reads "${said}", not "${expected}"`)
      },
    }
  }
  const disabled = (page: Page) => page.locator(":disabled")
  const focused = (page: Page) => page.locator(":focus")

  const axeSpec = (colorScheme: "light" | "dark"): Spec => ({
    name: `NumberStepper: axe finds no violation at 390 and 1440 px in the ${colorScheme} palette`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const said: string[] = []
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await page.locator("#demo-NumberStepper").scrollIntoViewIfNeeded()
        said.push(`at ${width} px: ${await axeCleanIn(page, "#demo-NumberStepper")}`)
      }
      return said.join("; ")
    },
  })

  return [
    {
      name: "NumberStepper: the arrows, PageUp, PageDown, Home, End and digits set the number, " +
        "an edge reports no change, and 0 reads Off",
      pageId: "ui",
      run: async (page) => {
        const view = example(page, "guide-number")
        await view.root.scrollIntoViewIfNeeded()
        await view.shows(3, "3", 0)
        await view.box.focus()
        const steps: [string, number, string][] = [
          ["ArrowUp", 4, "4"],
          ["ArrowRight", 5, "5"],
          ["ArrowDown", 4, "4"],
          ["ArrowLeft", 3, "3"],
          ["PageUp", 8, "8"],
          ["PageDown", 3, "3"],
          ["End", 10, "10"],
        ]
        let changes = 0
        for (const [key, now, text] of steps) {
          await page.keyboard.press(key)
          await view.shows(now, text, ++changes)
        }
        await view.plus.and(disabled(page)).waitFor()
        await page.keyboard.press("ArrowUp")
        await page.keyboard.press("PageUp")
        await page.keyboard.press("End")
        await view.reads(`value: 10, changes: ${changes}`)
        await page.keyboard.press("Home")
        await view.shows(0, "Off", ++changes)
        await view.minus.and(disabled(page)).waitFor()
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("0")
        await view.reads(`value: 0, changes: ${changes}`)
        await page.keyboard.press("7")
        await view.shows(7, "7", ++changes)
        await page.keyboard.press("0")
        await view.shows(0, "Off", ++changes)
        return `${steps.map(([key, now]) => `${key} → ${now}`).join(", ")}; ArrowUp, PageUp ` +
          `and End at 10 and ArrowDown and 0 at 0 report nothing; Home → Off, 7 → 7, 0 → Off; ` +
          `${changes} changes`
      },
    },
    {
      name: "NumberStepper: a click on + or − steps once and leaves focus on the spinbutton, and " +
        "a disabled + at the maximum reports nothing",
      pageId: "ui",
      run: async (page) => {
        const view = example(page, "guide-number")
        await view.root.scrollIntoViewIfNeeded()
        await view.plus.click()
        await view.shows(4, "4", 1)
        await view.box.and(focused(page)).waitFor()
        await page.keyboard.press("ArrowUp")
        await view.shows(5, "5", 2)
        await view.minus.click()
        await view.shows(4, "4", 3)
        await view.box.and(focused(page)).waitFor()
        await page.keyboard.press("End")
        await view.shows(10, "10", 4)
        await view.plus.and(disabled(page)).waitFor()
        await view.plus.evaluate((button) => (button as HTMLButtonElement).click())
        await view.reads("value: 10, changes: 4")
        return "+ → 4 with focus on the spinbutton, ArrowUp → 5, − → 4, End → 10, " +
          "disabled + clicked → still 10, 4 changes"
      },
    },
    {
      name: "NumberStepper: in a right-to-left page ArrowLeft adds and ArrowRight takes away, in " +
        "Arabic digits",
      pageId: "ui",
      run: async (page) => {
        const view = example(page, "guide-number-rtl")
        await view.root.scrollIntoViewIfNeeded()
        await view.shows(2, "٢", 0)
        await view.box.focus()
        await page.keyboard.press("ArrowLeft")
        await view.shows(3, "٣", 1)
        await page.keyboard.press("ArrowRight")
        await view.shows(2, "٢", 2)
        await page.keyboard.press("ArrowUp")
        await view.shows(3, "٣", 3)
        return "ArrowLeft → ٣, ArrowRight → ٢, ArrowUp → ٣"
      },
    },
    {
      name: "NumberStepper: a disabled stepper keeps its number on every key, with both buttons " +
        "disabled",
      pageId: "ui",
      run: async (page) => {
        const view = example(page, "guide-number-off")
        await view.root.scrollIntoViewIfNeeded()
        await view.shows(4, "4", 0)
        await view.minus.and(disabled(page)).waitFor()
        await view.plus.and(disabled(page)).waitFor()
        await view.box.focus()
        for (const key of ["ArrowUp", "ArrowDown", "End", "Home", "7"]) {
          await page.keyboard.press(key)
        }
        await view.reads("value: 4, changes: 0")
        return "ArrowUp, ArrowDown, End, Home and 7 → still 4, no change"
      },
    },
    axeSpec("light"),
    axeSpec("dark"),
  ]
}

export const specs: readonly Spec[] = [
  ...numberStepperSpecs(),
]
