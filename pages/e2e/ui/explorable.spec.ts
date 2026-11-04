import type { Spec } from "../runner.ts"

/**
 * #958: `Slider` keeps the native range input's keyboard, and `Explorable` turns its controls on
 * once hydrated. Both read the guide's demos: the "Yearly rate" slider (0 to 10, step 0.5, starting
 * at 4) and the fee figure, whose "Years" slider runs from 5 to 40.
 */
function explorableSpecs(): Spec[] {
  return [
    {
      name: "Slider: the arrow keys move one step, Home and End go to the ends, Page Up and Page " +
        "Down jump further, and the printed value and aria-valuetext follow each move",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Slider")
        const input = card.locator("#slider-rate")
        const printed = card.locator(`span[aria-hidden="true"].pc-num`).first()
        const at = async (value: string) => {
          await input.and(page.locator(`[aria-valuetext="${value} percent a year"]`)).waitFor()
          await printed.filter({ hasText: new RegExp(`^${value.replace(".", "\\.")}%$`) })
            .waitFor()
        }
        const read = async () => Number(await input.inputValue())
        await at("4.0")
        await input.focus()
        await page.keyboard.press("ArrowRight")
        await at("4.5")
        await page.keyboard.press("ArrowLeft")
        await page.keyboard.press("ArrowLeft")
        await at("3.5")
        await page.keyboard.press("PageUp")
        await input.and(page.locator(`:not([aria-valuetext="3.5 percent a year"])`)).waitFor()
        const up = await read()
        if (!(up > 4)) throw new Error(`Page Up from 3.5 went to ${up}, not past one step`)
        await page.keyboard.press("End")
        await at("10.0")
        await page.keyboard.press("PageDown")
        await input.and(page.locator(`:not([aria-valuetext="10.0 percent a year"])`)).waitFor()
        const down = await read()
        if (!(down < 9.5)) throw new Error(`Page Down from 10 went to ${down}, not past one step`)
        await page.keyboard.press("Home")
        await at("0.0")
        return `4 → 4.5 → 3.5 → Page Up ${up} → End 10 → Page Down ${down} → Home 0`
      },
    },
    {
      name:
        "Explorable: once hydrated, the Interactive line shows, the controls are enabled, and " +
        "a control changes the result",
      pageId: "ui",
      run: async (page) => {
        const figure = page.locator(`#explorable-fee[data-live="true"]`)
        await figure.waitFor()
        await figure.locator("[data-explorable-badge]").filter({ hasText: "Interactive" })
          .waitFor({ state: "visible" })
        await figure.locator("fieldset:not([disabled])").waitFor()
        const years = figure.getByRole("slider", { name: "Years" })
        await years.focus()
        await page.keyboard.press("End")
        await figure.getByText(/over 40 years\./).waitFor()
        return "live, enabled, and End on Years shows 40 years"
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...explorableSpecs(),
]
