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
  ...quickAddSpecs(),
  ...removalSpecs(),
]

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
