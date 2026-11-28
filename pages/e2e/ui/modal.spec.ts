import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** A field in the Modal card's form dialog that opens a popup, and how a spec opens it. */
interface PopupField {
  /** The component, in the spec's name. */
  name: string
  /** The popup, in the spec's name. */
  popup: string
  /** The control whose `aria-expanded` says whether the popup is open. */
  control: (dialog: Locator) => Locator
  /** Opens the popup from the keyboard, leaving focus inside the field. */
  open: (control: Locator) => Promise<void>
  /** The `Tooltip focusable={false}` group around the field, when it has one. */
  hint?: (dialog: Locator) => Locator
}

const popupFields: readonly PopupField[] = [
  {
    name: "Combobox",
    popup: "list",
    control: (dialog) => dialog.getByRole("combobox", { name: "City" }),
    open: async (control) => {
      await control.focus()
      await control.press("ArrowDown")
    },
    hint: (dialog) => dialog.getByRole("group", { name: "City" }),
  },
  {
    name: "TagInput",
    popup: "suggestion list",
    control: (dialog) => dialog.getByRole("combobox", { name: "Tags" }),
    open: async (control) => {
      await control.focus()
      await control.press("ArrowDown")
    },
    hint: (dialog) => dialog.getByRole("group", { name: "Tags" }),
  },
  {
    name: "DateRangePicker",
    popup: "panel",
    control: (dialog) => dialog.locator(`button[data-e2e="guide-modal-form-dates"]`),
    // A click, as a person opens it; the picker then moves focus into its panel.
    open: (control) => control.click(),
  },
]

/** Opens the Modal card's form dialog and returns it. */
async function openFormDialog(page: Page): Promise<Locator> {
  await page.locator(`#demo-Modal [data-e2e="modal-form-open"]`).click()
  const dialog = page.locator(`dialog[data-e2e="guide-modal-form"]`)
  await dialog.waitFor()
  return dialog
}

/**
 * Throws unless the dialog is still open two frames after a press, so a close the press set off
 * has had its render.
 */
async function expectStillOpen(dialog: Locator, cause: string): Promise<void> {
  // Read off the page, not the locator: a locator would wait for a dialog that has already gone.
  const open = await dialog.page().evaluate(async () => {
    for (let k = 0; k < 2; k++) await new Promise((resolve) => requestAnimationFrame(resolve))
    return document.querySelector(`dialog[data-e2e="guide-modal-form"]`)?.matches(":modal")
  })
  if (!open) throw new Error(`${cause} closed the dialog`)
}

/** The tooltip surface inside a trigger, shown (`true`) or dismissed with `hidden` (`false`). */
function hintSurface(trigger: Locator, shown: boolean): Locator {
  return trigger.locator(shown ? `[role="tooltip"]:not([hidden])` : `[role="tooltip"][hidden]`)
}

/**
 * Inside a `Modal`, the first Escape closes only the field's popup and the dialog with its form
 * stays open; the second Escape closes the dialog. One spec per field of the Modal card's form
 * dialog, each pressing the real key. A field wrapped in a `Tooltip` loses its shown hint on that
 * first Escape too, although the field stops the press before it reaches `document`.
 */
function escapeInsideModalSpecs(): Spec[] {
  return popupFields.map((field) => ({
    name: `${field.name} inside a Modal: the first Escape closes only its ${field.popup}` +
      (field.hint ? " and its hint" : "") + ", the second closes the dialog",
    pageId: "ui",
    run: async (page: Page) => {
      const dialog = await openFormDialog(page)
      const control = field.control(dialog)
      await field.open(control)
      await control.and(page.locator(`[aria-expanded="true"]`)).waitFor()
      const hint = field.hint?.(dialog)
      if (hint) await hintSurface(hint, true).waitFor()

      await page.keyboard.press("Escape")
      await control.and(page.locator(`[aria-expanded="false"]`)).waitFor()
      if (hint) await hintSurface(hint, false).waitFor({ state: "attached" })
      await expectStillOpen(dialog, `the first Escape, closing the ${field.popup},`)

      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "detached" })
    },
  }))
}

/** A hint the trigger holds by focus, inside a `Modal`: one Escape hides it, the next closes. */
interface FocusedHint {
  /** The trigger, in the spec's name. */
  name: string
  /** The element holding the hint: the `Tooltip` button or `role="group"`. */
  trigger: (dialog: Locator) => Locator
  /** Moves focus onto or into the trigger, with any popup it has left closed. */
  focus: (dialog: Locator) => Promise<void>
}

const focusedHints: readonly FocusedHint[] = [
  {
    name: "A focused Tooltip button",
    trigger: (dialog) => dialog.getByRole("button", { name: "About Escape" }),
    focus: (dialog) => dialog.getByRole("button", { name: "About Escape" }).focus(),
  },
  {
    name: "A Tooltip around a Combobox with its list closed",
    trigger: (dialog) => dialog.getByRole("group", { name: "City" }),
    // Focus opens the list, so a pick closes it again and leaves focus, and the hint, on the field.
    focus: async (dialog) => {
      const control = dialog.getByRole("combobox", { name: "City" })
      await control.focus()
      await control.press("ArrowDown")
      await control.press("Enter")
      await control.and(dialog.page().locator(`[aria-expanded="false"]`)).waitFor()
    },
  },
]

/**
 * The first Escape on a shown hint hides it and the dialog stays open; the second, with the hint
 * gone, closes the dialog.
 */
function focusedHintSpecs(): Spec[] {
  return focusedHints.map((target) => ({
    name: `${target.name} inside a Modal: the first Escape hides only the hint, ` +
      "the second closes the dialog",
    pageId: "ui",
    run: async (page: Page) => {
      const dialog = await openFormDialog(page)
      const trigger = target.trigger(dialog)
      await target.focus(dialog)
      await hintSurface(trigger, true).waitFor()

      await page.keyboard.press("Escape")
      await expectStillOpen(dialog, "the Escape that hid the hint")
      await hintSurface(trigger, false).waitFor({ state: "attached" })

      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "detached" })
    },
  }))
}

/**
 * A hint held only by the pointer, with focus on another control, does not claim the press: the
 * Escape belongs to the focused control, and here it closes the dialog.
 */
const pointerOnlyHintSpec: Spec = {
  name: "A hovered Tooltip inside a Modal, with focus elsewhere, lets Escape close the dialog",
  pageId: "ui",
  run: async (page: Page) => {
    const dialog = await openFormDialog(page)
    await dialog.locator(`button[data-e2e="guide-modal-form-dates"]`).focus()
    const trigger = dialog.getByRole("button", { name: "About Escape" })
    await trigger.hover()
    await hintSurface(trigger, true).waitFor()

    await page.keyboard.press("Escape")
    await dialog.waitFor({ state: "detached" })
  },
}

export const specs: readonly Spec[] = [
  ...escapeInsideModalSpecs(),
  ...focusedHintSpecs(),
  pointerOnlyHintSpec,
]
