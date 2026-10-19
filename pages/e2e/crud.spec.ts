/** Playwright specs for `crud/` components, on the guide's CRUD page. */
import type { Locator, Page } from "playwright-core"
import type { Spec } from "./runner.ts"

/** Wait until an input shows `value`: Preact sets the property, so no attribute selector sees it. */
async function waitForValue(page: Page, input: Locator, value: string): Promise<void> {
  const element = await input.elementHandle()
  await page.waitForFunction(
    ({ element, value }) => (element as HTMLInputElement | null)?.value === value,
    { element, value },
    { timeout: 10_000 },
  )
}

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
      "CrudList: a term typed right after a search, before the page paints again, stays in the field and is what the next search looks for",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudList")
      const field = card.getByRole("textbox", { name: "Team name", exact: true })

      await card.locator("table.min-w-full").waitFor()
      await field.fill("zzz")
      // The search and the next keystroke land in one task, so no paint falls between them: the
      // search's render runs in a microtask, and the keystroke comes after it, as it does on a
      // busy machine where the next frame is late.
      const searched = await card.evaluate(async (root) => {
        const input = root.querySelector<HTMLInputElement>(`input[aria-label="Team name"]`)
        const button = root.querySelector<HTMLButtonElement>(`button[title="Search teams"]`)
        if (input === null || button === null) throw new Error(`the search box is not there`)
        button.click()
        for (let i = 0; i < 10; i++) await Promise.resolve()
        const rendered = root.querySelector("table.min-w-full") === null
        input.value = "Des"
        input.dispatchEvent(new Event("input", { bubbles: true }))
        return rendered
      })
      if (!searched) throw new Error(`the search for "zzz" had not rendered before the keystroke`)

      await card.getByRole("button", { name: "Search teams", exact: true }).click()
      await card.locator("tbody tr").filter({ hasText: "Design" }).waitFor()
      const now = await field.inputValue()
      if (now !== "Des") throw new Error(`the field shows "${now}", not the typed "Des"`)
    },
  },
  {
    name:
      "CrudList: a typing pause that ends after the search was cleared from outside does not bring the old term back",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudList")
      const rows = card.locator("tbody tr")
      const field = card.getByRole("textbox", { name: "Team name", exact: true })

      await rows.filter({ hasText: "Design" }).waitFor()
      // The typing pause's timer is held back and fired by hand, right after the page clears the
      // search and before the page paints again: the moment a slow machine can reach by itself.
      await card.evaluate(async (root) => {
        const input = root.querySelector<HTMLInputElement>(`input[aria-label="Team name"]`)
        const button = root.querySelector<HTMLButtonElement>(`button[title="Search teams"]`)
        const clear = root.querySelector<HTMLButtonElement>(`[data-e2e="clear-search"]`)
        if (input === null || button === null || clear === null) {
          throw new Error(`the search box or the clear button is not there`)
        }
        const realSet = globalThis.setTimeout
        const realClear = globalThis.clearTimeout
        const held = new Map<number, () => void>()
        let next = -1
        globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) => {
          if (delay !== 300 || typeof handler !== "function") {
            return realSet(handler, delay, ...rest)
          }
          const id = next--
          held.set(id, () => handler(...rest))
          return id
        }) as typeof globalThis.setTimeout
        globalThis.clearTimeout = ((id?: number) => {
          if (id !== undefined && held.delete(id)) return
          realClear(id)
        }) as typeof globalThis.clearTimeout
        try {
          input.value = "Supp"
          input.dispatchEvent(new Event("input", { bubbles: true }))
          const until = performance.now() + 5_000
          while (held.size === 0) {
            if (performance.now() > until) throw new Error(`the typing pause never started`)
            await new Promise((done) => realSet(done, 10))
          }
          button.click()
          for (let i = 0; i < 10; i++) await Promise.resolve()
          clear.click()
          for (let i = 0; i < 10; i++) await Promise.resolve()
          for (const fire of [...held.values()]) fire()
          held.clear()
        } finally {
          globalThis.setTimeout = realSet
          globalThis.clearTimeout = realClear
        }
      })

      await rows.filter({ hasText: "Design" }).waitFor()
      await field.and(page.locator(":placeholder-shown")).waitFor()
      await rows.filter({ hasText: "Platform" }).waitFor()
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
      "AssociationEditor: a Restore the store refuses is shown in its dialog in the app's words",
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
  {
    name:
      "CrudList: an address that names a search and a page shows that page when opened, reloaded and reached with Back, and is left as it is; one search from the list adds one history entry",
    pageId: "crud",
    run: async (page) => {
      const live = page.locator(`[data-e2e="crud-list-url-live"]`)
      const rows = live.locator("tbody tr")
      const pager = live.getByRole("navigation", { name: "Pages of addressed teams" })
      const hydrated = page.locator(`html[data-hydrated="true"]`)
      const search = () => page.evaluate(() => location.search)

      // "a" leaves five teams, two a page: page 2 is Sales and Marketing.
      const showsPageTwo = async (step: string) => {
        await hydrated.waitFor()
        await rows.filter({ hasText: "Sales" }).waitFor()
        await rows.filter({ hasText: "Marketing" }).waitFor()
        await pager.locator(`[aria-current="page"]`).filter({ hasText: "2" }).waitFor()
        const now = await search()
        if (now !== "?q=a&page=2") throw new Error(`${step}: the address became "${now}"`)
      }

      // Every step below is counted against the history as it was before the address was opened,
      // so a write the list makes by itself at any point shows up as an entry too many.
      const before = await page.evaluate(() => history.length)
      const entries = async (expected: number, step: string) => {
        const now = await page.evaluate(() => history.length)
        if (now !== before + expected) {
          throw new Error(`${step}: ${now - before} history entries, expected ${expected}`)
        }
      }
      const field = live.getByRole("textbox", { name: "Team name in the address" })

      const address = new URL(page.url())
      address.search = "?q=a&page=2"
      await page.goto(address.href)
      await showsPageTwo("opened")
      await page.reload()
      await showsPageTwo("reloaded")

      // Enter with the term as it is searches again: nothing changed, so the page stays. The
      // pager's own press is then the second entry, not the third.
      await field.press("Enter")
      await pager.getByRole("button", { name: "Page 3", exact: true }).click()
      await rows.filter({ hasText: "Legal" }).waitFor()
      await page.waitForFunction(() => location.search === "?q=a&page=3")
      await entries(2, "after Enter and a press on Page 3")

      // The list's own search goes back to page 1, as one step of the history.
      await field.fill("e")
      await live.getByRole("button", { name: "Search the addressed teams", exact: true }).click()
      await rows.filter({ hasText: "Design" }).waitFor()
      await pager.locator(`[aria-current="page"]`).filter({ hasText: "1" }).waitFor()
      await page.waitForFunction(() => location.search === "?q=e")
      await entries(3, "after one search")

      await page.goBack()
      await page.waitForFunction(() => location.search === "?q=a&page=3")
      await rows.filter({ hasText: "Legal" }).waitFor()
      await page.goBack()
      await showsPageTwo("after Back")
      // Forward is still there: nothing was written on the way back.
      await page.goForward()
      await page.goForward()
      await page.waitForFunction(() => location.search === "?q=e")
      await rows.filter({ hasText: "Design" }).waitFor()
      await entries(3, "after Back and Forward")
    },
  },
  {
    name: "CrudList: a row keeps its own table row when a search moves it up the table",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-CrudList")
      const rows = card.locator("tbody tr")

      // Support is the second row. Marked in the page, not through Preact, so only the same
      // element can still carry the mark once the search has taken the first row away.
      await rows.filter({ hasText: "Design" }).waitFor()
      await rows.filter({ hasText: "Support" })
        .evaluate((row) => row.setAttribute("data-kept", "yes"))
      await card.getByRole("textbox", { name: "Team name", exact: true }).fill("Supp")
      await card.getByRole("button", { name: "Search teams", exact: true }).click()
      await rows.filter({ hasText: "Design" }).waitFor({ state: "detached" })
      await card.locator(`tbody tr[data-kept="yes"]`).filter({ hasText: "Support" }).waitFor()
    },
  },
  {
    name: "AssociationEditor: a second refusal in a row is a new alert that takes focus again",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const calls = card.locator(`[data-e2e="association-calls"]`)
      const refuse = card.locator(`[data-e2e="refuse-endings"]`)
      const dialog = page.getByRole("alertdialog", { name: "Detach this supplier?" })
      const confirm = dialog.locator(`[data-e2e="confirm-dialog-confirm"]`)
      const refusal = dialog.getByRole("alert")
        .filter({ hasText: "Could not delete: the server refused the change" })
        .and(page.locator(":focus"))

      await card.locator(`[data-e2e="edit-association"]`).click()
      await refuse.click()
      await refuse.and(page.locator(`[aria-pressed="true"]`)).waitFor()
      await card.getByRole("button", { name: "Delete", exact: true }).click()
      await confirm.click()
      await refusal.waitFor()
      await calls.filter({ hasText: "asked to delete 1 times" }).waitFor()

      // The click moves focus to the button; the same words again have to take it back.
      await confirm.click()
      await calls.filter({ hasText: "asked to delete 2 times" }).waitFor()
      await refusal.waitFor()
    },
  },
  {
    name:
      "AssociationEditor: a store that throws on Delete leaves the dialog open with what went wrong, and the row as it was",
    pageId: "crud",
    run: async (page) => {
      const card = page.locator("#demo-AssociationEditor")
      const rows = card.locator(`[data-e2e="association-rows"]`)
      const calls = card.locator(`[data-e2e="association-calls"]`)
      const throwing = card.locator(`[data-e2e="throw-endings"]`)
      const dialog = page.getByRole("alertdialog", { name: "Detach this supplier?" })

      await card.locator(`[data-e2e="edit-association"]`).click()
      await throwing.click()
      await throwing.and(page.locator(`[aria-pressed="true"]`)).waitFor()
      await card.getByRole("button", { name: "Delete", exact: true }).click()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await calls.filter({ hasText: "asked to delete 1 times" }).waitFor()
      await dialog.getByRole("alert")
        .filter({ hasText: "Could not delete: the connection dropped" })
        .and(page.locator(":focus")).waitFor()
      await rows.filter({ hasText: "1 of them removed" }).waitFor()
    },
  },
  {
    name:
      "CrudEditor: the sentence above what blocks an archive is the app's own when it gives one",
    pageId: "crud",
    run: async (page) => {
      const demo = page.locator(`#demo-CrudEditor [data-e2e="archive-demo"]`)
      const block = demo.getByRole("alert")

      await demo.getByRole("checkbox").check()
      await block.filter({ hasText: "To archive this Team, please first archive:" }).waitFor()

      await demo.locator(`[data-e2e="word-block"]`).click()
      await block.filter({ hasText: "Move these out of the team first:" }).waitFor()
      await block.filter({ hasText: "please first archive" }).waitFor({ state: "detached" })
    },
  },
  {
    name: "CrudEditor: an edit of a row the store does not hold says so in the words the app gives",
    pageId: "crud",
    run: async (page) => {
      const demo = page.locator(`#demo-CrudEditor [data-e2e="archive-demo"]`)

      await demo.getByRole("button", { name: "Save the team" }).waitFor()
      await demo.locator(`[data-e2e="missing-row"]`).click()
      await demo.getByText("That team is no longer here", { exact: true }).waitFor()
      await demo.getByText("Team not found").waitFor({ state: "detached" })
    },
  },
  {
    name:
      "CrudEditor: a new editId on the same mounted editor loads that row, and Save keeps its own values",
    pageId: "crud",
    run: async (page) => {
      const demo = page.locator(`#demo-CrudEditor [data-e2e="archive-demo"]`)
      const name = demo.getByLabel("Name", { exact: true })
      const stored = demo.locator(`[data-e2e="stored"]`)

      await waitForValue(page, name, "Design")
      await demo.locator(`[data-e2e="other-row"]`).click()
      await stored.filter({ hasText: `team #2 in the store: "Support", 0 members` }).waitFor()
      await waitForValue(page, name, "Support")
      await waitForValue(page, demo.getByLabel("Members", { exact: true }), "0")

      await demo.getByRole("button", { name: "Save the team" }).click()
      await stored.filter({ hasText: `update #2 ("Support" → "Support")` }).waitFor()
      await stored.filter({ hasText: `team #2 in the store: "Support", 0 members` }).waitFor()
    },
  },
  {
    name: "CrudEditor: Enter in a field saves the value just typed",
    pageId: "crud",
    run: async (page) => {
      const demo = page.locator(`#demo-CrudEditor [data-e2e="archive-demo"]`)
      const name = demo.getByLabel("Name", { exact: true })
      const stored = demo.locator(`[data-e2e="stored"]`)

      await waitForValue(page, name, "Design")
      await name.fill("Design v2")
      await name.press("Enter")
      await stored.filter({ hasText: `update #1 ("Design" → "Design v2")` }).waitFor()
      await stored.filter({ hasText: `team #1 in the store: "Design v2", 4 members` }).waitFor()
      await waitForValue(page, name, "Design v2")
    },
  },
  {
    name: "CrudEditor: in add mode Save is enabled while the last field still has focus",
    pageId: "crud",
    run: async (page) => {
      const form = page.locator("#demo-CrudEditor form").first()
      const name = form.getByLabel("Name", { exact: true })
      const save = form.getByRole("button", { name: "Save" })

      await save.and(page.locator(":disabled")).waitFor()
      await name.fill("Night shift")
      await name.and(page.locator(":focus")).waitFor()
      await save.and(page.locator(":enabled")).waitFor()
    },
  },
  {
    name: "CrudEditor: an edit link opened while the list loads says nothing is missing",
    pageId: "crud",
    run: async (page) => {
      const demo = page.locator(`#demo-CrudEditor [data-e2e="archive-demo"]`)
      const name = demo.getByLabel("Name", { exact: true })
      const notFound = demo.getByText("Team not found")

      await waitForValue(page, name, "Design")
      await demo.locator(`[data-e2e="hold-list"]`).click()
      await demo.locator(`[data-e2e="other-row"]`).click()
      // The form drops row 1 in the same render that would say "not found".
      await waitForValue(page, name, "")
      const shown = await notFound.count()
      if (shown !== 0) throw new Error(`"Team not found" shown while the list loads (${shown})`)

      await demo.locator(`[data-e2e="hold-list"]`).click()
      await waitForValue(page, name, "Support")
      if (await notFound.count() !== 0) throw new Error(`"Team not found" shown after the load`)
    },
  },
]
