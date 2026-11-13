import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

/**
 * Specs proving `MoneyInput autoFocus` takes focus when the `Modal` around it opens: the native
 * `<dialog>` focuses the element carrying `autofocus` in `showModal()`, so the attribute has to
 * reach the visible input after hydration, or focus lands on the dialog's close button and Enter
 * closes the dialog instead of saving.
 */
export const specs: readonly Spec[] = [
  {
    name: "MoneyInput autoFocus: the amount has focus when the Modal around it opens",
    pageId: "ui",
    run: async (page) => {
      await page.locator(`#demo-MoneyInput [data-e2e="money-dialog-open"]`).click()
      // `showModal()` moves focus before it returns, so once the dialog is modal, focus is set.
      await page.locator(`dialog[data-e2e="guide-money-dialog"]:modal`).waitFor()
      const focused = await page.evaluate(() => {
        const active = document.activeElement
        if (active === null) return "nothing"
        return active.id || active.getAttribute("aria-label") || active.tagName
      })
      if (focused !== "guide-money-dialog-amount") throw new Error(`focus is on ${focused}`)
      return await axeCleanIn(page, `dialog[data-e2e="guide-money-dialog"]`)
    },
  },
]
