import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { holdTimer, unsavedGuardWithAChange } from "./shared.ts"

/** The parts of the host page's `UnsavedGuard` Back and Forward demo a spec drives. */
function unsavedHistoryDemo(page: Page) {
  const demo = page.locator(`[data-e2e="unsaved-history"]`)
  const draft = demo.locator(`[data-e2e="unsaved-history-draft"]`)
  const dialog = page.getByRole("alertdialog", { name: "Leave without saving?" })
  /** Waits for the router to show one view at that view's address. */
  const viewIs = async (view: "list" | "edit" | "preview") => {
    await demo.locator(`[data-e2e="unsaved-history-view"][data-view="${view}"]`).waitFor()
    await page.waitForURL((url) => (url.searchParams.get("unsaved-note") ?? "list") === view)
  }
  /** Follows the demo's link to a view, which adds a history entry. */
  const open = async (view: "edit" | "preview") => {
    await demo.locator(`[data-e2e="unsaved-history-to-${view}"]`).click()
    await viewIs(view)
  }
  /** Types a change into the editor and waits for the guard to know of it. */
  const type = async () => {
    await draft.fill("An unsaved change")
    await demo.getByText("Unsaved: yes", { exact: true }).waitFor()
  }
  return {
    draft,
    dialog,
    stay: dialog.locator(`[data-e2e="confirm-dialog-cancel"]`),
    leave: dialog.locator(`[data-e2e="confirm-dialog-confirm"]`),
    viewIs,
    open,
    /** Opens the editor with the preview one step ahead of it, then types a change. */
    dirtyEditorWithAPageAhead: async () => {
      await open("edit")
      await open("preview")
      // Nothing is typed yet, so this Back is not held; it leaves the preview ahead.
      await page.goBack()
      await viewIs("edit")
      await type()
    },
    type,
    /**
     * Waits for the editor to be the view at its own address and history state, with the typed text
     * still in the same field: a router that had followed the step would have drawn a new, empty
     * one.
     */
    editorIsKept: async () => {
      await dialog.waitFor({ state: "detached" })
      await viewIs("edit")
      await demo.getByText("Unsaved: yes", { exact: true }).waitFor()
      const text = await draft.inputValue()
      if (text !== "An unsaved change") throw new Error(`the field holds "${text}" after Stay`)
      const state = await page.evaluate(() => JSON.stringify(history.state))
      if (state !== `{"view":"edit"}`) throw new Error(`the entry's state is ${state} after Stay`)
    },
    /** Fails when the page shows any number of dialogs but this one. */
    dialogsAre: async (count: number) => {
      const open = await page.locator("dialog[open]").count()
      if (open !== count) throw new Error(`${open} dialogs are open, not ${count}`)
    },
  }
}

/**
 * `UnsavedGuard` against the browser's Back and Forward buttons, on the host page's demo, whose
 * views a wouter router draws from the address.
 */
function unsavedHistorySpecs(): Spec[] {
  return [
    {
      name:
        "UnsavedGuard: Back with a change asks; Stay keeps the editor, its address and the typed text, and Leave arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, stay, leave, open, type, viewIs, editorIsKept } = unsavedHistoryDemo(page)
        await open("edit")
        await type()

        await page.goBack()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()

        await page.goBack()
        await dialog.waitFor()
        await leave.click()
        await viewIs("list")
        await dialog.waitFor({ state: "detached" })
      },
    },
    {
      name: "UnsavedGuard: Forward with a change asks, and Leave arrives where Forward was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, leave, viewIs, dirtyEditorWithAPageAhead } = unsavedHistoryDemo(page)
        await dirtyEditorWithAPageAhead()

        await page.goForward()
        await dialog.waitFor()
        await viewIs("edit")
        await leave.click()
        await viewIs("preview")
        await dialog.waitFor({ state: "detached" })
      },
    },
    {
      name:
        "UnsavedGuard: Stay after Forward keeps the editor, its address and the typed text, as a new entry on top of the page Forward went to",
      pageId: "ui",
      run: async (page) => {
        const { dialog, stay, leave, viewIs, editorIsKept, dirtyEditorWithAPageAhead } =
          unsavedHistoryDemo(page)
        await dirtyEditorWithAPageAhead()

        await page.goForward()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()

        // The preview is one step back now, not one step ahead.
        await page.goBack()
        await dialog.waitFor()
        await leave.click()
        await viewIs("preview")
      },
    },
    {
      name: "UnsavedGuard: Back with nothing unsaved leaves at once, with no dialog",
      pageId: "ui",
      run: async (page) => {
        const { open, viewIs, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        await page.goBack()
        await viewIs("list")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: a step back over three entries at once asks, and Leave arrives at the entry the person chose",
      pageId: "ui",
      run: async (page) => {
        const { dialog, leave, open, type, viewIs } = unsavedHistoryDemo(page)
        await open("edit")
        await open("preview")
        await open("edit")
        await type()

        await page.evaluate(() => history.go(-3))
        await dialog.waitFor()
        await viewIs("edit")
        await leave.click()
        await viewIs("list")
      },
    },
    {
      name:
        "UnsavedGuard: a second Back while the question is open is held too, in the one dialog, and Leave arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, leave, open, type, viewIs, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        await open("preview")
        await open("edit")
        await type()

        await page.goBack()
        await dialog.waitFor()
        await page.goBack()
        await viewIs("edit")
        await dialogsAre(1)
        await leave.click()
        await viewIs("preview")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: with a change, the app's own replaceState and pushState open no dialog and are not undone, and Stay after Back keeps the replaced address",
      pageId: "ui",
      run: async (page) => {
        const { open, type, viewIs, dialogsAre, dialog, stay, editorIsKept } = unsavedHistoryDemo(
          page,
        )
        const filterIs = (expected: string | null) => {
          const filter = new URL(page.url()).searchParams.get("filter")
          if (filter !== expected) throw new Error(`the address has filter=${filter}`)
        }
        await open("edit")
        await type()
        // The app changes the query of the form's own page, as a filter beside the form does.
        await page.evaluate(() => {
          const url = new URL(location.href)
          url.searchParams.set("filter", "a")
          history.replaceState(history.state, "", url)
        })
        await viewIs("edit")
        await dialogsAre(0)
        filterIs("a")
        // The address the guard puts back is the replaced one, not the one it first saw.
        await page.goBack()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()
        filterIs("a")
        // The app navigates away from code without the guard, as it does after a save.
        await page.evaluate(() => {
          const url = new URL(location.href)
          url.searchParams.set("unsaved-note", "preview")
          history.pushState({ view: "preview" }, "", url)
        })
        await viewIs("preview")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: two forms with changes that share a leave guard put one entry back, and Leave arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { open, type, viewIs, dialog, leave, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        // The second form first: the "Unsaved" line `type` waits for is drawn after both guards'
        // effects.
        await page.locator(`[data-e2e="unsaved-history-tags"]`).fill("An unsaved tag")
        await type()
        await page.goBack()
        await dialog.waitFor()
        await dialogsAre(1)
        await leave.click()
        await viewIs("list")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard in a browser without the Navigation API: a link with a change still asks, and Back is not held",
      pageId: "ui",
      run: async (page) => {
        const { open, type, viewIs, dialogsAre, dialog, stay, editorIsKept } = unsavedHistoryDemo(
          page,
        )
        await page.evaluate(() =>
          Object.defineProperty(globalThis, "navigation", { value: undefined })
        )
        await open("edit")
        await type()
        // The rest of the guard works as before: a link out of the form is still held.
        await page.locator(`[data-e2e="unsaved-history-to-preview"]`).click()
        await dialog.waitFor()
        await stay.click()
        await editorIsKept()
        await page.goBack()
        await viewIs("list")
        await dialogsAre(0)
      },
    },
    {
      name:
        "UnsavedGuard: a save that finishes while the dialog asks about Back closes it and arrives where Back was going",
      pageId: "ui",
      run: async (page) => {
        const { dialog, open, type, viewIs, dialogsAre } = unsavedHistoryDemo(page)
        await open("edit")
        await type()
        // The demo's 3-second save is held until the dialog is seen, so on a slow machine it
        // cannot finish before Back is pressed or before the editor is read.
        const save = await holdTimer(page, 3_000)
        await page.locator(`[data-e2e="unsaved-history-save-late"]`).click()

        await page.goBack()
        // The question is asked first: the save has not finished, so the editor is still the view.
        await dialog.waitFor()
        await viewIs("edit")
        await save()
        await viewIs("list")
        await dialogsAre(0)
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  {
    name:
      "UnsavedGuard: a button that navigates through the leave guard opens the dialog; Stay keeps the page and returns the focus to the button, Leave navigates",
    pageId: "ui",
    run: async (page) => {
      const { card, dialog, stay, leave, lists, outcomeIs, focusIsOn } =
        await unsavedGuardWithAChange(page)

      await lists.click()
      await dialog.waitFor()
      // The dialog alone: while it is open the page behind it is inert, and axe skips that.
      const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze()
      if (violations.length > 0) {
        throw new Error(`axe on the open dialog: ${violations.map(({ id }) => id).join(", ")}`)
      }
      await stay.click()
      await dialog.waitFor({ state: "detached" })
      await focusIsOn(lists)
      await outcomeIs("nothing yet")

      await lists.click()
      await leave.click()
      await dialog.waitFor({ state: "detached" })
      await outcomeIs(`navigate("unsaved-demo/lists") from code`)
      // Leave dropped the change through `onDiscard`, so nothing is unsaved any more.
      await card.getByRole("checkbox", { name: "Unsaved changes", checked: false }).waitFor()
    },
  },
  {
    name:
      "UnsavedGuard: a key press that navigates through the leave guard opens the dialog; Stay returns the focus to the field, and a second key press replaces the first without a second dialog",
    pageId: "ui",
    run: async (page) => {
      const { draft, dialog, stay, leave, outcomeIs, callsAre, focusIsOn } =
        await unsavedGuardWithAChange(page)

      await draft.press("Alt+KeyL")
      await dialog.waitFor()
      await stay.click()
      await dialog.waitFor({ state: "detached" })
      await focusIsOn(draft)
      await outcomeIs("nothing yet")

      await draft.press("Alt+KeyL")
      await dialog.waitFor()
      await callsAre(2)
      // The focus is in the dialog now; the key reaches the card's handler from there.
      await page.keyboard.press("Alt+KeyU")
      await callsAre(3)
      const open = await page.locator("dialog[open]").count()
      if (open !== 1) throw new Error(`${open} dialogs are open after two navigations in a row`)
      await leave.click()
      await outcomeIs(`navigate("unsaved-demo/upcoming") from code`)
      await page.locator("dialog[open]").waitFor({ state: "detached" })
    },
  },
  {
    name:
      "UnsavedGuard without a leave guard: a click on an in-app link opens the dialog, and Leave navigates to the link's address although onDiscard removes the guard at once",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-UnsavedGuard")
      const state = card.locator(`[data-e2e="unsaved-alone-state"]`)
      const dialog = page.getByRole("alertdialog", { name: "Leave without saving?" })

      await card.locator(`[data-e2e="unsaved-alone-draft"]`).fill("An unsaved change")
      await state.getByText("Unsaved: yes. Outcome: nothing yet", { exact: true }).waitFor()
      await card.locator(`[data-e2e="unsaved-alone-link"]`).click()
      await dialog.waitFor()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
      await state.getByText(/^Unsaved: no\. Outcome: navigate\("\/.*unsaved-demo\/notes\/4"\)$/)
        .waitFor()
      await dialog.waitFor({ state: "detached" })
    },
  },
  {
    name:
      "UnsavedGuard: with nothing unsaved, a button and a key press navigate through the leave guard at once, with no dialog",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-UnsavedGuard")
      const outcome = card.locator(`[data-e2e="unsaved-outcome"]`)
      const upcoming = card.locator(`[data-e2e="unsaved-go-upcoming"]`)

      await upcoming.click()
      await outcome.getByText(`navigate("unsaved-demo/upcoming") from code`).waitFor()
      await upcoming.press("Alt+KeyL")
      await outcome.getByText(`navigate("unsaved-demo/lists") from code`).waitFor()
      const open = await page.locator("dialog[open]").count()
      if (open !== 0) throw new Error(`${open} dialogs are open with nothing unsaved`)
    },
  },
  {
    name:
      "UnsavedGuard: a save that finishes while the dialog is open closes it and follows the link that was clicked, and then the navigation a button started",
    pageId: "ui",
    run: async (page) => {
      const { card, draft, dialog, lists, outcomeIs } = await unsavedGuardWithAChange(page)
      const saveLate = card.locator(`[data-e2e="unsaved-save-late"]`)
      const saved = card.getByRole("checkbox", { name: "Unsaved changes", checked: false })

      // Each 3-second save is held until the dialog is seen, so on a slow machine it cannot
      // finish before the click or before the dialog is looked for.
      let save = await holdTimer(page, 3_000)
      await saveLate.click()
      await card.locator(`[data-unsaved="owned"]`).click()
      // The question is asked first: the save has not finished, so nothing has navigated.
      await dialog.waitFor()
      await outcomeIs("nothing yet")
      await save()
      await dialog.waitFor({ state: "detached" })
      await saved.waitFor()
      await card.locator(`[data-e2e="unsaved-outcome"]`)
        .getByText(/^Outcome: navigate\("\/.*unsaved-demo\/notes\/2"\)$/).waitFor()

      await draft.fill("Another unsaved change")
      await card.getByRole("checkbox", { name: "Unsaved changes", checked: true }).waitFor()
      save = await holdTimer(page, 3_000)
      await saveLate.click()
      await lists.click()
      await dialog.waitFor()
      await save()
      await dialog.waitFor({ state: "detached" })
      await saved.waitFor()
      await outcomeIs(`navigate("unsaved-demo/lists") from code`)
    },
  },
  ...unsavedHistorySpecs(),
]
