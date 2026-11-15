import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

export const specs: readonly Spec[] = [
  ...(["light", "dark"] as const).map((colorScheme): Spec => ({
    name:
      `ToggleChips: axe finds no violation on the chips, text colour contrast included, ${colorScheme}`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const card = page.locator("#demo-ToggleChips")
      await card.getByRole("button", { name: "home", pressed: false }).waitFor()
      await card.getByRole("button", { name: "work", pressed: true }).waitFor()
      return await axePasses(page, ["#demo-ToggleChips"])
    },
  })),
]
