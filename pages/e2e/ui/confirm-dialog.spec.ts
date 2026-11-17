import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
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

/**
 * Opens the guide's three-way dialog, "Stop the sync?", and checks it with axe-core.
 *
 * @param page The guide page.
 * @returns The open dialog.
 */
async function openThreeWay(page: Page): Promise<Locator> {
  const dialog = page.getByRole("alertdialog", { name: "Stop the sync?" })
  await page.locator("#demo-ConfirmDialog").getByRole("button", { name: "Stop sync" }).click()
  await dialog.waitFor()
  const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze()
  if (violations.length > 0) {
    throw new Error(`axe on the open dialog: ${violations.map(({ id }) => id).join(", ")}`)
  }
  return dialog
}

/** `ConfirmDialog`'s optional second action: order, names, busy state and a phone's width. */
function confirmDialogSecondActionSpecs(): Spec[] {
  return [
    {
      name:
        "ConfirmDialog: a second action sits between cancel and confirm, and while it is busy the dialog cannot be cancelled",
      pageId: "ui",
      run: async (page) => {
        const dialog = await openThreeWay(page)
        await buttonsAreNamed(dialog, ["Close", "Keep syncing", "Stop now", "Finish and stop"])
        const order = await dialog.locator("footer button").evaluateAll((buttons) =>
          buttons.map((button) => button.textContent?.trim())
        )
        if (order.join(" | ") !== "Keep syncing | Stop now | Finish and stop") {
          throw new Error(`footer order: ${order.join(" | ")}`)
        }

        await dialog.getByRole("button", { name: "Stop now" }).click()
        const stopping = dialog.locator('[data-e2e="confirm-dialog-secondary"]')
        await stopping.and(page.locator('[aria-busy="true"]')).waitFor()
        await page.keyboard.press("Escape")
        const state = await dialog.evaluate((element) => ({
          open: (element as HTMLDialogElement).open,
          cancel: element.querySelector<HTMLButtonElement>('[data-e2e="confirm-dialog-cancel"]')
            ?.disabled,
          confirm: element.querySelector<HTMLButtonElement>('[data-e2e="confirm-dialog-confirm"]')
            ?.disabled,
          confirmBusy: element.querySelector('[data-e2e="confirm-dialog-confirm"]')
            ?.getAttribute("aria-busy"),
        }))
        if (!state.open || !state.cancel || !state.confirm || state.confirmBusy !== null) {
          throw new Error(`while Stop now is busy: ${JSON.stringify(state)}`)
        }
        await dialog.waitFor({ state: "detached", timeout: 5_000 })
        await page.locator("#demo-ConfirmDialog")
          .getByText("Outcome: stopped at once", { exact: true }).waitFor()
      },
    },
    {
      name:
        "ConfirmDialog: at 390 px the three-button dialog fits, every button inside it and none overflowing",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const dialog = await openThreeWay(page)
        const fit = await dialog.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const outside = [...element.querySelectorAll("button")].filter((button) => {
            const r = button.getBoundingClientRect()
            return r.left < box.left || r.right > box.right || r.top < box.top ||
              r.bottom > box.bottom
          }).map((button) => button.textContent?.trim() || button.getAttribute("aria-label"))
          const onScreen = box.left >= 0 && box.right <= innerWidth
          return { scroll: element.scrollWidth, client: element.clientWidth, outside, onScreen }
        })
        if (fit.scroll > fit.client || fit.outside.length > 0 || !fit.onScreen) {
          throw new Error(`overflow at 390 px: ${JSON.stringify(fit)}`)
        }
        return `dialog ${fit.client} px wide, no button outside it`
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...confirmDialogNameSpecs(),
  ...confirmDialogSecondActionSpecs(),
]
