import type { Page } from "playwright-core"
import { zonedDateTime } from "@spy4x/time/tz"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/**
 * `Prose`, `TldrBox`, `PostList`, `FactList`, `ListField` and `DateTimeField`: the blocks of a blog
 * and of a record's detail page, and the two fields its editor needs.
 */
function blogBlockSpecs(): Spec[] {
  const cards = [
    "#demo-Prose",
    "#demo-TldrBox",
    "#demo-PostList",
    "#demo-FactList",
    "#demo-ListField",
    "#demo-DateTimeField",
  ] as const
  const line = (page: Page, n: number) =>
    page.locator("#demo-ListField").getByRole("textbox", { name: `Key point ${n}`, exact: true })
  const value = (page: Page) => page.locator(`[data-e2e="list-field-value"]`)
  return [
    {
      name:
        "ListField: Enter adds a line after the focused one and moves there without submitting the form",
      pageId: "ui",
      run: async (page) => {
        await line(page, 1).click()
        await page.keyboard.press("Enter")
        await line(page, 2).and(page.locator(":focus")).waitFor()
        await page.keyboard.type("Typed in the new line.")
        await value(page).filter({
          hasText:
            `["Jobs are written down first.","Typed in the new line.","A failed run retries on its own."]; submitted 0 times`,
        }).waitFor()
      },
    },
    {
      name:
        "ListField: Backspace in an empty line removes it and returns to the end of the line before",
      pageId: "ui",
      run: async (page) => {
        await line(page, 2).click()
        await page.keyboard.press("Enter")
        await line(page, 3).and(page.locator(":focus")).waitFor()
        await page.keyboard.press("Backspace")
        await line(page, 3).waitFor({ state: "detached" })
        await line(page, 2).and(page.locator(":focus")).waitFor()
        await value(page).filter({
          hasText:
            `["Jobs are written down first.","A failed run retries on its own."]; submitted 0 times`,
        }).waitFor()
        const caret = await line(page, 2).evaluate((input: HTMLInputElement) =>
          input.selectionStart === input.value.length
        )
        if (!caret) throw new Error("the caret is not at the end of the line before")
      },
    },
    {
      name:
        "ListField: removing a line moves focus to the line that took its place, and the last to Add",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ListField")
        await card.getByRole("button", { name: "Remove key point 1" }).click()
        await line(page, 1).and(page.locator(":focus")).waitFor()
        await value(page).filter({ hasText: `["A failed run retries on its own."]` }).waitFor()
        await card.getByRole("button", { name: "Remove key point 1" }).click()
        await card.getByRole("button", { name: "Add point" }).and(page.locator(":focus")).waitFor()
        await value(page).filter({ hasText: "[]; submitted 0 times" }).waitFor()
      },
    },
    {
      name: "ListField: at five lines the Add button goes away and Enter adds nothing",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ListField")
        const add = card.getByRole("button", { name: "Add point" })
        for (let n = 3; n <= 5; n++) {
          await add.click()
          await line(page, n).and(page.locator(":focus")).waitFor()
        }
        await add.waitFor({ state: "detached" })
        await card.getByText("5 of 5").waitFor()
        await page.keyboard.press("Enter")
        await line(page, 6).waitFor({ state: "detached" })
        await line(page, 5).and(page.locator(":focus")).waitFor()
        await value(page).filter({ hasText: "submitted 0 times" }).waitFor()
      },
    },
    {
      name:
        "DateTimeField: a change from the keyboard is stored as the instant the Berlin wall clock names",
      pageId: "ui",
      run: async (page) => {
        const input = page.locator("#guide-publish-at")
        const stored = page.locator(`[data-e2e="date-time-field-value"]`)
        await stored.filter({ hasText: "Stored: 2026-10-25T08:30:00.000Z" }).waitFor()
        await input.focus()
        await page.keyboard.press("ArrowUp")
        await stored.filter({ hasNotText: "2026-10-25T08:30:00.000Z" }).waitFor()
        // ArrowUp steps the first segment, a date part in every locale, so the time stays 09:30.
        // Read back after the store re-renders: a field that stored the wrong instant shows
        // another wall clock than the one typed.
        const date = (await input.inputValue()).split("T")[0]
        const expected = zonedDateTime(date, "09:30", "Europe/Berlin").toISOString()
        await stored.filter({ hasText: `Stored: ${expected}` }).waitFor()
        const wall = await input.inputValue()
        if (wall !== `${date}T09:30`) throw new Error(`the input shows ${wall}, not ${date}T09:30`)
        await page.locator("#guide-publish-at-zone").filter({ hasText: "Berlin, Europe" }).waitFor()
        return `${wall} in Berlin is ${expected}`
      },
    },
    ...(["light", "dark"] as const).map((palette): Spec => ({
      name: `Prose, TldrBox, PostList, FactList, ListField and DateTimeField: axe finds no ` +
        `violation, their text's contrast included, ${palette}`,
      pageId: "ui",
      colorScheme: palette,
      run: async (page) => {
        await page.locator(cards[0]).waitFor()
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        return await axePasses(page, cards)
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...blogBlockSpecs(),
]
