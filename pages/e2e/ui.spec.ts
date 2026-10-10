/** Playwright specs for `ui/` components, on the guide's UI page. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "./runner.ts"

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
    // By hook, not by name: the dialog's corner button is named "Stay" as well.
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
]

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
