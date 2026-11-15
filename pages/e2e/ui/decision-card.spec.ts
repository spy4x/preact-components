import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/** A key press to send: the character it types, the physical key and the modifiers held. */
interface Press {
  key: string
  code: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

/**
 * Sends a `keydown` the way a press of `key` on the physical key `code` arrives: on the page, or
 * on a fresh field of the given kind. A synthesised event, because Playwright's keyboard types
 * the key's own character and cannot send a Cyrillic character on the Latin key.
 */
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

/** Leaves focus on nothing, so a key press lands on the page rather than a control. */
async function blur(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
}

/**
 * Throws unless the readout still says `text`. Read at once, not waited for: Preact draws a
 * signal's change in a microtask, which has run by the time the key press returns.
 */
async function readoutIs(readout: Locator, text: string): Promise<void> {
  const shown = await readout.textContent()
  if (shown !== text) throw new Error(`the readout says "${shown}", not "${text}"`)
}

/** The parts of the `DecisionCard` guide card a spec drives. */
function decisionCard(page: Page) {
  const card = page.locator("#demo-DecisionCard")
  const dialog = page.locator(`[data-e2e="decision-card-dialog"]`)
  return {
    card,
    panel: card.locator(`[data-e2e="decision-card"]`),
    dialog,
    open: card.locator(`[data-e2e="decision-card-open"]`),
    last: card.locator(`[data-e2e="decision-card-last"]`),
    pending: card.locator(`[data-e2e="decision-card-pending"]`),
    /** The dialog's question heading while it holds focus, with the given text. */
    focusedHeading: (text: string) => dialog.locator("h2:focus").filter({ hasText: text }),
  }
}

export const specs: readonly Spec[] = [
  {
    name:
      "DecisionCard: in a Modal the question takes focus on open; 1 to 9, n and e work by the " +
      "physical key (AZERTY's & on Digit1, Cyrillic т and у on N and E), a modifier or a press in " +
      "a field does nothing, each answer moves focus to the next item's question, pending blocks " +
      "the keys, the card on the page binds none, and axe passes in the dialog",
    pageId: "ui",
    run: async (page) => {
      const { card, dialog, open, last, pending, focusedHeading } = decisionCard(page)
      await card.scrollIntoViewIfNeeded()

      await blur(page)
      await page.keyboard.press("1")
      await readoutIs(last, "No answer yet.")

      // While the caller saves, the keys press nothing.
      await pending.check()
      await open.click()
      await focusedHeading("Release the billing fix today?").waitFor()
      await page.keyboard.press("1")
      await page.keyboard.press("n")
      await readoutIs(last, "No answer yet.")
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "detached" })
      await pending.uncheck()

      await open.click()
      await focusedHeading("Release the billing fix today?").waitFor()
      for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
        await dispatchKey(page, { key: "1", code: "Digit1", ...init })
      }
      await dispatchKey(page, { key: "!", code: "Digit1", shiftKey: true })
      for (const target of ["input", "textarea", "editable"] as const) {
        await dispatchKey(page, { key: "1", code: "Digit1" }, target)
      }
      await readoutIs(last, "No answer yet.")
      const axe = await axePasses(page, [`[data-e2e="decision-card-dialog"]`])

      // n on the Russian layout types т; it opens the note and puts the caret in it.
      await dispatchKey(page, { key: "т", code: "KeyN" })
      const note = dialog.getByRole("textbox", { name: "Note or your own answer", exact: true })
      await note.and(page.locator(":focus")).waitFor()
      // Typed in the note, 1 and e are text, not answers.
      await page.keyboard.type("ok1e")
      await readoutIs(last, "No answer yet.")

      // The recommended option is drawn first, so it is the one 1 chooses.
      await blur(page)
      await dispatchKey(page, { key: "&", code: "Digit1" })
      await last.getByText("Last answer: Release today (ok1e)", { exact: true }).waitFor()
      await focusedHeading("Which region should the new server run in?").waitFor()

      // The question's answer field is open; n moves the caret into it from the heading.
      await dispatchKey(page, { key: "т", code: "KeyN" })
      const answer = dialog.getByRole("textbox", { name: "Your answer", exact: true })
      await answer.and(page.locator(":focus")).waitFor()
      await page.keyboard.type("Falkenstein")
      await page.keyboard.press("ControlOrMeta+Enter")
      await last.getByText(`Last answer: "Falkenstein"`, { exact: true }).waitFor()
      await focusedHeading("Renew the domain before it lapses").waitFor()

      // e on the Russian layout types у.
      await dispatchKey(page, { key: "у", code: "KeyE" })
      await last.getByText("Last answer: Marked done", { exact: true }).waitFor()
      await focusedHeading("Release the billing fix today?").waitFor()

      await page.keyboard.press("3")
      await last.getByText("Last answer: Drop the fix", { exact: true }).waitFor()
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "detached" })
      return axe
    },
  },
  {
    name: "DecisionCard at 390 px (dark): a long context folds behind More and unfolds to Less, " +
      "every option and toggle is at least 44 px tall, and axe passes",
    pageId: "ui",
    colorScheme: "dark",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const { card, panel } = decisionCard(page)
      await card.scrollIntoViewIfNeeded()
      const context = panel.locator("p[data-folded]")
      const more = panel.getByRole("button", { name: "More", exact: true })
      await more.and(page.locator(`[aria-expanded="false"]`)).waitFor()
      const folded = await context.evaluate((element) => element.clientHeight)
      const targets = panel.locator(`[role="group"] button, button[aria-expanded]`)
      const heights = await targets.evaluateAll((all) =>
        all.map((element) => element.getBoundingClientRect().height)
      )
      if (heights.length < 5 || heights.some((height) => height < 44)) {
        throw new Error(`the options and toggles are ${heights.join(", ")} px tall`)
      }
      await more.click()
      const less = panel.getByRole("button", { name: "Less", exact: true })
      await less.and(page.locator(`[aria-expanded="true"]`)).waitFor()
      const open = await panel.locator("p[id$='-context']").evaluate((element) =>
        element.clientHeight
      )
      if (open <= folded) throw new Error(`unfolded, the context is ${open} px, folded ${folded}`)
      const axe = await axePasses(page, ["#demo-DecisionCard"])
      await less.click()
      await more.waitFor()
      return axe
    },
  },
]
