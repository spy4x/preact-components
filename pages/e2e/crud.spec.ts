/** Playwright specs for `crud/` components, on the guide's CRUD page. */
import type { Spec } from "./runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "CrudList: the Search button searches at once, without waiting for the typing pause",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudList")
      const rows = card.locator("tbody tr")

      // A one-minute pause, so nothing but the button can have filtered the rows.
      await card.locator(`[data-e2e="patient-search"]`).click()
      await card.locator(`[data-e2e="patient-search"][aria-pressed="true"]`).waitFor()
      await rows.filter({ hasText: "Design" }).waitFor()

      await card.getByPlaceholder("Search").fill("Supp")
      await card.getByRole("button", { name: "Search", exact: true }).click()
      await rows.filter({ hasText: "Design" }).waitFor({ state: "detached" })
      await rows.filter({ hasText: "Support" }).waitFor()
    },
  },
  {
    name: "CrudEditor: a save the store refuses is shown in an alert, and the next save clears it",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudEditor")
      const form = card.locator("form").first()
      const refuse = card.locator(`[data-e2e="refuse-saves"]`)
      const save = form.getByRole("button", { name: "Save" })

      // The region is on the page, empty, before there is anything to announce.
      await form.locator(`[role="alert"]:empty`).waitFor({ state: "attached" })

      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="true"]`)).waitFor()
      await form.getByLabel("Name", { exact: true }).fill("Night shift")
      await page.keyboard.press("Tab")
      await save.click()
      await form.getByRole("alert")
        .filter({ hasText: "Could not save: the server refused the row" }).waitFor()

      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="false"]`)).waitFor()
      await save.click()
      await form.locator(`[role="alert"]:empty`).waitFor({ state: "attached" })
      await card.locator(`[data-e2e="model"]`)
        .filter({ hasText: `onCreated received: #100 "Night shift"` }).waitFor()
    },
  },
  {
    name:
      "CrudEditor: a read-only viewer keeps Cancel, which leads back, and loses Save and archive",
    pageId: "crud",
    run: async (page) => {
      const demo = page.locator(`#demo-CrudEditor [data-e2e="archive-demo"]`)
      const save = demo.getByRole("button", { name: "Save" })
      const archive = demo.getByRole("checkbox")
      const cancel = demo.getByRole("link", { name: "Cancel" })

      await save.waitFor()
      await archive.waitFor()
      await demo.locator(`[data-e2e="read-only"]`).click()
      await save.waitFor({ state: "detached" })
      await archive.waitFor({ state: "detached" })

      await cancel.focus()
      await page.keyboard.press("Enter")
      await page.waitForURL((url) => url.hash === "#crud")
    },
  },
  {
    name:
      "AssociationEditor: Delete asks in a dialog; the keyboard cancels it, then confirms the removal",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const remove = card.getByRole("button", { name: "Delete", exact: true })
      const dialog = page.getByRole("alertdialog", { name: "Delete supplier association?" })
      const focused = page.locator(":focus")

      await card.locator(`[data-e2e="edit-association"]`).click()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      // Cancel: the dialog opens with its question, and leaving it removes nothing.
      await remove.focus()
      await page.keyboard.press("Enter")
      await dialog
        .filter({ hasText: "Are you sure you want to delete this supplier association?" })
        .waitFor()
      await page.keyboard.press("Tab")
      await dialog.locator(`[data-e2e="confirm-dialog-cancel"]`).and(focused).waitFor()
      await page.keyboard.press("Enter")
      await dialog.waitFor({ state: "detached" })
      await remove.and(focused).waitFor()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      // Escape cancels too.
      await page.keyboard.press("Enter")
      await dialog.waitFor()
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "detached" })
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      // Confirm: the row is removed, and the dialog goes.
      await remove.and(focused).waitFor()
      await page.keyboard.press("Enter")
      await dialog.waitFor()
      await page.keyboard.press("Tab")
      await page.keyboard.press("Tab")
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).and(focused).waitFor()
      await page.keyboard.press("Enter")
      await rows.filter({ hasText: "2 of them removed" }).waitFor()
      await dialog.waitFor({ state: "detached" })
    },
  },
]
