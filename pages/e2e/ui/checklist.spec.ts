import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"
import { CHECKLIST_DEMO_KEY, CLEARED_MESSAGE, UNDO_MS } from "../../src/checklist-demo.tsx"

/** `enhanceChecklist` on the demo checklist: saved ticks, a second tab, Clear and Undo. */
export const specs: readonly Spec[] = [
  {
    name: "enhanceChecklist: a ticked box survives a reload, reaches a second tab through the " +
      "storage event and back, Clear ticks is announced and focuses Undo, Undo restores the same " +
      "ticks, and Undo goes away after its timeout",
    pageId: "ui",
    run: async (page) => {
      // A clean start on a retry, and a clock the check can move past Undo's timeout.
      await page.clock.install()
      await page.evaluate((key) => localStorage.removeItem(key), CHECKLIST_DEMO_KEY)
      await page.reload()
      await page.locator(`html[data-hydrated="true"]`).waitFor()
      /** The demo checklist's parts on one tab. */
      const parts = (tab: Page) => {
        const card = tab.locator(`[data-e2e="checklist"]`)
        const box = (name: string, checked: boolean) =>
          card.getByRole("checkbox", { name, exact: true, checked })
        const count = (text: string) =>
          card.locator(`[data-e2e="checklist-count"]`).filter({ hasText: new RegExp(`^${text}$`) })
        return { card, box, count }
      }
      const first = parts(page)
      await first.card.scrollIntoViewIfNeeded()
      await first.count("0 of 4 checked").waitFor()

      await first.box("Backups restore", false).click()
      await first.count("1 of 4 checked").waitFor()

      // A second tab of the same site: it starts from the stored tick, and its own tick reaches
      // this tab through the `storage` event, without a reload.
      const tab = await page.context().newPage()
      try {
        await tab.goto(page.url())
        await tab.locator(`html[data-hydrated="true"]`).waitFor()
        const second = parts(tab)
        await second.card.scrollIntoViewIfNeeded()
        await second.box("Backups restore", true).waitFor()
        await second.box("Terms published", false).click()
        await second.count("2 of 4 checked").waitFor()
      } finally {
        await tab.close()
      }
      await first.box("Terms published", true).waitFor()
      await first.count("2 of 4 checked").waitFor()

      await page.reload()
      await page.locator(`html[data-hydrated="true"]`).waitFor()
      await first.card.scrollIntoViewIfNeeded()
      await first.box("Backups restore", true).waitFor()
      await first.box("Terms published", true).waitFor()
      await first.count("2 of 4 checked").waitFor()

      await first.card.getByRole("button", { name: "Clear ticks" }).click()
      await first.box("Backups restore", false).waitFor()
      await first.box("Terms published", false).waitFor()
      await first.count("0 of 4 checked").waitFor()
      const stored = await page.evaluate((key) => localStorage.getItem(key), CHECKLIST_DEMO_KEY)
      if (stored !== "") throw new Error(`Clear left ${JSON.stringify(stored)} in storage`)
      const live = first.card.locator(`[data-e2e="checklist-live"][role="status"]`)
      await live.filter({ hasText: new RegExp(`^${CLEARED_MESSAGE}$`) }).waitFor()
      const undo = first.card.getByRole("button", { name: "Undo" })
      await undo.and(page.locator(":focus")).waitFor()

      await undo.click()
      await first.box("Backups restore", true).waitFor()
      await first.box("Terms published", true).waitFor()
      await first.count("2 of 4 checked").waitFor()
      await live.filter({ hasText: /^Ticks restored$/ }).waitFor()
      await axeCleanIn(page, `[data-e2e="checklist"]`)

      // Clear again and let Undo time out: it goes, and focus stays in the list.
      await first.card.getByRole("button", { name: "Clear ticks" }).press("Enter")
      await undo.and(page.locator(":focus")).waitFor()
      await page.clock.runFor(UNDO_MS + 500)
      await undo.waitFor({ state: "detached" })
      await first.box("Backups restore", false).and(page.locator(":focus")).waitFor()
      return "reload, second tab both ways, Clear announced, Undo, Undo timed out"
    },
  },
]
