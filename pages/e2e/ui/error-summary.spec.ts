import { AxeBuilder } from "@axe-core/playwright"
import type { Spec } from "../runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "ErrorSummary with selectTextareaLine: a row's button selects its line in the textarea " +
      "and scrolls it into view, the panel passes axe, and the status line says the count, then " +
      '"No problems left" once the last problem is fixed',
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-ErrorSummary")
      const draft = card.locator(`[data-e2e="error-summary-draft"]`)
      const panel = card.locator(`[data-e2e="error-summary"]`)
      const status = card.locator(`[data-e2e="error-summary-status"]`)
      await card.getByRole("region", { name: "2 problems in this post" }).waitFor()
      await status.filter({ hasText: /^2 problems$/ }).waitFor()
      const { violations } = await new AxeBuilder({ page })
        .include(`[data-e2e="error-summary"]`).analyze()
      if (violations.length > 0) {
        throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("; "))
      }
      /** The textarea's selected text and how far it is scrolled. */
      const selection = () =>
        draft.evaluate((el: HTMLTextAreaElement) => ({
          text: el.value.slice(el.selectionStart, el.selectionEnd),
          scrollTop: el.scrollTop,
          hiddenBelow: el.scrollHeight - el.clientHeight - el.scrollTop,
        }))
      await panel.getByRole("button", { name: "Line 5", exact: true }).click()
      await draft.and(page.locator(":focus")).waitFor()
      const first = await selection()
      if (first.text !== "<CostCalc users={500} />") {
        throw new Error(`Line 5 selected ${JSON.stringify(first.text)}`)
      }
      // The draft fits its 12 rows, so axe can read every line. A long paragraph that wraps over
      // many rows, then the problem, then 30 more lines make it scroll, with the problem in the
      // middle: a scroll that counts lines and not rows, or one that goes to the end, misses it.
      await draft.fill(
        `${await draft.inputValue()}${"word ".repeat(400)}\n<Bad />\n${"filler\n".repeat(30)}`,
      )
      await panel.getByRole("button", { name: "Line 13", exact: true }).click()
      await draft.and(page.locator(":focus")).waitFor()
      const middle = await selection()
      if (middle.text !== "<Bad />") {
        throw new Error(`Line 13 selected ${JSON.stringify(middle.text)}`)
      }
      // Where the selected row sits in the textarea's content, measured on a copy with its font
      // and width, and whether the textarea's visible part holds all of it.
      const row = await draft.evaluate((el: HTMLTextAreaElement) => {
        const style = getComputedStyle(el)
        const copy = document.createElement("div")
        copy.style.cssText =
          `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;` +
          `box-sizing:${style.boxSizing};width:${style.width};padding:${style.padding};` +
          `border:${style.border};font:${style.font};line-height:${style.lineHeight}`
        copy.textContent = el.value.slice(0, el.selectionStart)
        document.body.append(copy)
        const top = copy.scrollHeight
        copy.remove()
        const bottom = top + parseFloat(style.lineHeight)
        return { top, bottom, scrollTop: el.scrollTop, clientHeight: el.clientHeight }
      })
      if (row.top < row.scrollTop || row.bottom > row.scrollTop + row.clientHeight) {
        throw new Error(`line 13 is not in view: ${JSON.stringify(row)}`)
      }
      if (middle.hiddenBelow <= 0) {
        throw new Error("the textarea scrolled to its end, not to line 13")
      }
      await draft.fill("# Pricing, explained\n\n<Chart year={2026} />\n")
      await panel.waitFor({ state: "detached" })
      await status.filter({ hasText: /^No problems left$/ }).waitFor()
    },
  },
]
