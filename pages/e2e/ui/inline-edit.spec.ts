import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { holdTimer } from "./shared.ts"

/** How long the card's first demo takes to save, in milliseconds. */
const SAVE_MS = 400

/**
 * One of the `InlineEdit` card's two demos: `ok`, whose save takes {@link SAVE_MS} and then
 * changes the card's echo, or `fail`, whose save always rejects.
 */
function inlineEdit(page: Page, which: "ok" | "fail") {
  const card = page.locator("#demo-InlineEdit")
  const root = card.locator(`[data-e2e="inline-edit-${which}"]`)
  const field = root.locator("input")
  const button = root.getByRole("button")
  /** Waits for the focus to be on one element. */
  const focused = (target: Locator) => target.and(page.locator(":focus")).waitFor()
  return {
    card,
    field,
    button,
    focused,
    echo: card.locator(`[data-e2e="inline-edit-saved"]`),
    /** Presses Enter on the value's button and waits for the field to open with the focus. */
    open: async () => {
      await button.press("Enter")
      await focused(field)
    },
    /**
     * Waits for the field to be closed, with the value's button showing `text` and holding the
     * focus: the component moves the focus in an effect after the render that closes the field.
     */
    closedOnButton: async (text: string) => {
      await field.waitFor({ state: "detached" })
      await focused(button.filter({ hasText: text }))
    },
  }
}

/** The card's echo, word for word, such as `saved: Groceries, saves: 0`. */
async function echoText(echo: Locator): Promise<string> {
  return (await echo.textContent() ?? "").trim()
}

/**
 * `InlineEdit`'s keyboard and focus contract, driven with real key presses on the card's two demos,
 * each spec on a fresh page. Enter on the value's button opens the field with the whole value
 * selected; Escape closes it with the old value back and focus on the button; Enter saves, shows
 * the busy state while the save runs, then closes with the new value and focus on the button; an
 * empty text closes without saving; Tab away saves without pulling focus back; and a save that
 * rejects keeps the field open with the typed text and an alert. A string render sees none of
 * this: every step is an effect, a key press or a focus move.
 */
export const specs: readonly Spec[] = [
  {
    name: "InlineEdit: Enter on its value opens the field focused with the whole value selected",
    pageId: "ui",
    run: async (page) => {
      const edit = inlineEdit(page, "ok")
      const before = (await edit.button.textContent() ?? "").trim()
      await edit.open()
      const opened = await edit.field.evaluate((element) => {
        const field = element as HTMLInputElement
        return {
          text: field.value,
          allSelected: field.value.length > 0 && field.selectionStart === 0 &&
            field.selectionEnd === field.value.length,
        }
      })
      if (opened.text !== before || !opened.allSelected) {
        throw new Error(`"${before}" → "${opened.text}", all selected ${opened.allSelected}`)
      }
    },
  },
  {
    name: "InlineEdit: Escape cancels: the old value is back and focus returns to its button",
    pageId: "ui",
    run: async (page) => {
      const edit = inlineEdit(page, "ok")
      const before = (await edit.button.textContent() ?? "").trim()
      const echo = await echoText(edit.echo)
      await edit.open()
      await page.keyboard.insertText("Shopping")
      const typed = await edit.field.inputValue()
      if (typed !== "Shopping") throw new Error(`the field reads "${typed}" after typing`)
      await page.keyboard.press("Escape")
      await edit.closedOnButton(before)
      const after = await echoText(edit.echo)
      if (after !== echo) throw new Error(`Escape saved: "${echo}" → "${after}"`)
    },
  },
  {
    name:
      "InlineEdit: Enter saves: busy while the save runs, then the new value and focus on its button",
    pageId: "ui",
    run: async (page) => {
      const edit = inlineEdit(page, "ok")
      await edit.open()
      await page.keyboard.insertText("Shopping")
      // The demo's save is held until the busy field is seen, so a slow machine cannot finish it
      // first.
      const save = await holdTimer(page, SAVE_MS)
      await page.keyboard.press("Enter")
      await edit.focused(
        edit.field.and(page.locator(`[aria-busy="true"][readonly]`)),
      )
      await save()
      await edit.closedOnButton("Shopping")
      await edit.echo.getByText("saved: Shopping, saves: 1", { exact: true }).waitFor()
    },
  },
  {
    name: "InlineEdit: Enter on a blank field closes it without saving",
    pageId: "ui",
    run: async (page) => {
      const edit = inlineEdit(page, "ok")
      const before = (await edit.button.textContent() ?? "").trim()
      const echo = await echoText(edit.echo)
      await edit.open()
      await edit.field.fill("   ")
      // A save starts its timer inside the key press that asks for it, so a count still at zero
      // once the field has closed proves none started.
      type Counted = typeof globalThis & { e2eSaveTimers?: number }
      await page.evaluate((delay) => {
        const realSet = globalThis.setTimeout
        ;(globalThis as Counted).e2eSaveTimers = 0
        globalThis.setTimeout = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
          if (ms === delay) (globalThis as Counted).e2eSaveTimers! += 1
          return realSet(handler, ms, ...rest)
        }) as typeof globalThis.setTimeout
      }, SAVE_MS)
      await page.keyboard.press("Enter")
      await edit.closedOnButton(before)
      const timers = await page.evaluate(() => (globalThis as Counted).e2eSaveTimers)
      const after = await echoText(edit.echo)
      if (timers !== 0 || after !== echo) {
        throw new Error(`${timers} save(s) started; echo "${echo}" → "${after}"`)
      }
    },
  },
  {
    name: "InlineEdit: Tab away saves it and leaves focus where Tab moved it",
    pageId: "ui",
    run: async (page) => {
      const edit = inlineEdit(page, "ok")
      await edit.open()
      await page.keyboard.insertText("Errands")
      await page.keyboard.press("Tab")
      await edit.field.waitFor({ state: "detached" })
      await edit.button.filter({ hasText: "Errands" }).waitFor()
      await edit.echo.getByText("saved: Errands, saves: 1", { exact: true }).waitFor()
      await edit.focused(edit.card.locator(`[data-e2e="inline-edit-remove"]`))
    },
  },
  {
    name: "InlineEdit: a rejected save keeps the field open with the typed text, focused, and an " +
      "alert; Escape then restores the old value and focuses its button",
    pageId: "ui",
    run: async (page) => {
      const edit = inlineEdit(page, "fail")
      const before = (await edit.button.textContent() ?? "").trim()
      await edit.open()
      await page.keyboard.insertText("Old things")
      await page.keyboard.press("Enter")
      await edit.card.locator(`[data-e2e="inline-edit-fail"] [role="alert"]`)
        .filter({ hasText: /\S/ }).waitFor()
      // Settled: no longer busy, editable again, and still focused.
      await edit.focused(edit.field.and(page.locator(`:not([aria-busy]):not([readonly])`)))
      const text = await edit.field.inputValue()
      if (text !== "Old things") throw new Error(`the field reads "${text}" after the rejection`)
      await page.keyboard.press("Escape")
      await edit.closedOnButton(before)
    },
  },
]
