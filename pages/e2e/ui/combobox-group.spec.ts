import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses, holdTimer } from "./shared.ts"

/**
 * `Combobox` with `groupOf`, `isGroupLead`, `aliasesOf` and `onCreate`, on the card's category
 * field: one named group per parent and one for the parentless "Other", arrow keys that walk the
 * options and never the "Other" heading, a parent that can be chosen, the forgiving search, a
 * Create row that Enter presses, a failed create as a field error, and axe in both palettes at 390
 * and 1440 px.
 */
function comboboxGroupSpecs(): Spec[] {
  const card = (page: Page) => page.locator("#demo-Combobox")
  const field = (page: Page) => card(page).locator("#guide-combobox-category")
  const list = (page: Page) => card(page).locator("#guide-combobox-category-listbox")
  /** The text of the option `aria-activedescendant` points at, or `null`. */
  const activeText = (page: Page) =>
    field(page).evaluate((input) => {
      const id = input.getAttribute("aria-activedescendant")
      const row = id ? document.getElementById(id) : null
      return row === null ? null : `${row.getAttribute("role")}:${row.textContent?.trim()}`
    })
  /** Opens the list with nothing typed. */
  const open = async (page: Page) => {
    await field(page).click()
    await field(page).fill("")
    await field(page).and(page.locator(`[aria-expanded="true"]`)).waitFor()
  }
  return [
    {
      name:
        "Combobox: grouped categories have one named group per parent, the Other heading is no option, the arrows walk every option, and a parent can be chosen",
      pageId: "ui",
      run: async (page) => {
        await open(page)
        for (const name of ["Home", "Food", "Health", "Other"]) {
          await list(page).getByRole("group", { name, exact: true }).waitFor()
        }
        const otherOptions = await list(page).getByRole("option", { name: "Other", exact: true })
          .count()
        if (otherOptions > 0) throw new Error(`the Other heading is drawn as an option`)
        const optionCount = await list(page).getByRole("option").count()
        const walked: (string | null)[] = []
        for (let step = 0; step < optionCount; step++) {
          await field(page).press("ArrowDown")
          walked.push(await activeText(page))
        }
        if (walked.some((text) => text === null || !text.startsWith("option:"))) {
          throw new Error(
            `the arrows reached something that is not an option: ${walked.join(", ")}`,
          )
        }
        if (walked.includes("option:Other")) {
          throw new Error(`the arrows landed on the Other heading: ${walked.join(", ")}`)
        }
        if (new Set(walked).size < optionCount - 1) {
          throw new Error(`the arrows did not walk every option: ${walked.join(", ")}`)
        }
        await field(page).fill("Food")
        await list(page).getByRole("option", { name: "Food", exact: true }).waitFor()
        await field(page).press("Enter")
        await card(page).locator(`[data-e2e="controlled-value"]`)
          .getByText("category: Food", { exact: true }).waitFor()
        const shown = await field(page).inputValue()
        if (shown !== "Food") throw new Error(`the closed field reads "${shown}", not "Food"`)
        return `${optionCount} options walked: ${walked.join(" → ")}`
      },
    },
    {
      name:
        "Combobox: words in any order, a typo, an alias and the Russian keyboard layout each find Eating out, under Food",
      pageId: "ui",
      run: async (page) => {
        await open(page)
        for (const query of ["out eat", "eatng out", "restaurant", "щге уфештп"]) {
          await field(page).fill(query)
          await list(page).getByRole("group", { name: "Food", exact: true })
            .getByRole("option", { name: "Eating out", exact: true }).waitFor()
        }
        await field(page).press("Enter")
        await card(page).locator(`[data-e2e="controlled-value"]`)
          .getByText("category: Eating out", { exact: true }).waitFor()
        const shown = await field(page).inputValue()
        if (shown !== "Eating out (Food)") throw new Error(`the closed field reads "${shown}"`)
      },
    },
    {
      name:
        "Combobox: with nothing else matching, Create “Gym” is highlighted, Enter calls onCreate with Gym, the row spins while it saves, and the new item is chosen",
      pageId: "ui",
      run: async (page) => {
        await open(page)
        await field(page).fill("Gym")
        const create = list(page).getByRole("option", { name: "Create “Gym”", exact: true })
        await create.waitFor()
        const active = await activeText(page)
        if (active !== "option:Create “Gym”") throw new Error(`the highlight is on ${active}`)
        // The demo's 800 ms save is held until the spinning row is seen, so a slow machine cannot
        // finish the save before the check looks.
        const save = await holdTimer(page, 800)
        await field(page).press("Enter")
        await list(page).locator(`[role="option"][aria-busy="true"]`).waitFor()
        await save()
        await card(page).locator(`[data-e2e="controlled-value"]`)
          .getByText("category: Gym, created: Gym", { exact: true }).waitFor()
        const shown = await field(page).inputValue()
        // A created item has no parent, so it joins the Other group and the field names it.
        if (shown !== "Gym (Other)") throw new Error(`the closed field reads "${shown}"`)
      },
    },
    {
      name:
        "Combobox: a failed create shows its error under the field, marks it invalid and keeps the query, and a retry that succeeds clears the error and names the new item",
      pageId: "ui",
      run: async (page) => {
        await card(page).getByRole("checkbox", { name: "Make the next create fail" }).check()
        await open(page)
        await field(page).fill("Travel")
        await field(page).press("Enter")
        const error = card(page).getByRole("alert").getByText(
          "Couldn't create “Travel”. Try again.",
        )
        await error.waitFor()
        await field(page).and(page.locator(`[aria-invalid="true"]`)).waitFor()
        const shown = await field(page).inputValue()
        if (shown !== "Travel") throw new Error(`the field reads "${shown}", not "Travel"`)
        await field(page).press("ArrowDown")
        await list(page).getByRole("option", { name: "Create “Travel”", exact: true }).waitFor()
        await field(page).press("Enter")
        await card(page).locator(`[data-e2e="controlled-value"]`)
          .getByText("category: Travel, created: Travel", { exact: true }).waitFor()
        await error.waitFor({ state: "detached" })
        await field(page).and(page.locator(`[aria-invalid="true"]`)).waitFor({ state: "detached" })
        const retried = await field(page).inputValue()
        if (retried !== "Travel (Other)") {
          throw new Error(`after the retry the field reads "${retried}"`)
        }
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name:
        `Combobox: axe finds no violation on the open grouped list with its Create row, at 390 and 1440 px, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const results: string[] = []
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await open(page)
          await field(page).fill("gi")
          await list(page).getByRole("option", { name: "Create “gi”", exact: true }).waitFor()
          results.push(`${width}: ${await axePasses(page, ["#demo-Combobox"])}`)
          await field(page).press("Escape")
        }
        return results.join("; ")
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...comboboxGroupSpecs(),
]
