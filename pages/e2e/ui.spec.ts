/** Playwright specs for `ui/` components, on the guide's UI page. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "./runner.ts"
import { scrollRegionSpec } from "./scroll-region.ts"

/** The parts of the `UnsavedGuard` card a spec drives, with a change already typed in its field. */
async function unsavedGuardWithAChange(page: Page) {
  const card = page.locator("#demo-UnsavedGuard")
  const draft = card.locator(`[data-e2e="unsaved-draft"]`)
  const dialog = page.getByRole("alertdialog", { name: "Leave without saving?" })
  const outcome = card.locator(`[data-e2e="unsaved-outcome"]`)
  await draft.fill("An unsaved change")
  await card.getByRole("checkbox", { name: "Unsaved changes", checked: true }).waitFor()
  return {
    card,
    draft,
    dialog,
    // By hook, as the specs find every dialog's footer buttons.
    stay: dialog.locator(`[data-e2e="confirm-dialog-cancel"]`),
    leave: dialog.locator(`[data-e2e="confirm-dialog-confirm"]`),
    lists: card.locator(`[data-e2e="unsaved-go-lists"]`),
    /** Waits for the card to report one outcome, word for word. */
    outcomeIs: (text: string) => outcome.getByText(`Outcome: ${text}`, { exact: true }).waitFor(),
    /** Waits for the card to have counted this many navigations started from code. */
    callsAre: (count: number) =>
      card.locator(`[data-e2e="unsaved-calls"]`)
        .getByText(`Navigations from code: ${count}`, { exact: true }).waitFor(),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
  }
}

/**
 * Throws unless the dialog's buttons are exactly these, one of each name.
 *
 * @param dialog The open dialog.
 * @param names Every button's accessible name, in any order.
 */
async function buttonsAreNamed(dialog: Locator, names: readonly string[]): Promise<void> {
  const buttons = dialog.getByRole("button")
  await buttons.nth(names.length - 1).waitFor()
  const total = await buttons.count()
  if (total !== names.length) throw new Error(`${total} buttons, expected ${names.join(", ")}`)
  for (const name of names) {
    const named = await dialog.getByRole("button", { name, exact: true }).count()
    if (named !== 1) throw new Error(`${named} buttons are named "${name}", expected 1`)
  }
}

/** One required control of the Field card's order form, and how a spec fills it. */
interface RequiredControl {
  /** The control's name in the spec's own name. */
  name: string
  /** `id` of the element the browser focuses when it refuses the submit for this control. */
  focusId: string
  /** Gives the control a value. */
  fill: (form: Locator) => Promise<void>
}

const REQUIRED_CONTROLS: readonly RequiredControl[] = [
  {
    name: "MoneyInput",
    focusId: "guide-required-price",
    fill: (form) => form.locator("#guide-required-price").fill("12"),
  },
  {
    name: "TagInput",
    focusId: "guide-required-tags",
    // A comma ends the tag, so the text field is empty again while the field holds a chip.
    fill: async (form) => {
      await form.locator("#guide-required-tags").pressSequentially("work,")
      await form.getByRole("button", { name: "Remove tag work", exact: true }).waitFor()
    },
  },
  {
    name: "Combobox",
    focusId: "guide-required-city",
    fill: async (form) => {
      await form.locator("#guide-required-city").click()
      await form.getByRole("option", { name: "Lisbon", exact: true }).click()
    },
  },
  {
    name: "RadioGroup",
    focusId: "guide-required-plan-0",
    fill: (form) => form.getByRole("radio", { name: "Express", exact: true }).check(),
  },
]

/** A required `Field` around each control that enforces `required` in its own way. */
function requiredFieldSpecs(): Spec[] {
  const blocked = REQUIRED_CONTROLS.map((control): Spec => ({
    name:
      `Field required around ${control.name}: a submit with only that field empty is refused and focus goes to it, and the same submit goes through once it has a value`,
    pageId: "ui",
    run: async (page) => {
      const form = page.locator(`[data-e2e="required-form"]`)
      const submits = form.locator(`[data-e2e="required-submits"]`)
      const submit = form.locator(`[data-e2e="required-submit"]`)
      await form.locator(`[data-e2e="required-reset"]`).click()
      for (const other of REQUIRED_CONTROLS) {
        if (other !== control) await other.fill(form)
      }
      await submit.click()
      // The browser focuses the first control it refuses, and only an invalid one.
      await form.locator(`#${control.focusId}:invalid:focus`).waitFor()
      const refused = (await submits.textContent())?.trim()
      if (refused !== "submits: 0") throw new Error(`a refused submit left "${refused}"`)
      await control.fill(form)
      await submit.click()
      await submits.getByText("submits: 1", { exact: true }).waitFor()
    },
  }))
  return [
    ...blocked,
    {
      name:
        "Field around Combobox: an error under it marks the input invalid and describes it, and axe passes the form of required fields",
      pageId: "ui",
      run: async (page) => {
        const form = page.locator(`[data-e2e="required-form"]`)
        const city = form.locator("#guide-required-city")
        await city.click()
        await form.getByRole("option", { name: "Atlantis", exact: true }).click()
        await form.locator("#guide-required-city-error")
          .getByText("We do not ship to Atlantis", { exact: true }).waitFor()
        await city.and(
          page.locator(`[aria-invalid="true"][aria-describedby~="guide-required-city-error"]`),
        ).waitFor()
        const { violations } = await new AxeBuilder({ page })
          .include(`[data-e2e="required-form"]`).analyze()
        if (violations.length > 0) {
          throw new Error(violations.map((found) => `${found.id}: ${found.help}`).join("; "))
        }
      },
    },
  ]
}

/** `ConfirmDialog`'s three buttons, by the names a screen reader reads. */
function confirmDialogNameSpecs(): Spec[] {
  return [
    {
      name:
        "ConfirmDialog: the corner button is named Close or by closeLabel, no two buttons share a name, it cancels, and axe passes the dialog",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ConfirmDialog")
        const archive = page.getByRole("alertdialog", { name: "Archive invoice INV-0007?" })
        await card.getByRole("button", { name: "Archive invoice" }).click()
        await archive.waitFor()
        const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze()
        if (violations.length > 0) {
          throw new Error(`axe on the open dialog: ${violations.map(({ id }) => id).join(", ")}`)
        }
        await buttonsAreNamed(archive, ["Close without archiving", "Cancel", "Archive"])
        await archive.getByRole("button", { name: "Close without archiving" }).click()
        await archive.waitFor({ state: "detached" })
        await card.getByText("Outcome: nothing confirmed yet", { exact: true }).waitFor()

        const leave = page.getByRole("alertdialog", { name: "Unsaved changes" })
        await card.getByRole("button", { name: "Leave page" }).click()
        await buttonsAreNamed(leave, ["Close", "Stay", "Discard"])
      },
    },
    {
      name:
        "UnsavedGuard: the dialog has one Stay button, and its corner button is named Close and stays",
      pageId: "ui",
      run: async (page) => {
        const { dialog, lists, outcomeIs, focusIsOn } = await unsavedGuardWithAChange(page)
        await lists.click()
        await buttonsAreNamed(dialog, ["Close", "Stay", "Leave"])
        await dialog.getByRole("button", { name: "Close", exact: true }).click()
        await dialog.waitFor({ state: "detached" })
        await focusIsOn(lists)
        await outcomeIs("nothing yet")
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  {
    name: "ToggleField: a click on the label flips the switch and tells the caller, both ways",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-ToggleField")
      const label = card.locator("#guide-toggle-archived-label")
      const toggle = card.getByRole("switch", { name: "Show archived" })
      const report = card.locator(`[data-e2e="controlled-value"]`)

      await toggle.and(page.locator(`[aria-checked="false"]`)).waitFor()
      await label.click()
      await toggle.and(page.locator(`[aria-checked="true"]`)).waitFor()
      await report.filter({ hasText: "archived: on" }).waitFor()
      await label.click()
      await toggle.and(page.locator(`[aria-checked="false"]`)).waitFor()
      await report.filter({ hasText: "archived: off" }).waitFor()
    },
  },
  scrollRegionSpec({
    what: "CopyBlock with singleLine",
    pageId: "ui",
    selector: `#demo-CopyBlock code[aria-label]`,
    name: "Install command",
    key: "ArrowRight",
  }),
  {
    name: "CopyBlock with singleLine and text that fits: the text is no Tab stop and has no " +
      "role or name, until its box gets too narrow for it or its text gets too wide",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-CopyBlock")
      const text = card.locator(`[data-e2e="copy-block-fits"] code`)
      const plain = text.and(page.locator(":not([tabindex]):not([role]):not([aria-label])"))
      const scrolling = text.and(page.getByRole("group", { name: "Text to copy", exact: true }))
        .and(page.locator(`[tabindex="0"]`))
      // The server renders the Tab stop; it goes once the mounted block has measured its text.
      await plain.waitFor()

      // Back from the block's own copy button, the stop before it is not the text.
      const button = card.getByRole("button", { name: "Copy the short id" })
      await button.focus()
      await page.keyboard.press("Shift+Tab")
      await button.and(page.locator(":focus")).waitFor({ state: "hidden" })
      const stop = await page.locator(":focus").evaluate((node) => node.tagName)
      if (stop === "CODE") throw new Error("Shift+Tab from the copy button landed on the text")

      // A narrower box makes the same text overflow, and a wider one makes it fit again.
      await text.evaluate((node) => node.parentElement?.style.setProperty("width", "120px"))
      await scrolling.waitFor()
      await text.evaluate((node) => node.parentElement?.style.removeProperty("width"))
      await plain.waitFor()

      // Wider text in the same box overflows too: the text is watched, not only the box.
      const line = text.locator("span")
      await line.evaluate((node) => node.style.setProperty("letter-spacing", "3em"))
      await scrolling.waitFor()
      await line.evaluate((node) => node.style.removeProperty("letter-spacing"))
      await plain.waitFor()
      return `the stop before the copy button is a ${stop}`
    },
  },
  {
    name: "PageHeader's heading leaves room for the whole focus ring of a button in its heading " +
      "slot",
    pageId: "ui",
    run: async (page) => {
      const button = page.locator(`#demo-PageHeader [data-card-part="demo"]`)
        .getByRole("heading").getByRole("button", { name: "Packing list" })
      await button.focus()
      await button.and(page.locator(":focus")).waitFor()
      // The ring is measured as geometry, so this holds whether or not the browser draws
      // `:focus-visible` for a scripted focus: no box between the button and its header may hide
      // overflow while cutting into the button's box grown by the 4 px ring (#579).
      const clippers = await button.evaluate((control) => {
        const ring = 4
        const box = control.getBoundingClientRect()
        const header = control.closest("header")
        const found: string[] = []
        for (let at = control.parentElement; at && header?.contains(at); at = at.parentElement) {
          const style = getComputedStyle(at)
          if (style.overflowX === "visible" && style.overflowY === "visible") continue
          const edge = at.getBoundingClientRect()
          if (
            edge.left > box.left - ring || edge.top > box.top - ring ||
            edge.right < box.right + ring || edge.bottom < box.bottom + ring
          ) {
            found.push(`${at.tagName.toLowerCase()} overflow ${style.overflowX}/${style.overflowY}`)
          }
        }
        return header ? found : ["no header around the button"]
      })
      if (clippers.length > 0) throw new Error(`boxes that clip the ring: ${clippers.join(", ")}`)
      return "boxes that clip the ring: none"
    },
  },
  // Forms and accessibility (#116): refs, `required`, `aria-pressed`, reduced motion.
  refSpec("Textarea", "textarea"),
  refSpec("Select", "select"),
  refSpec("InputButton", "input"),
  refSpec("Card", "div.pc-card"),
  {
    name: "Field: a required field's control is required to the browser, and no other is",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-Field")
      // The demo's `Input` carries no `required` of its own: only its `Field` does.
      const email = card.locator("#guide-email")
      await email.and(page.locator(":required")).waitFor()
      await card.locator("#guide-name").and(page.locator(":optional")).waitFor()
      await email.fill("")
      if (!await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)) {
        throw new Error("the browser accepts the required field left empty")
      }
    },
  },
  {
    name: "OnOffButtons: a click and a key press move aria-pressed, inside a named group",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-OnOffButtons")
      const group = card.getByRole("group", { name: "ON / OFF", exact: true })
      const half = (name: string, pressed: boolean) =>
        group.getByRole("button", { name, exact: true, pressed })

      await half("ON", false).waitFor()
      await half("OFF", false).waitFor()
      await half("ON", false).click()
      await half("ON", true).waitFor()
      await half("OFF", false).waitFor()
      await half("OFF", false).press("Enter")
      await half("OFF", true).waitFor()
      await half("ON", false).waitFor()
      await half("ON", false).press("Space")
      await half("ON", true).waitFor()
      await half("OFF", false).waitFor()
      // The second pair shows the same value under the caller's own group name and labels.
      const named = card.getByRole("group", { name: "Rows to show", exact: true })
      await named.getByRole("button", { name: /^Active/, pressed: true }).waitFor()
      await named.getByRole("button", { name: /^Archived/, pressed: false }).waitFor()
    },
  },
  {
    name:
      "LoadingSpinner, LoadingSkeleton and a busy Button animate, and stop under reduced motion",
    pageId: "ui",
    run: async (page) => {
      await page.locator(`#demo-Button [data-e2e="busy-confirm"]`).click()
      const animated = {
        "LoadingSpinner": page.locator("#demo-LoadingSpinner .animate-spin"),
        "LoadingSkeleton": page.locator("#demo-LoadingSkeleton .animate-pulse"),
        "busy Button": page.locator(`#demo-Button [data-e2e="busy-confirm"] .animate-spin`),
      }
      for (const marks of Object.values(animated)) await marks.first().waitFor()

      const moving = await animationNames(animated)
      await page.emulateMedia({ reducedMotion: "reduce" })
      const reduced = await animationNames(animated)

      const expected = {
        "LoadingSpinner": "spin",
        "LoadingSkeleton": "pulse",
        "busy Button": "spin",
      }
      for (const [name, animation] of Object.entries(expected)) {
        if (moving[name].length === 0 || moving[name].some((found) => found !== animation)) {
          throw new Error(`${name} without reduced motion: animations [${moving[name]}]`)
        }
        if (reduced[name].some((found) => found !== "none")) {
          throw new Error(`${name} under reduced motion still runs [${reduced[name]}]`)
        }
      }
      return `stopped ${Object.values(reduced).flat().length} animated elements`
    },
  },
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
  ...unsavedHistorySpecs(),
  ...quickAddSpecs(),
  ...confirmDialogNameSpecs(),
  ...removalSpecs(),
  ...requiredFieldSpecs(),
  ...toastrSpecs(),
]

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
  ]
}

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

/**
 * A spec proving one component hands its `ref` the native element: the card's "Focus via ref"
 * button calls `.focus()` through the ref, and focus must land on the marked element, which must be
 * the element the component draws.
 *
 * @param name The component, which is also its card's name.
 * @param element A selector the focused element must match.
 */
function refSpec(name: string, element: string): Spec {
  return {
    name: `${name}: a ref reaches the native element, so "Focus via ref" focuses it`,
    pageId: "ui",
    run: async (page) => {
      const card = page.locator(`#demo-${name}`)
      const target = card.locator(`${element}[data-e2e="ref-target"]`)
      await target.waitFor()
      if (await target.evaluate((node) => node === document.activeElement)) {
        throw new Error("the target had focus before the button was pressed")
      }
      await card.locator(`[data-e2e="ref-focus"]`).click()
      await target.and(page.locator(":focus")).waitFor()
    },
  }
}

/**
 * Read the computed `animation-name` of every element each locator matches.
 *
 * @param groups The elements to read, by a name for the report.
 * @returns The names found, per group, in document order.
 */
async function animationNames(
  groups: Record<string, Locator>,
): Promise<Record<string, string[]>> {
  const found: Record<string, string[]> = {}
  for (const [name, marks] of Object.entries(groups)) {
    found[name] = await marks.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).animationName)
    )
  }
  return found
}

/** The parts of the first `QuickAdd` on its guide card, and the line that lists what it added. */
function quickAdd(page: Page) {
  const card = page.locator("#demo-QuickAdd")
  const part = (name: string) => card.locator(`[data-e2e="quick-add${name}"]`)
  return {
    card,
    form: part(""),
    input: part("-input"),
    submit: part("-submit"),
    chips: part("-chips"),
    live: part("-live"),
    /** The message a person sees, which assistive technology must be able to read too. */
    notice: card.locator(`[data-e2e="quick-add"] p[id$="-notice"]:not([aria-hidden])`),
    added: part("-added"),
    busy: part("-busy"),
  }
}

/** Throws unless the element's text is exactly `text` now; for a state already waited for. */
async function textIs(locator: Locator, text: string): Promise<void> {
  const found = await locator.textContent()
  if (found !== text) throw new Error(`expected "${text}", found "${found}"`)
}

/**
 * Records every text the live region holds from now on, so an announcement cannot come and go
 * unseen. Empty text is left out: a screen reader has nothing to say for it.
 *
 * @returns A function that reads what was recorded so far, in order.
 */
async function recordSpoken(page: Page, live: Locator): Promise<() => Promise<string[]>> {
  await live.evaluate((region) => {
    const spoken: string[] = []
    Object.assign(globalThis, { quickAddSpoken: spoken })
    new MutationObserver(() => {
      if (region.textContent) spoken.push(region.textContent)
    }).observe(region, { childList: true, characterData: true, subtree: true })
  })
  return () =>
    page.evaluate(() => (globalThis as unknown as { quickAddSpoken: string[] }).quickAddSpoken)
}

/** `QuickAdd` with badges and the empty-title message showing has no axe violation. */
function quickAddAxe(colorScheme: "light" | "dark"): Spec {
  return {
    name:
      `QuickAdd: axe finds no violation with badges and the empty-title message showing, ${colorScheme}`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const { input, submit, chips, notice } = quickAdd(page)
      await input.fill("#work 2099-01-05 !high")
      await submit.click()
      await chips.locator("li").nth(2).waitFor()
      await notice.waitFor()
      const { violations, passes } = await new AxeBuilder({ page })
        .include(`#demo-QuickAdd [data-e2e="quick-add"]`)
        .include(`#demo-QuickAdd [data-e2e="quick-add-clock"]`)
        .include(`#demo-QuickAdd [data-e2e="quick-add-worded"]`)
        .analyze()
      if (violations.length > 0) {
        throw new Error(
          violations.map(({ id, nodes }) =>
            `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
          ).join(" | "),
        )
      }
      return `${passes.length} rules pass`
    },
  }
}

/** The `QuickAdd` specs: typing, the timed announcement, refused sends, busy, the clock, axe. */
function quickAddSpecs(): Spec[] {
  return [
    {
      name:
        "QuickAdd: a tag typed letter by letter is announced once, whole, after the typing stops",
      pageId: "ui",
      run: async (page) => {
        const { input, chips, live } = quickAdd(page)
        const spoken = await recordSpoken(page, live)
        // A person's pace: slower than a frame, so each letter is drawn, and well inside the pause.
        await input.pressSequentially("a #work", { delay: 100 })
        await chips.locator("li").filter({ hasText: /^Tag work$/ }).waitFor()
        await live.filter({ hasText: /^Tag work$/ }).waitFor()
        const heard = await spoken()
        if (heard.join("|") !== "Tag work") {
          throw new Error(`the live region held, in order: ${JSON.stringify(heard)}`)
        }
        return "heard: Tag work"
      },
    },
    {
      name:
        "QuickAdd: the button adds the title, tag, due and priority, empties the field and moves focus into it",
      pageId: "ui",
      run: async (page) => {
        const { card, input, submit, chips, live, added } = quickAdd(page)
        await input.fill("Call Anna #work 2099-01-05 3pm !high")
        const named = card.getByRole("list", { name: "Recognised in your line", exact: true })
        for (const badge of ["Tag work", "Due Mon 5 Jan 15:00", "High priority"]) {
          await named.locator("li").filter({ hasText: new RegExp(`^${badge}$`) }).waitFor()
        }
        await live.filter({ hasText: /^Tag work, Due Mon 5 Jan 15:00, High priority$/ }).waitFor()
        await submit.click()
        await added.filter({ hasText: "added 1:" }).waitFor()
        await textIs(
          added,
          `added 1: {"title":"Call Anna","tags":["work"],"contexts":[],` +
            `"due":{"date":"2099-01-05","time":"15:00"},"priority":1}`,
        )
        await input.and(page.locator(":focus:placeholder-shown")).waitFor()
        await chips.waitFor({ state: "detached" })
        await live.filter({ hasText: /^$/ }).waitFor()
      },
    },
    {
      name:
        "QuickAdd: a line of only tokens sent with the button adds nothing, and its message is shown, spoken once and tied to the invalid, focused field until the next key",
      pageId: "ui",
      run: async (page) => {
        const { input, submit, live, notice, added } = quickAdd(page)
        const spoken = await recordSpoken(page, live)
        await input.fill("#work !high")
        await live.filter({ hasText: /^Tag work, High priority$/ }).waitFor()
        await input.and(page.locator(":not([aria-invalid])")).waitFor()
        await submit.click()
        await notice.filter({ hasText: /^Add a title first$/ }).waitFor()
        await live.filter({ hasText: /^Add a title first$/ }).waitFor()
        await input.and(page.locator(`:focus[aria-invalid="true"]`)).waitFor()
        // The message comes first in the field's description, before the hint.
        const described = await input.evaluate((field) => {
          const [first] = (field.getAttribute("aria-describedby") ?? "").split(" ")
          return field.ownerDocument.getElementById(first)?.textContent ?? `nothing at "${first}"`
        })
        if (described !== "Add a title first") {
          throw new Error(`the field is described first by: ${described}`)
        }
        if (await input.inputValue() !== "#work !high") throw new Error("the typed line was lost")
        await input.pressSequentially(" x")
        await notice.waitFor({ state: "detached" })
        await input.and(page.locator(":not([aria-invalid])")).waitFor()
        await live.filter({ hasText: /^$/ }).waitFor()
        await textIs(added, "added 0: ")
        const heard = await spoken()
        if (heard.join("|") !== "Tag work, High priority|Add a title first") {
          throw new Error(`the live region held, in order: ${JSON.stringify(heard)}`)
        }
      },
    },
    {
      name: "QuickAdd: a blank line sent with the button says nothing and moves focus to the field",
      pageId: "ui",
      run: async (page) => {
        const { input, submit, notice, added } = quickAdd(page)
        await input.fill("   ")
        await submit.click()
        await input.and(page.locator(":focus")).waitFor()
        if (await notice.count() !== 0) throw new Error("a blank line showed a message")
        await textIs(added, "added 0: ")
      },
    },
    {
      name:
        "QuickAdd: while busy the field takes no typing and neither Enter nor a scripted submit adds; afterwards Enter adds the kept text",
      pageId: "ui",
      run: async (page) => {
        const { form, input, added, busy } = quickAdd(page)
        await input.fill("Second")
        await busy.click()
        await input.and(page.locator("[readonly]")).waitFor()
        await input.focus()
        await input.pressSequentially("x")
        await input.press("Enter")
        // The button is off, so Enter never reaches the handler; a script's submit does.
        await form.evaluate((element: HTMLFormElement) => element.requestSubmit())
        // A send that got through would have emptied the field and listed the item by now.
        await busy.click()
        await input.and(page.locator(":not([readonly])")).waitFor()
        if (await input.inputValue() !== "Second") throw new Error("the text changed while busy")
        await textIs(added, "added 0: ")
        await input.press("Enter")
        await added.filter({ hasText: `added 1: {"title":"Second"` }).waitFor()
      },
    },
    {
      name:
        "QuickAdd: at 01:00 in the given zone, a day ahead of UTC, 'tomorrow' is that zone's tomorrow in the badge and in what is added",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-QuickAdd")
        const part = (name: string) => card.locator(`[data-e2e="quick-add-clock${name}"]`)
        await part("-input").fill("Water the plants tomorrow 3pm")
        await part("-chips").locator("li").filter({ hasText: /^Due Tomorrow 15:00$/ }).waitFor()
        await part("-input").press("Enter")
        await part("-added").filter({ hasText: "plants" }).waitFor()
        await textIs(part("-added"), "added: Water the plants, due 2026-03-09")
      },
    },
    quickAddAxe("light"),
    quickAddAxe("dark"),
  ]
}

const TOAST_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const

/** The `Toastr` card at a window 800 px tall and as wide as asked, with its stack and its picker. */
async function toastrCard(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  const card = page.locator("#demo-Toastr")
  const stack = page.locator(`[data-e2e="guide-toastr"]`)
  const toast = stack.locator(`[data-e2e="guide-toast-info"]`)
  return {
    stack,
    toast,
    dismiss: toast.getByRole("button", { name: "Dismiss" }),
    /** Pushes the card's info toast and waits until its slide has ended, so its box is final. */
    push: async () => {
      await card.locator(`[data-e2e="toast-info"]`).click()
      await toast.waitFor()
      await toast.evaluate((element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished))
      )
    },
    /**
     * Pushes the card's info toast and reads its horizontal `translate` the moment it is in the
     * document, which is where its slide starts: negative from the left, positive from the right,
     * 0 with no slide.
     */
    pushAndReadStart: async (): Promise<number> => {
      // The observer is in place before the click: this call returns once it watches the stack.
      const start = await stack.evaluateHandle((element) => ({
        translate: new Promise<string>((done) => {
          new MutationObserver((records, observer) => {
            const added = records.flatMap((record) => [...record.addedNodes])
              .find((node) => node instanceof HTMLElement)
            if (!added) return
            observer.disconnect()
            done(getComputedStyle(added as HTMLElement).translate)
          }).observe(element, { childList: true })
        }),
      }))
      await card.locator(`[data-e2e="toast-info"]`).click()
      return parseFloat((await start.evaluate((held) => held.translate)).split(" ")[0]) || 0
    },
    /** Empties the stack. A dispatched click, as for the picker below. */
    clear: async () => {
      await card.locator(`[data-e2e="toast-clear"]`).dispatchEvent("click")
      await toast.waitFor({ state: "detached" })
    },
    /** Puts the stack in a corner. A dispatched click: a toast may lie over the radio by now. */
    moveTo: async (corner: typeof TOAST_CORNERS[number]) => {
      await card.locator(`input[name="guide-toastr-corner"][value="${corner}"]`)
        .dispatchEvent("click")
      // An empty stack has no height, so it is attached and never "visible".
      await stack.and(page.locator(":not(.static)")).waitFor({ state: "attached" })
    },
    /** The window's width without the page's own scrollbar, which a desktop browser draws. */
    innerWidth: () => page.evaluate(() => document.documentElement.clientWidth),
  }
}

/** A locator's box, or an error naming what had none. */
async function boxOf(locator: Locator, what: string) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${what} has no box`)
  return box
}

/** A spec that a toast's slide starts on its corner's side at the given window width. */
function toastSlideSpec(width: number): Spec {
  return {
    name:
      `Toastr: at ${width} px wide a toast slides in from the left in a left corner and from the right in a right one`,
    pageId: "ui",
    run: async (page) => {
      const { moveTo, pushAndReadStart, clear } = await toastrCard(page, width)
      const starts: string[] = []
      for (const corner of TOAST_CORNERS) {
        await moveTo(corner)
        const x = await pushAndReadStart()
        if (corner.endsWith("left") ? x >= 0 : x <= 0) {
          throw new Error(`${corner}: the slide starts at translate x ${x}px`)
        }
        starts.push(`${corner} ${x}px`)
        await clear()
      }
      return starts.join(", ")
    },
  }
}

/**
 * `Toastr` on a phone and from `sm` up: where the stack sits in each corner, which side a toast
 * slides in from, and how large the dismiss button is.
 */
function toastrSpecs(): Spec[] {
  return [
    ...([320, 414] as const).map((width): Spec => ({
      name:
        `Toastr: at ${width} px wide, in each of the four corners, a toast is inside the window, 16 px from the left, the right and the corner's top or bottom edge`,
      pageId: "ui",
      run: async (page) => {
        const { toast, push, moveTo, innerWidth } = await toastrCard(page, width)
        await push()
        const inner = await innerWidth()
        for (const corner of TOAST_CORNERS) {
          await moveTo(corner)
          const box = await boxOf(toast, `the toast in ${corner}`)
          const [left, right] = [box.x, inner - box.x - box.width]
          const edge = corner.startsWith("top") ? box.y : 800 - box.y - box.height
          if ([left, right, edge].some((gap) => Math.abs(gap - 16) > 0.5)) {
            throw new Error(
              `${corner}: ${left}px to the left, ${right}px to the right, ${edge}px from its edge`,
            )
          }
        }
      },
    })),
    {
      name:
        "Toastr: at 320 px wide the dismiss button is at least 44 px each way inside its toast, and Enter on it closes the toast",
      pageId: "ui",
      run: async (page) => {
        const { toast, dismiss, push, moveTo } = await toastrCard(page, 320)
        await push()
        await moveTo("top-right")
        const frame = await boxOf(toast, "the toast")
        const box = await boxOf(dismiss, "the dismiss button")
        if (box.width < 44 || box.height < 44) {
          throw new Error(`the dismiss button is ${box.width} × ${box.height} px`)
        }
        if (
          box.x < frame.x || box.y < frame.y || box.x + box.width > frame.x + frame.width + 0.5 ||
          box.y + box.height > frame.y + frame.height + 0.5
        ) {
          throw new Error(
            `the button leaves its toast: ${JSON.stringify(box)} in ${JSON.stringify(frame)}`,
          )
        }
        await dismiss.focus()
        await page.keyboard.press("Enter")
        await toast.waitFor({ state: "detached" })
        return `${box.width} × ${box.height} px`
      },
    },
    ...([[640, 320], [1440, 384]] as const).map(([width, stackWidth]): Spec => ({
      name:
        `Toastr: at ${width} px wide the stack is ${stackWidth} px wide, 32 px from both edges of its corner, and the dismiss button is at least 36 px each way`,
      pageId: "ui",
      run: async (page) => {
        const { stack, dismiss, push, moveTo, innerWidth } = await toastrCard(page, width)
        await push()
        const inner = await innerWidth()
        for (const corner of TOAST_CORNERS) {
          await moveTo(corner)
          const box = await boxOf(stack, `the stack in ${corner}`)
          const side = corner.endsWith("left") ? box.x : inner - box.x - box.width
          const edge = corner.startsWith("top") ? box.y : 800 - box.y - box.height
          if (
            Math.abs(box.width - stackWidth) > 0.5 || Math.abs(side - 32) > 0.5 ||
            Math.abs(edge - 32) > 0.5
          ) {
            throw new Error(
              `${corner}: ${box.width}px wide, ${side}px and ${edge}px from its edges`,
            )
          }
        }
        const button = await boxOf(dismiss, "the dismiss button")
        if (button.width < 36 || button.height < 36) {
          throw new Error(`the dismiss button is ${button.width} × ${button.height} px`)
        }
      },
    })),
    {
      name:
        "Toastr: the dismiss button adds no height: at 414 and 1440 px a toast is as tall as its text plus 16 px above and below",
      pageId: "ui",
      run: async (page) => {
        const heights: string[] = []
        // At 414 px the title and a one-line body are 40 px, less than the 44 px button.
        for (const width of [414, 1440]) {
          const { toast, push, moveTo, clear } = await toastrCard(page, width)
          await push()
          await moveTo("top-right")
          const box = await boxOf(toast, "the toast")
          const first = await boxOf(toast.locator("p").first(), "the toast's first line")
          const last = await boxOf(toast.locator("p").last(), "the toast's last line")
          const text = last.y + last.height - first.y
          if (Math.abs(box.height - text - 32) > 0.5) {
            throw new Error(
              `at ${width} px the toast is ${box.height}px tall around ${text}px of text`,
            )
          }
          heights.push(`${width}: ${box.height}px around ${text}px`)
          await clear()
        }
        return heights.join(", ")
      },
    },
    {
      name:
        "Toastr: a caller's own offsets place the stack from 640 px up: the mini-app's toast sits 17 px from the bottom and the right of its frame, and its empty stack has no height",
      pageId: "overview",
      run: async (page) => {
        const frame = page.locator(`[data-e2e="mini-app"]`)
        const stack = frame.locator(`[data-e2e="mini-app-toasts"]`)
        const toast = stack.locator(`[role="status"]`)
        const gaps: string[] = []
        for (const width of [640, 768, 1440]) {
          await page.setViewportSize({ width, height: 800 })
          const empty = await stack.evaluate((element) => element.getBoundingClientRect().height)
          if (empty !== 0) throw new Error(`at ${width} px the empty stack is ${empty}px tall`)
          await frame.locator(`[data-e2e="mini-app-toast"]`).click()
          await toast.waitFor()
          await toast.evaluate((element) =>
            Promise.all(element.getAnimations().map((animation) => animation.finished))
          )
          const outer = await boxOf(frame, "the mini-app's frame")
          const box = await boxOf(toast, "the mini-app's toast")
          const bottom = outer.y + outer.height - box.y - box.height
          const right = outer.x + outer.width - box.x - box.width
          if (Math.abs(bottom - 17) > 1 || Math.abs(right - 17) > 1) {
            throw new Error(
              `at ${width} px the toast is ${bottom}px from the bottom and ${right}px from the right`,
            )
          }
          gaps.push(`${width}: ${bottom}px, ${right}px`)
          await toast.getByRole("button", { name: "Dismiss" }).click()
          await toast.waitFor({ state: "detached" })
        }
        return gaps.join("; ")
      },
    },
    toastSlideSpec(320),
    toastSlideSpec(1440),
    {
      name: "Toastr: with reduced motion requested, a toast does not slide in, left or right",
      pageId: "ui",
      run: async (page) => {
        await page.emulateMedia({ reducedMotion: "reduce" })
        const { moveTo, pushAndReadStart, clear } = await toastrCard(page, 1440)
        for (const corner of ["top-left", "top-right"] as const) {
          await moveTo(corner)
          const x = await pushAndReadStart()
          if (x !== 0) throw new Error(`${corner}: the toast starts at translate x ${x}px`)
          await clear()
        }
      },
    },
  ]
}
