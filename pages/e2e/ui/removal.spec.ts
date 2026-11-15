import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** The parts of the `ErrorState` card's removal demo a spec drives. */
function removalDemo(page: Page) {
  const demo = page.locator(`#demo-ErrorState [data-e2e="removal-demo"]`)
  const dialog = page.locator(`[data-e2e="removal-dialog"]`)
  const error = dialog.locator(`[data-e2e="removal-error"]`)
  const open = (name: string) => demo.getByRole("button", { name: `Remove ${name}`, exact: true })
  return {
    dialog,
    error,
    open,
    reset: demo.locator(`[data-e2e="removal-reset"]`),
    keep: dialog.locator(`[data-e2e="confirm-dialog-cancel"]`),
    /** The button that takes Grace off the list with no removal running. */
    leave: demo.locator(`[data-e2e="removal-leave"]`),
    /** The button that ends a request left running by "Take the row at once". */
    end: demo.locator(`[data-e2e="removal-end"]`),
    /** Ticks one of the demo's checkboxes. */
    tick: (name: string) => demo.getByRole("checkbox", { name }).check(),
    /** Picks what each row starts with. */
    startRowsWith: (name: string) => demo.getByRole("radio", { name }).check(),
    /**
     * Waits for the demo's last line to read this. The demo writes it from an effect that runs
     * after the hook's, so once it shows, the hook has done all it does for that state.
     */
    settledIs: (text: string) =>
      demo.locator(`[data-e2e="removal-settled"]`).getByText(text, { exact: true }).waitFor(),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
    /** Opens a row's dialog and confirms the removal. */
    confirm: async (name: string) => {
      await open(name).click()
      await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
    },
    /** Waits for the dialog to be gone with its row, and for the focus to be on one element. */
    removedWithFocusOn: async (target: Locator) => {
      await dialog.waitFor({ state: "detached" })
      await target.and(page.locator(":focus")).waitFor()
    },
  }
}

/** `ErrorState` with `focusOnAppear`, `useFreshError` and `useFocusAfterRemoval`, on one list. */
function removalSpecs(): Spec[] {
  return [
    {
      name:
        "ErrorState with focusOnAppear: a refusal that appears in the dialog that asked takes focus, and axe passes the dialog",
      pageId: "ui",
      run: async (page) => {
        const { error, tick, confirm } = removalDemo(page)
        await tick("Refuse the next removal")
        await confirm("Ada")
        await error.filter({ hasText: "Ada could not be removed." }).and(page.locator(":focus"))
          .waitFor()
        const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze()
        if (violations.length > 0) {
          throw new Error(`axe on the open dialog: ${violations.map(({ id }) => id).join(", ")}`)
        }
      },
    },
    {
      name: "ErrorState with focusOnAppear: a second refusal with another text takes focus again",
      pageId: "ui",
      run: async (page) => {
        const { dialog, error, tick, confirm, focusIsOn } = removalDemo(page)
        const again = dialog.locator(`[data-e2e="confirm-dialog-confirm"]`)
        await tick("Refuse the next removal")
        await confirm("Ada")
        await focusIsOn(error.filter({ hasText: "Ada could not be removed." }))
        // The first refusal stays on the page while the second attempt runs, so the alert never
        // disappears: only its text changes.
        await again.click()
        await focusIsOn(error.filter({ hasText: "Ada still could not be removed." }))
      },
    },
    {
      name:
        "useFreshError: a dialog opened again does not show the last refusal, and shows the next one although its text is the same",
      pageId: "ui",
      run: async (page) => {
        const { dialog, error, open, keep, tick, confirm } = removalDemo(page)
        await tick("Refuse the next removal")
        await confirm("Ada")
        await error.waitFor()
        await keep.click()
        await dialog.waitFor({ state: "detached" })

        await open("Ada").click()
        await dialog.waitFor()
        // The dialog and its error come from one render, so an error that is shown is there now.
        if (await error.count() !== 0) throw new Error("the dialog opened on the last refusal")

        await dialog.locator(`[data-e2e="confirm-dialog-confirm"]`).click()
        await error.filter({ hasText: "Ada could not be removed." }).waitFor()
      },
    },
    {
      name:
        "useFocusAfterRemoval: a removed row hands focus to the row that took its place, the last row to the one before it, and the only row to the fallback",
      pageId: "ui",
      run: async (page) => {
        const { open, reset, confirm, removedWithFocusOn } = removalDemo(page)
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
        await confirm("Linus")
        await removedWithFocusOn(open("Ada"))
        await confirm("Ada")
        await removedWithFocusOn(reset)
      },
    },
    {
      name:
        "useFocusAfterRemoval with earlier off: the last of several rows hands focus to the fallback, past the rows before it",
      pageId: "ui",
      run: async (page) => {
        const { reset, tick, confirm, removedWithFocusOn } = removalDemo(page)
        await tick("Skip earlier rows")
        await confirm("Linus")
        await removedWithFocusOn(reset)
      },
    },
    {
      name:
        "useFocusAfterRemoval: a row taken off the list while its request still runs hands focus on at once, and the end of the request moves nothing more",
      pageId: "ui",
      run: async (page) => {
        const { open, end, tick, confirm, removedWithFocusOn, settledIs, focusIsOn } = removalDemo(
          page,
        )
        await tick("Take the row at once")
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
        await settledIs("on the list: Ada, Linus · removing Grace")
        // The person moves on: the click puts focus on this button, and there it must stay.
        await end.click()
        await settledIs("on the list: Ada, Linus · removing nobody")
        await focusIsOn(end)
      },
    },
    {
      name:
        "useFocusAfterRemoval: a row that leaves by itself, after its removal was refused, moves nothing",
      pageId: "ui",
      run: async (page) => {
        const { dialog, error, keep, leave, tick, confirm, settledIs, focusIsOn } = removalDemo(
          page,
        )
        await tick("Refuse the next removal")
        await confirm("Grace")
        await error.waitFor()
        await keep.click()
        await dialog.waitFor({ state: "detached" })
        await leave.click()
        await settledIs("on the list: Ada, Linus · removing nobody")
        await focusIsOn(leave)
      },
    },
    {
      name:
        "useFocusAfterRemoval with a target: the control the caller picks takes focus, not the link the row starts with",
      pageId: "ui",
      run: async (page) => {
        const { open, startRowsWith, confirm, removedWithFocusOn } = removalDemo(page)
        await startRowsWith("A link")
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
      },
    },
    {
      name:
        "useFocusAfterRemoval: a hidden field at the start of a row is passed over for the row's button",
      pageId: "ui",
      run: async (page) => {
        const { open, startRowsWith, confirm, removedWithFocusOn } = removalDemo(page)
        await startRowsWith("A hidden field")
        await confirm("Grace")
        await removedWithFocusOn(open("Linus"))
      },
    },
    {
      name:
        "useFocusAfterRemoval: a row whose control does not take focus is passed over for another row, and for the fallback when no row is left",
      pageId: "ui",
      run: async (page) => {
        const { open, reset, startRowsWith, confirm, removedWithFocusOn } = removalDemo(page)
        // Linus's row starts with a button that is not shown, which the default target picks.
        await startRowsWith("A button that is not shown")
        await confirm("Grace")
        await removedWithFocusOn(open("Ada"))
        await confirm("Ada")
        await removedWithFocusOn(reset)
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...removalSpecs(),
]
