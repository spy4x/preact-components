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
  {
    name:
      "ToggleChips: at 375 px seven weekday chips are each at least 44 px high and 24 px wide, none overflowing",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 375, height: 812 })
      const group = page.locator(`#demo-ToggleChips [role="group"][aria-label="Repeat on"]`)
      await group.getByRole("button", { name: "Mon", pressed: true }).waitFor()
      const fit = await group.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const chips = [...element.querySelectorAll("button")].map((button) => {
          const r = button.getBoundingClientRect()
          return {
            text: button.textContent?.trim(),
            width: r.width,
            height: r.height,
            outside: r.left < box.left || r.right > box.right || r.right > innerWidth,
          }
        })
        return { scroll: element.scrollWidth, client: element.clientWidth, chips }
      })
      const small = fit.chips.filter((chip) => chip.height < 44 || chip.width < 24)
      const outside = fit.chips.filter((chip) => chip.outside)
      if (
        fit.chips.length !== 7 || small.length > 0 || outside.length > 0 || fit.scroll > fit.client
      ) {
        throw new Error(`weekday chips at 375 px: ${JSON.stringify(fit)}`)
      }
      const heights = fit.chips.map((chip) => chip.height)
      return `7 chips, ${Math.min(...heights)} px high at least, in a ${fit.client} px row`
    },
  },
]
