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
    name: "ImportMapper: a problem's Line button moves focus to that row's line cell in the preview",
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
      const box = await cell.boundingBox()
      if (box === null || box.y < 0 || box.y + box.height > 800) {
        throw new Error(`the focused cell is out of view: ${JSON.stringify(box)}`)
      }
      return `focus on line ${line}: "${text}"`
    },
  },
  {
    name: "ImportMapper: a setting change marks the preview busy, draws skeleton bars after " +
      "300 ms, keeps the selects enabled, then announces the updated preview",
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
      await page.locator(`${CARD} [aria-busy="false"]`).waitFor()
      const bars = await page.locator(`${CARD} tbody .animate-pulse`).count()
      if (bars) throw new Error(`${bars} skeleton bars stay after the re-read`)
      return "busy, skeleton, then Preview updated."
    },
  },
  ...(["light", "dark"] as const).flatMap((colorScheme) =>
    [390, 1440].map((width): Spec => ({
      name: `ImportMapper at ${width} px in ${colorScheme}: axe finds no violation` +
        (width === 390 ? ", and the 20-column file does not scroll the page sideways" : ""),
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
        if (sideways > 0) throw new Error(`the page scrolls ${sideways}px sideways`)
        return await axeCleanIn(page, CARD)
      },
    }))
  ),
]
