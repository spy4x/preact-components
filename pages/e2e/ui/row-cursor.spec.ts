import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/** The index of the row marked `aria-current="true"` among `rows`, or `-1` for none. */
async function currentRow(rows: Locator): Promise<number> {
  return await rows.evaluateAll((all) =>
    all.findIndex((row) => row.getAttribute("aria-current") === "true")
  )
}

/** Waits until row `index` is the only highlighted one, drawn with the cursor's outline. */
async function highlightIs(rows: Locator, index: number): Promise<void> {
  await rows.nth(index).and(rows.page().locator(`[aria-current="true"]`)).waitFor()
  const marked = await rows.evaluateAll((all) =>
    all.map((row) => ({
      current: row.getAttribute("aria-current") === "true",
      outline: getComputedStyle(row).outlineStyle,
    }))
  )
  const wrong = marked.findIndex((row, at) =>
    row.current !== (at === index) || (row.outline === "solid") !== (at === index)
  )
  if (wrong !== -1) {
    throw new Error(`row ${wrong} is drawn ${JSON.stringify(marked[wrong])}; expected row ${index}`)
  }
}

/** A key press to send: the character, the physical key and the modifiers held. */
interface Press {
  key: string
  code: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

/** Sends a `keydown` the way a press of `key` on the physical key `code` arrives at `target`. */
async function dispatchKey(
  page: Page,
  init: Press,
  target: "document" | "input" | "textarea" | "editable" = "document",
): Promise<void> {
  await page.evaluate(({ init, target }) => {
    const element = target === "document"
      ? document.body
      : target === "editable"
      ? Object.assign(document.createElement("div"), { contentEditable: "true" })
      : document.createElement(target)
    if (target !== "document") document.body.append(element)
    element.dispatchEvent(
      new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }),
    )
    if (target !== "document") element.remove()
  }, { init, target })
}

/**
 * Throws unless the readout still says nothing was opened. Read at once, not waited for: Preact
 * draws a signal's change in a microtask, which has run by the time the key press returns.
 */
async function nothingOpened(readout: Locator): Promise<void> {
  const text = await readout.textContent()
  if (text !== "Opened: none") throw new Error(`the readout says "${text}"`)
}

/** Leaves focus on nothing, so a key press lands on the page rather than a control. */
async function blur(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
}

export const specs: readonly Spec[] = [
  {
    name: "useRowCursor on card rows: off, the keys do nothing; on, j and k highlight one row " +
      "and stop at both ends, the Cyrillic о moves like j, a modifier or a press in a field does " +
      "nothing, Enter on a control stays with it, Enter opens the row, and axe passes",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-Elapsed")
      const rows = card.locator(`[data-e2e="elapsed-jobs"] > li`)
      const opened = card.locator(`[data-e2e="elapsed-opened"]`)
      const keys = card.locator(`[data-e2e="elapsed-keys"]`)
      await card.scrollIntoViewIfNeeded()

      await page.keyboard.press("j")
      if (await currentRow(rows) !== -1) throw new Error("j moved the cursor while it was off")

      await keys.check()
      // Focus is on the checkbox: Enter there belongs to it, and no row is highlighted yet anyway.
      await page.keyboard.press("Enter")
      await blur(page)
      await page.keyboard.press("Enter")
      await nothingOpened(opened)

      await page.keyboard.press("k")
      await highlightIs(rows, 0)
      await page.keyboard.press("j")
      await highlightIs(rows, 1)
      await page.keyboard.press("j")
      await page.keyboard.press("j")
      await highlightIs(rows, 2)
      await page.keyboard.press("k")
      await page.keyboard.press("k")
      await page.keyboard.press("k")
      await highlightIs(rows, 0)

      // The Russian layout's key on the J key types о; the cursor matches the physical key.
      await dispatchKey(page, { key: "о", code: "KeyJ" })
      await highlightIs(rows, 1)

      for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
        await dispatchKey(page, { key: "j", code: "KeyJ", ...init })
      }
      await page.keyboard.press("Shift+J")
      for (const target of ["input", "textarea", "editable"] as const) {
        await dispatchKey(page, { key: "j", code: "KeyJ" }, target)
      }
      await highlightIs(rows, 1)

      await keys.focus()
      await page.keyboard.press("Enter")
      await nothingOpened(opened)
      await blur(page)
      await page.keyboard.press("Enter")
      await opened.getByText("Opened: Nightly backup", { exact: true }).waitFor()
      return await axePasses(page, ["#demo-Elapsed"])
    },
  },
  ...(["light", "dark"] as const).map((colorScheme): Spec => ({
    name: `DataTable cursor (${colorScheme}): on, j highlights the first row, scrolls the ` +
      "highlighted row into view, stops on the last, the Cyrillic л moves like k, Enter opens " +
      "the row, and axe passes",
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const block = page.locator(`[data-e2e="data-table-cursor"]`)
      const rows = block.locator("tbody > tr")
      const opened = block.locator(`[data-e2e="data-table-opened"]`)
      await block.scrollIntoViewIfNeeded()
      await block.locator(`[data-e2e="data-table-cursor-keys"]`).check()
      await blur(page)

      await page.keyboard.press("j")
      await highlightIs(rows, 0)
      const count = await rows.count()
      for (let press = 0; press < count; press++) await page.keyboard.press("j")
      await highlightIs(rows, count - 1)
      await dispatchKey(page, { key: "л", code: "KeyK" })
      await highlightIs(rows, count - 2)

      // Scrolled away, the next move brings the highlighted row back into view.
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }))
      await page.keyboard.press("j")
      await highlightIs(rows, count - 1)
      await page.waitForFunction((row) => {
        const box = row?.getBoundingClientRect()
        // A pixel of slack: "nearest" lines the row's bottom up with the viewport's to a fraction.
        return box !== undefined && box.top >= -1 && box.bottom <= innerHeight + 1
      }, await rows.nth(count - 1).elementHandle())

      await page.keyboard.press("Enter")
      const merchant = await rows.nth(count - 1).locator("td").nth(1).textContent()
      await opened.getByText(`Opened: ${merchant}`, { exact: true }).waitFor()
      return await axePasses(page, [`[data-e2e="data-table-cursor"]`])
    },
  })),
]
