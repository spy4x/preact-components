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
  },
  {
    name: "TagInput",
    popup: "suggestion list",
    control: (dialog) => dialog.getByRole("combobox", { name: "Tags" }),
    open: async (control) => {
      await control.focus()
      await control.press("ArrowDown")
    },
  },
  {
    name: "DateRangePicker",
    popup: "panel",
    control: (dialog) => dialog.locator(`button[data-e2e="guide-modal-form-dates"]`),
    // A click, as a person opens it; the picker then moves focus into its panel.
    open: (control) => control.click(),
  },
]

/**
 * Inside a `Modal`, the first Escape closes only the field's popup and the dialog with its form
 * stays open; the second Escape closes the dialog. One spec per field of the Modal card's form
 * dialog, each pressing the real key.
 */
function escapeInsideModalSpecs(): Spec[] {
  return popupFields.map((field) => ({
    name: `${field.name} inside a Modal: the first Escape closes only its ${field.popup}, ` +
      "the second closes the dialog",
    pageId: "ui",
    run: async (page: Page) => {
      await page.locator(`#demo-Modal [data-e2e="modal-form-open"]`).click()
      const dialog = page.locator(`dialog[data-e2e="guide-modal-form"]`)
      await dialog.waitFor()
      const control = field.control(dialog)
      await field.open(control)
      await control.and(page.locator(`[aria-expanded="true"]`)).waitFor()

      await page.keyboard.press("Escape")
      await control.and(page.locator(`[aria-expanded="false"]`)).waitFor()
      if (!await dialog.evaluate((element) => element.matches(":modal"))) {
        throw new Error(`the first Escape closed the dialog along with the ${field.popup}`)
      }

      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "detached" })
    },
  }))
}

export const specs: readonly Spec[] = [
  ...escapeInsideModalSpecs(),
]
