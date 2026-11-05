import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/**
 * Presses inside a field of an open dialog, releases on the backdrop, and throws when that closed
 * the dialog: the slipped mouse at the end of a text selection.
 *
 * @param page The page.
 * @param dialog The open `<dialog>`.
 * @param field Where the press begins.
 * @returns The backdrop point the press was released on, halfway between the viewport's left edge
 * and the panel's.
 */
async function dragToBackdrop(page: Page, dialog: Locator, field: Locator) {
  const box = await dialog.boundingBox()
  const start = await field.boundingBox()
  if (!box || !start) throw new Error("the dialog or its field has no box")
  if (box.x < 8) throw new Error(`the panel starts at x=${box.x}, leaving no backdrop`)
  const outside = { x: box.x / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x + 8, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(outside.x, outside.y, { steps: 5 })
  await page.mouse.up()
  const open = await dialog.evaluate((element) => element.matches(":modal"), undefined, {
    timeout: 1_000,
  }).catch(() => false)
  if (!open) {
    throw new Error("a press that began in the field and ended on the backdrop closed the dialog")
  }
  return outside
}

/**
 * What a person typed survives a slipped mouse, a failed submit and a Tab away (#853): a drag that
 * only ends on a `Modal`'s or a `CommandPalette`'s backdrop, an `EnhancedForm` that fails behind its `sending` slot, a
 * `Combobox` left with a query, and a `MoneyInput` whose amount changes from outside.
 */
function lostInputSpecs(): Spec[] {
  return [
    {
      name:
        "Modal: a drag from an input to the backdrop keeps the dialog open; a plain backdrop click closes it",
      pageId: "ui",
      run: async (page) => {
        await page.locator(`#demo-Modal [data-e2e="modal-form-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="guide-modal-form"]`)
        await dialog.waitFor()
        const tags = dialog.getByRole("combobox", { name: "Tags" })
        const outside = await dragToBackdrop(page, dialog, tags)
        await page.mouse.click(outside.x, outside.y)
        await dialog.waitFor({ state: "detached" })
      },
    },
    {
      name:
        "CommandPalette: a drag from its field to the backdrop keeps it open; a plain backdrop click closes it",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.locator(`#demo-CommandPalette [data-e2e="palette-local-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="palette-local"]`)
        await dialog.waitFor()
        const outside = await dragToBackdrop(page, dialog, dialog.getByRole("combobox"))
        await page.mouse.click(outside.x, outside.y)
        await dialog.waitFor({ state: "hidden" })
      },
    },
    {
      name: "EnhancedForm: a failed submit with a sending slot gives back the typed note, enabled",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator(`#demo-EnhancedForm [data-e2e="enhanced-form"]`)
        const note = card.locator("#guide-enhanced-form-note")
        await card.locator(`[data-e2e="enhanced-form-fail-toggle"]`).check()
        await note.fill("Typed before the failure")
        await card.getByRole("button", { name: "Submit", exact: true }).click()
        // The sending slot shows for 200 ms, too short to wait for reliably under load; the
        // fields it hides are what this reads back.
        await card.getByText("Something went wrong. Try again.", { exact: true }).waitFor()
        await note.and(page.locator(":enabled")).waitFor()
        const kept = await note.inputValue()
        if (kept !== "Typed before the failure") throw new Error(`the note reads "${kept}"`)
      },
    },
    {
      name:
        "Combobox: Tab out with a typed query shows only the selected value and no empty message",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-Combobox")
        const coin = card.locator("#guide-combobox-coin")
        await coin.click()
        await coin.pressSequentially("zzz")
        await card.getByText("No coin matches “zzz”").first().waitFor()
        await coin.press("Tab")
        await coin.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        const shown = await coin.inputValue()
        if (shown !== "BTC") throw new Error(`the closed field reads "${shown}", not "BTC"`)
        const left = await card.getByText("No coin matches", { exact: false }).count()
        if (left > 0) throw new Error(`${left} elements still say "No coin matches" after Tab`)
      },
    },
    {
      name: "Combobox: Tab from the input onto its clear button closes the list",
      pageId: "ui",
      run: async (page) => {
        const coin = page.locator("#demo-Combobox #guide-combobox-coin")
        await coin.click()
        await coin.and(page.locator(`[aria-expanded="true"]`)).waitFor()
        await coin.press("Tab")
        const onClear = await coin.evaluate((input) =>
          document.activeElement === input.parentElement?.querySelector("button")
        )
        if (!onClear) throw new Error(`Tab did not move focus to the clear button`)
        await coin.and(page.locator(`[aria-expanded="false"]`)).waitFor()
      },
    },
    {
      name:
        "Combobox: Tab out of an open list that scrolls lands on the next control, not on the list or the page",
      pageId: "ui",
      run: async (page) => {
        const offset = page.locator("#demo-Combobox #guide-combobox-offset")
        await offset.click()
        await offset.and(page.locator(`[aria-expanded="true"]`)).waitFor()
        const scrolls = await offset.evaluate((input) => {
          const list = document.getElementById(input.getAttribute("aria-controls") ?? "")
          return list !== null && list.scrollHeight > list.clientHeight
        })
        // Without an overflowing list, Chrome makes no tab stop of it and this proves nothing.
        if (!scrolls) throw new Error(`the offset list does not scroll`)

        await offset.press("Tab")

        await offset.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        const open = await page.evaluate(() => {
          const active = document.activeElement
          if (!active || active === document.body) return "the page body"
          if (active.getAttribute("role") === "listbox") return "the list"
          active.setAttribute("data-spec-tab-target", "")
          return null
        })
        if (open !== null) throw new Error(`Tab from the open list moved focus to ${open}`)
        // From a closed field, Tab reaches the next control: the open one must reach the same.
        await offset.focus()
        await offset.press("Escape")
        await offset.and(page.locator(`[aria-expanded="false"]`)).waitFor()
        await offset.press("Tab")
        const same = await page.evaluate(() =>
          document.activeElement?.hasAttribute("data-spec-tab-target") === true
        )
        if (!same) throw new Error(`Tab from the open list and from the closed field went apart`)
      },
    },
    {
      name:
        "MoneyInput: an amount changed from outside while the field is not focused updates its text",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-MoneyInput")
        const price = card.locator("#guide-money-input")
        const before = await price.inputValue()
        if (before !== "19,99") throw new Error(`the field starts at "${before}", not "19,99"`)
        await card.locator(`[data-e2e="money-input-add-five"]`).click()
        await card.getByText("amount: 2499", { exact: true }).waitFor()
        const shown = await price.inputValue()
        if (shown !== "24,99") throw new Error(`the field reads "${shown}", not "24,99"`)
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...lostInputSpecs(),
]
