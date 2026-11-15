import { AxeBuilder } from "@axe-core/playwright"
import type { Spec } from "../runner.ts"

/** Specs of the `PasswordInput` card. */
export const specs: readonly Spec[] = [
  {
    name:
      "PasswordInput: the eye shows the password and back, renames itself, never submits the form, and the card passes axe",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-PasswordInput")
      const input = card.locator(`[data-e2e="password-input"]`)
      const toggle = card.locator(`[data-e2e="password-toggle"]`)
      await input.fill("hunter22")

      await card.getByRole("button", { name: "Show password", exact: true }).click()
      await input.and(page.locator(`[type="text"]`)).waitFor()
      await toggle.and(page.locator(`[aria-pressed="true"][aria-label="Hide password"]`)).waitFor()
      // The Enter below goes to the toggle. Chromium focuses a clicked button on its own, so this
      // does not prove the component's own focus call, which is there for engines that do not.
      await toggle.and(page.locator(":focus")).waitFor()

      await page.keyboard.press("Enter")
      await input.and(page.locator(`[type="password"]`)).waitFor()
      await toggle.and(page.locator(`[aria-pressed="false"][aria-label="Show password"]`))
        .waitFor()
      await card.locator(`[data-e2e="password-submits"]`).getByText("submits: 0", { exact: true })
        .waitFor()
      if ((await input.inputValue()) !== "hunter22") throw new Error("the toggle lost the text")

      const { violations } = await new AxeBuilder({ page }).include("#demo-PasswordInput")
        .analyze()
      if (violations.length > 0) {
        throw new Error(`axe: ${violations.map((violation) => violation.id).join(", ")}`)
      }
    },
  },
]
