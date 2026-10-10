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

      // The demo names the button through `searchLabel`.
      await card.getByPlaceholder("Search").fill("Supp")
      await card.getByRole("button", { name: "Search teams", exact: true }).click()
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
      const alert = form.getByRole("alert")

      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="true"]`)).waitFor()
      await form.getByLabel("Name", { exact: true }).fill("Night shift")
      await page.keyboard.press("Tab")
      await save.click()
      await alert.filter({ hasText: "The team was not saved: the server refused the row" })
        .waitFor()

      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="false"]`)).waitFor()
      await save.click()
      await alert.waitFor({ state: "detached" })
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
      "AssociationEditor: Delete asks in a dialog worded by the app; the keyboard cancels it, then confirms the removal",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const remove = card.getByRole("button", { name: "Delete", exact: true })
      const dialog = page.getByRole("alertdialog", { name: "Detach this supplier?" })
      const focused = page.locator(":focus")

      await card.locator(`[data-e2e="edit-association"]`).click()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      // Cancel: the dialog opens with its question, and leaving it removes nothing.
      await remove.focus()
      await page.keyboard.press("Enter")
      await dialog.filter({ hasText: "It can be attached again later." }).waitFor()
      await page.keyboard.press("Tab")
      await dialog.locator(`[data-e2e="confirm-dialog-cancel"]`).and(focused)
        .and(page.getByRole("button", { name: "Keep it as it is", exact: true })).waitFor()
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
  {
    name:
      "AssociationEditor: Restore on a removed association asks in a dialog worded by the app; cancelling keeps it removed, confirming brings it back",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const edit = card.locator(`[data-e2e="edit-association"]`)
      const restore = card.getByRole("button", { name: "Restore", exact: true })
      const dialog = page.getByRole("alertdialog", { name: "Attach this supplier again?" })

      // Remove the row being edited, then open its form again: the footer now offers Restore.
      await edit.click()
      await card.getByRole("button", { name: "Delete", exact: true }).click()
      await page.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await rows.filter({ hasText: "2 of them removed" }).waitFor()
      await edit.click()
      await edit.and(page.locator(`[aria-pressed="false"]`)).waitFor()
      await edit.click()

      await restore.click()
      await dialog.filter({ hasText: "It comes back as it was." }).waitFor()
      await dialog.locator(`[data-e2e="confirm-dialog-cancel"]`).filter({
        hasText: "Keep it as it is",
      })
        .click()
      await dialog.waitFor({ state: "detached" })
      await rows.filter({ hasText: "2 of them removed" }).waitFor()

      await restore.click()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()
      await dialog.waitFor({ state: "detached" })
    },
  },
  {
    name:
      "AssociationEditor: Restore on a removed duplicate asks in a dialog with the default wording; cancelling keeps it removed, confirming brings it back",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const restore = card.getByRole("button", { name: "Restore", exact: true })
      const dialog = page.getByRole("alertdialog", { name: "Restore supplier association?" })

      await card.getByLabel("Supplier name").fill("Ink supplier")
      await page.keyboard.press("Tab")
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      await restore.click()
      await dialog
        .filter({ hasText: "Are you sure you want to restore this supplier association?" })
        .waitFor()
      await dialog.locator(`[data-e2e="confirm-dialog-cancel"]`).filter({ hasText: "Cancel" })
        .click()
      await dialog.waitFor({ state: "detached" })
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      await restore.click()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await rows.filter({ hasText: "0 of them removed" }).waitFor()
      await dialog.waitFor({ state: "detached" })
    },
  },
  {
    name:
      "AssociationEditor: while the store has not answered, the dialog's confirm button is busy, a second press and Escape do nothing, and the store is asked once",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const calls = card.locator(`[data-e2e="association-calls"]`)
      const hold = card.locator(`[data-e2e="hold-answers"]`)
      const dialog = page.getByRole("alertdialog", { name: "Detach this supplier?" })
      const confirm = dialog.locator(`[data-e2e="confirm-dialog-confirm"]`)

      await card.locator(`[data-e2e="edit-association"]`).click()
      await hold.click()
      await hold.and(page.locator(`[aria-pressed="true"]`)).waitFor()

      await card.getByRole("button", { name: "Delete", exact: true }).click()
      await confirm.click()
      await confirm.and(page.locator(`[aria-busy="true"]`)).waitFor()
      await calls.filter({ hasText: "asked to delete 1 times" }).waitFor()

      // A second press, by key and by a click the page cannot refuse, and an attempt to leave.
      await page.keyboard.press("Enter")
      await confirm.dispatchEvent("click")
      await page.keyboard.press("Escape")
      await dialog.locator(`[data-e2e="confirm-dialog-cancel"]`).and(page.locator(":disabled"))
        .waitFor()
      await confirm.and(page.locator(`[aria-busy="true"]`)).waitFor()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      // The store answers. The open dialog keeps the rest of the page out of reach of a real
      // click, so the hold is released by a dispatched one.
      await hold.dispatchEvent("click")
      await dialog.waitFor({ state: "detached" })
      await rows.filter({ hasText: "2 of them removed" }).waitFor()
      await calls.filter({ hasText: "asked to delete 1 times and to restore 0 times" }).waitFor()
    },
  },
  {
    name:
      "AssociationEditor demo: a held store answer arrives by itself, so the waiting dialog lets the visitor go",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const hold = card.locator(`[data-e2e="hold-answers"]`)
      const dialog = page.getByRole("alertdialog", { name: "Detach this supplier?" })
      const confirm = dialog.locator(`[data-e2e="confirm-dialog-confirm"]`)

      await card.locator(`[data-e2e="edit-association"]`).click()
      await hold.click()
      await card.getByRole("button", { name: "Delete", exact: true }).click()
      await confirm.click()
      await confirm.and(page.locator(`[aria-busy="true"]`)).waitFor()

      // Nothing releases the hold: the dialog covers the switch, as it does for a visitor.
      await dialog.waitFor({ state: "detached", timeout: 20_000 })
      await card.locator(`[data-e2e="association-rows"]`).filter({ hasText: "2 of them removed" })
        .waitFor()
    },
  },
]
