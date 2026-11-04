import type { Spec } from "../runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "OnOffButtons: a click and a key press move aria-pressed, inside a named group",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-OnOffButtons")
      const group = card.getByRole("group", { name: "ON / OFF", exact: true })
      const half = (name: string, pressed: boolean) =>
        group.getByRole("button", { name, exact: true, pressed })

      await half("ON", false).waitFor()
      await half("OFF", false).waitFor()
      await half("ON", false).click()
      await half("ON", true).waitFor()
      await half("OFF", false).waitFor()
      await half("OFF", false).press("Enter")
      await half("OFF", true).waitFor()
      await half("ON", false).waitFor()
      await half("ON", false).press("Space")
      await half("ON", true).waitFor()
      await half("OFF", false).waitFor()
      // The second pair shows the same value under the caller's own group name and labels.
      const named = card.getByRole("group", { name: "Rows to show", exact: true })
      await named.getByRole("button", { name: /^Active/, pressed: true }).waitFor()
      await named.getByRole("button", { name: /^Archived/, pressed: false }).waitFor()
    },
  },
]
