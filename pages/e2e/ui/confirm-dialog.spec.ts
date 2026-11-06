import { AxeBuilder } from "@axe-core/playwright"
import type { Locator } from "playwright-core"
import type { Spec } from "../runner.ts"
import { unsavedGuardWithAChange } from "./shared.ts"

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
  ...confirmDialogNameSpecs(),
]
