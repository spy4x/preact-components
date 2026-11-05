import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/**
 * `IconPicker`: the card's picker in English and, after the language chips, in Russian. The search
 * finds the car by its Russian name and by "car", every tile is named in the reader's language,
 * Enter in the search box chooses and never submits the form, ArrowDown moves to the checked tile,
 * Escape empties the box, a search with no match offers Clear search, and axe passes in both
 * palettes at 390 and 1440 px with a tile's name bubble showing.
 */
function iconPickerSpecs(): Spec[] {
  const card = (page: Page) => page.locator("#demo-IconPicker")
  const search = (page: Page) => card(page).locator(`[data-e2e="icon-picker-search"]`)
  const stored = (page: Page, text: string) =>
    card(page).locator(`[data-e2e="icon-picker-value"]`).getByText(text).waitFor()
  return [
    {
      name:
        "IconPicker: in Russian the search finds the car by машина and by car, and each tile is named in Russian",
      pageId: "ui",
      run: async (page) => {
        await card(page).getByText("Русский", { exact: true }).click()
        await card(page).getByRole("radio", { name: "Русский", checked: true }).waitFor()
        const group = card(page).getByRole("group", { name: "Значок", exact: true })
        await group.getByRole("radio", { name: "Машина", exact: true, checked: true }).waitFor()
        await group.getByRole("radio", { name: "Дом", exact: true }).waitFor()
        for (const query of ["машина", "car"]) {
          await search(page).fill(query)
          await group.getByRole("radio", { name: "Машина", exact: true }).waitFor()
          const count = await group.getByRole("radio").count()
          if (count > 6) throw new Error(`"${query}" left ${count} icons`)
        }
        await card(page).getByRole("status").getByText(/значк/).waitFor()
      },
    },
    {
      name:
        "IconPicker: Enter in the search chooses the first icon without submitting the form, ArrowDown moves to the checked tile, Escape empties the box",
      pageId: "ui",
      run: async (page) => {
        await search(page).fill("coffee")
        await search(page).press("Enter")
        await stored(page, "coffee")
        await card(page).locator(`[data-e2e="icon-picker-value"]`).getByText("saves: 0").waitFor()
        await search(page).press("ArrowDown")
        const focused = await page.evaluate(() => {
          const element = document.activeElement as HTMLInputElement | null
          return element?.type === "radio" && element.checked ? element.value : null
        })
        if (focused !== "coffee") throw new Error(`ArrowDown focused ${focused}`)
        await search(page).fill("tea")
        await search(page).press("Escape")
        const left = await search(page).inputValue()
        if (left !== "") throw new Error(`Escape left "${left}" in the search box`)
      },
    },
    {
      name: "IconPicker: a search with no match says so and Clear search brings every icon back",
      pageId: "ui",
      run: async (page) => {
        await search(page).fill("zzz")
        // The visible message, not the live region that says the same words.
        await card(page).locator("p:not([role=status])", { hasText: "No icon matches “zzz”." })
          .waitFor()
        await card(page).getByRole("button", { name: "Clear search", exact: true }).last().click()
        await card(page).getByRole("radio", { name: "Car", exact: true }).waitFor()
        const count = await card(page).locator(`[data-e2e="icon-picker-tile"]`).count()
        if (count !== 43) throw new Error(`${count} tiles after clearing, not 43`)
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name:
        `IconPicker: axe finds no violation with a tile's name showing, at 390 and 1440 px, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const results: string[] = []
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await search(page).focus()
          await search(page).press("ArrowDown")
          results.push(`${width}: ${await axePasses(page, ["#demo-IconPicker"])}`)
        }
        return results.join("; ")
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...iconPickerSpecs(),
]
