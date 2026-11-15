/** Playwright specs for `ImportMapper`, on the guide's UI page (#1163). */
import type { Page } from "playwright-core"
import type { Spec } from "./runner.ts"
import { axeCleanIn } from "./axe-clean.ts"

const CARD = "#demo-ImportMapper"

/** The ids Tab reaches, in order: the four file settings, then each field's select. */
const TAB_ORDER = [
  "guide-import-setting-separator",
  "guide-import-setting-header",
  "guide-import-setting-dateFormat",
  "guide-import-setting-decimal",
  "guide-import-date",
  "guide-import-description",
  "guide-import-amount",
  "guide-import-debit",
  "guide-import-credit",
  "guide-import-currency",
  "guide-import-reference",
] as const

/** The demo's last `onChange` call, as the card's readout shows it. */
function lastChange(page: Page) {
  return page.locator(`${CARD} [data-e2e="import-mapper-last"]`)
}

/** The id of the element that has focus. */
function focusedId(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.id ?? "")
}

export const specs: readonly Spec[] = [
  {
    name: "ImportMapper: Tab reaches the settings, then each field's select in order; an arrow " +
      "key chooses a column and calls onChange with its index, and Not in this file calls it " +
      "with null",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const first = page.locator(`#${TAB_ORDER[0]}`)
      await first.scrollIntoViewIfNeeded()
      await first.focus()
      const reached = [await focusedId(page)]
      for (let step = 1; step < TAB_ORDER.length; step++) {
        await page.keyboard.press("Tab")
        reached.push(await focusedId(page))
      }
      if (reached.join() !== TAB_ORDER.join()) {
        throw new Error(`Tab reached ${reached.join(", ")}`)
      }

      // Money out starts on Not in this file; the next option is the file's first column.
      await page.locator("#guide-import-debit").focus()
      await page.keyboard.press("ArrowDown")
      await lastChange(page).filter({ hasText: /^debit → 0$/ }).waitFor()
      await page.keyboard.press("Home")
      await lastChange(page).filter({ hasText: /^debit → null$/ }).waitFor()
      return `Tab order: ${reached.length} selects; onChange got 0, then null`
    },
  },
  {
    name:
      "ImportMapper: a problem's Line button moves focus to that row's line cell in the preview",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 800 })
      const button = page.locator(`${CARD} button`).filter({ hasText: /^Line \d+$/ }).first()
      await button.scrollIntoViewIfNeeded()
      const line = (await button.textContent())?.replace("Line ", "") ?? ""
      await button.focus()
      await page.keyboard.press("Enter")
      const cell = page.locator(`#guide-import-line-${line}`)
      await page.locator(`#guide-import-line-${line}:focus`).waitFor()
      const text = await cell.textContent()
      if (!text?.includes("Problem")) throw new Error(`the focused cell reads "${text}"`)
      // The page may scroll smoothly, so wait for the cell to arrive rather than measure once.
      // `block: "nearest"` can leave the cell's edge a fraction of a pixel past the viewport's
      // (800.14 of 800 in CI), so the check allows 1px.
      await cell.evaluate((node) =>
        new Promise<void>((resolve, reject) => {
          const started = performance.now()
          const look = () => {
            const { top, bottom } = node.getBoundingClientRect()
            if (top >= -1 && bottom <= innerHeight + 1) resolve()
            else if (performance.now() - started > 5000) {
              reject(new Error(`the focused cell is out of view: ${top}..${bottom}`))
            } else requestAnimationFrame(look)
          }
          look()
        })
      )
      return `focus on line ${line}: "${text}"`
    },
  },
  {
    name: "ImportMapper: a setting change marks the preview busy and announces the re-read, " +
      "draws skeleton bars while it lasts, then announces the updated preview",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const status = page.locator(`${CARD} [data-e2e="import-mapper-status"]`)
      await page.locator("#guide-import-setting-decimal").selectOption(".")
      await page.locator(`${CARD} [aria-busy="true"]`).waitFor()
      await status.filter({ hasText: "Reading the file again…" }).waitFor()
      await page.locator(`${CARD} tbody .animate-pulse`).first().waitFor()
      if (await page.locator(`${CARD} select:disabled`).count()) {
        throw new Error("a select is disabled while the file is read again")
      }
      await status.filter({ hasText: "Preview updated." }).waitFor()
      await page.locator(`${CARD} [aria-busy="true"]`).waitFor({ state: "detached" })
      const bars = await page.locator(`${CARD} tbody .animate-pulse`).count()
      if (bars) throw new Error(`${bars} skeleton bars stay after the re-read`)
      return "busy, skeleton, then Preview updated."
    },
  },
  {
    name: "ImportMapper at 390 px: a problem quoting a long unbroken line wraps inside the " +
      "problem summary and inside the preview's note under its row",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 900 })
      // Comma on a semicolon file leaves one column, so every problem quotes a whole line.
      await page.locator("#guide-import-setting-separator").selectOption(",")
      await page.locator(`${CARD} [aria-busy="true"]`).waitFor({ state: "detached" })
      const summary = page.locator(`${CARD} section`).filter({ has: page.locator("ul li") })
      await summary.locator("li").first().waitFor()
      const faults = await page.locator(CARD).evaluate((card) => {
        const found: string[] = []
        const section = card.querySelector("section")!
        // A message's box fits; its text spilling past that box is what gets cut off.
        for (const span of section.querySelectorAll("li > span")) {
          if (span.scrollWidth > span.clientWidth + 1) {
            found.push(`a summary message spills ${span.scrollWidth - span.clientWidth}px`)
          }
        }
        for (const note of card.querySelectorAll("td > ul")) {
          const region = note.closest("table")!.parentElement!
          if (note.scrollWidth > note.clientWidth + 1 || note.clientWidth > region.clientWidth) {
            found.push(`a note is ${note.scrollWidth}px wide in a ${region.clientWidth}px region`)
          }
        }
        const notes = card.querySelectorAll("td > ul").length
        const messages = section.querySelectorAll("li > span").length
        if (!notes || !messages) found.push(`${messages} summary messages and ${notes} notes drawn`)
        return found
      })
      if (faults.length) throw new Error(faults.join(", "))
      return "every summary message and preview note wraps inside its box"
    },
  },
  ...(["light", "dark"] as const).flatMap((colorScheme) =>
    [390, 1440].map((width): Spec => ({
      name: `ImportMapper at ${width} px in ${colorScheme}: axe finds no violation`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await page.setViewportSize({ width, height: 900 })
        const card = page.locator(CARD)
        await card.scrollIntoViewIfNeeded()
        await page.locator("#guide-import-reference").waitFor()
        const sideways = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        // A guard only: the guide's card clips its overflow, so no mutation made the page scroll.
        if (sideways > 0) throw new Error(`the page scrolls ${sideways}px sideways`)
        return `${await axeCleanIn(page, CARD)}; the page scrolls ${sideways}px sideways`
      },
    }))
  ),
]
