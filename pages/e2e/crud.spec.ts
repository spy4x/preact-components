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
  {
    name:
      "CrudList: a search that matches nothing shows an empty state in place of the blank table, and the table comes back with the rows",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudList")
      const empty = card.getByRole("status").filter({ hasText: "No team has that name" })

      await card.locator("table.min-w-full").waitFor()
      await card.getByPlaceholder("Search").fill("zzz")
      await card.getByRole("button", { name: "Search teams", exact: true }).click()
      await empty.filter({ hasText: "Search for part of a team's name." }).waitFor()
      await empty.getByRole("heading", { name: "No team has that name", level: 4 }).waitFor()
      await card.locator("table.min-w-full").waitFor({
        state: "detached",
      })

      await card.getByPlaceholder("Search").fill("Des")
      await card.getByRole("button", { name: "Search teams", exact: true }).click()
      await card.locator("tbody tr").filter({ hasText: "Design" }).waitFor()
      await empty.waitFor({ state: "detached" })
    },
  },
  {
    name:
      "CrudList: the search field has a name of its own, and shows a search that was changed from outside the list",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudList")
      const rows = card.locator("tbody tr")
      const field = card.getByRole("textbox", { name: "Team name", exact: true })

      await field.fill("Supp")
      await card.getByRole("button", { name: "Search teams", exact: true }).click()
      await rows.filter({ hasText: "Design" }).waitFor({ state: "detached" })

      // The page clears the search, as Back does when the address owns it: the rows come back,
      // and the field no longer shows the old term (an empty field shows its placeholder).
      await card.locator(`[data-e2e="clear-search"]`).click()
      await rows.filter({ hasText: "Design" }).waitFor()
      await field.and(page.locator(":placeholder-shown")).waitFor()
    },
  },
  {
    name:
      "CrudList: with a page size the rows are paged by Pagination, and a new status starts again at page 1",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudList")
      const rows = card.locator("tbody tr")
      const pager = card.getByRole("navigation", { name: "Pages of teams" })
      const status = card.getByLabel("Status")

      // Without a page size every row is there and there is no pager.
      await rows.filter({ hasText: "Platform" }).waitFor()
      await pager.waitFor({ state: "detached" })

      await card.locator(`[data-e2e="page-rows"]`).click()
      await pager.waitFor()
      await rows.filter({ hasText: "Design" }).waitFor()
      await rows.filter({ hasText: "Support" }).waitFor()
      await rows.filter({ hasText: "Platform" }).waitFor({ state: "detached" })

      await pager.getByRole("button", { name: "Page 2", exact: true }).click()
      await rows.filter({ hasText: "Platform" }).waitFor()
      await rows.filter({ hasText: "Design" }).waitFor({ state: "detached" })
      await pager.locator(`[aria-current="page"]`).filter({ hasText: "2" }).waitFor()

      // One archived row fits on one page, so the pager goes; back on Active it is page 1 again.
      await status.selectOption("archived")
      await rows.filter({ hasText: "Research" }).waitFor()
      await pager.waitFor({ state: "detached" })
      await status.selectOption("active")
      await rows.filter({ hasText: "Design" }).waitFor()
      await rows.filter({ hasText: "Platform" }).waitFor({ state: "detached" })
      await pager.locator(`[aria-current="page"]`).filter({ hasText: "1" }).waitFor()
    },
  },
  {
    name:
      "CrudList, CrudEditor and AssociationEditor head themselves at the level the page asks for, with no second h1",
    pageId: "crud",
    run: async (page) => {
      for (
        const [card, title] of [
          ["#demo-CrudList", "Teams"],
          ["#demo-CrudEditor", "Add a team"],
          ["#demo-CrudEditor", "Edit a team"],
          ["#demo-AssociationEditor", "Add a supplier"],
        ]
      ) {
        await page.locator(card).getByRole("heading", { name: title, level: 4 }).waitFor()
      }
      const stray = await page.locator(
        "#demo-CrudList h1, #demo-CrudEditor h1, #demo-AssociationEditor h1",
      ).count()
      if (stray !== 0) throw new Error(`${stray} crud demo titles are still an <h1>`)
    },
  },
  {
    name:
      "AssociationEditor: a Delete the store refuses stays in its dialog as an alert that takes focus; the next try goes through and the footer then offers Restore",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const refuse = card.locator(`[data-e2e="refuse-endings"]`)
      const remove = card.getByRole("button", { name: "Delete", exact: true })
      const restore = card.getByRole("button", { name: "Restore", exact: true })
      const dialog = page.getByRole("alertdialog", { name: "Detach this supplier?" })
      const confirm = dialog.locator(`[data-e2e="confirm-dialog-confirm"]`)
      const focused = page.locator(":focus")

      await card.locator(`[data-e2e="edit-association"]`).click()
      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="true"]`)).waitFor()

      await remove.click()
      await confirm.click()
      await dialog.getByRole("alert")
        .filter({ hasText: "Could not delete: the server refused the change" })
        .and(focused).waitFor()
      await dialog.filter({ hasText: "It can be attached again later." }).waitFor()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      // The open dialog keeps the switch out of reach of a real click.
      await refuse.dispatchEvent("click")
      await refuse.and(page.locator(`[aria-pressed="false"]`)).waitFor()
      await confirm.click()
      await dialog.waitFor({ state: "detached" })
      await rows.filter({ hasText: "2 of them removed" }).waitFor()

      // The form shows the removal without being opened again, and focus is on the new action.
      await restore.and(focused).waitFor()
      await remove.waitFor({ state: "detached" })
      await card.getByText(/^Detached .+ ago$/).waitFor()
    },
  },
  {
    name:
      "AssociationEditor: a Restore the store refuses is shown in its dialog in the app's words, and leaving the dialog keeps the row removed",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const refuse = card.locator(`[data-e2e="refuse-endings"]`)
      const restore = card.getByRole("button", { name: "Restore", exact: true })
      const dialog = page.getByRole("alertdialog", { name: "Attach this supplier again?" })
      const focused = page.locator(":focus")

      await card.locator(`[data-e2e="edit-association"]`).click()
      await card.getByRole("button", { name: "Delete", exact: true }).click()
      await page.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await restore.waitFor()
      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="true"]`)).waitFor()

      await restore.click()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await dialog.getByRole("alert")
        .filter({
          hasText: "The supplier was not attached again: the server refused the change",
        })
        .and(focused).waitFor()

      await dialog.locator(`[data-e2e="confirm-dialog-cancel"]`).click()
      await dialog.waitFor({ state: "detached" })
      await restore.and(focused).waitFor()
      await rows.filter({ hasText: "2 of them removed" }).waitFor()
    },
  },
  {
    name:
      "AssociationEditor: a refused Restore of a removed duplicate says so in the default words; once it goes through, focus moves to the field the duplicate is reported on",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const refuse = card.locator(`[data-e2e="refuse-endings"]`)
      const field = card.getByLabel("Supplier name")
      const restore = card.getByRole("button", { name: "Restore", exact: true })
      const dialog = page.getByRole("alertdialog", { name: "Restore supplier association?" })
      const confirm = dialog.locator(`[data-e2e="confirm-dialog-confirm"]`)
      const focused = page.locator(":focus")

      await field.fill("Ink supplier")
      await page.keyboard.press("Tab")
      await card.getByText(
        "Restoring it keeps the record that was there before instead of creating a second one.",
      ).waitFor()
      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="true"]`)).waitFor()

      await restore.click()
      await confirm.click()
      await dialog.getByRole("alert")
        .filter({ hasText: "Could not restore: the server refused the change" })
        .and(focused).waitFor()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()

      await refuse.dispatchEvent("click")
      await refuse.and(page.locator(`[aria-pressed="false"]`)).waitFor()
      await confirm.click()
      await dialog.waitFor({ state: "detached" })
      await rows.filter({ hasText: "0 of them removed" }).waitFor()

      // The offer, and the button that had focus, are gone; the person is on the field to change.
      await restore.waitFor({ state: "detached" })
      await field.and(focused).waitFor()
    },
  },
]
