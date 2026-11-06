import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/**
 * `RadioChips`: native radios drawn as chips. Arrow keys move the choice within one tab stop and
 * skip the disabled chip, the page's own `:has(#id:checked)` CSS follows the choice, the checked
 * chip shows the accent fill and the focus ring, and axe passes in both palettes.
 */
function radioChipsSpecs(): Spec[] {
  const card = (page: Page) => page.locator("#demo-RadioChips")
  return [
    {
      name:
        "RadioChips: arrow keys move the one checked chip within one tab stop, skip the disabled chip, page CSS follows it, and the chip shows the fill and the focus ring",
      pageId: "ui",
      run: async (page) => {
        const group = card(page).getByRole("group", { name: "Which tools the server offers" })
        const radio = (name: string, checked: boolean) =>
          group.getByRole("radio", { name, checked })
        const focused = page.locator(":focus")
        const deleteTool = card(page).locator(`[data-tool="delete"]`)
        await radio("All tools", true).waitFor()
        await deleteTool.waitFor({ state: "visible" })

        await radio("All tools", true).focus()
        await page.keyboard.press("ArrowRight")
        await radio("Read only", true).and(focused).waitFor()
        await radio("All tools", false).waitFor()
        await deleteTool.waitFor({ state: "hidden" })

        await page.keyboard.press("ArrowRight")
        await radio("All tools", true).and(focused).waitFor()
        await deleteTool.waitFor({ state: "visible" })

        // `has` is matched inside each label, so it takes a locator from the page, not the group.
        const chipOf = (name: string, checked: boolean) =>
          card(page).locator("label").filter({ has: page.getByRole("radio", { name, checked }) })
        const look = (name: string, checked: boolean) =>
          chipOf(name, checked).evaluate((label) => {
            const style = getComputedStyle(label)
            return { ring: style.boxShadow, fill: style.backgroundColor }
          })

        await page.keyboard.press("Tab")
        const left = await group.evaluate((element) => !element.contains(document.activeElement))
        if (!left) throw new Error("Tab stayed inside the group: more than one tab stop")
        const resting = await look("All tools", true)

        await page.keyboard.press("Shift+Tab")
        await radio("All tools", true).and(focused).waitFor()
        const focusedChip = await look("All tools", true)
        const unchecked = await look("Read only", false)
        if (focusedChip.ring === resting.ring || resting.fill === unchecked.fill) {
          throw new Error(
            `focused ${JSON.stringify(focusedChip)}, resting ${JSON.stringify(resting)}, ` +
              `unchecked ${JSON.stringify(unchecked)}`,
          )
        }
        return `checked fill ${resting.fill}, focus ring ${focusedChip.ring}`
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name:
        `RadioChips: axe finds no violation on the chips, text colour contrast included, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await card(page).getByRole("radio", { name: "All tools", checked: true }).waitFor()
        return await axePasses(page, ["#demo-RadioChips"])
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...radioChipsSpecs(),
]
