import {
  centreInView,
  check,
  type Devtools,
  openGuidePage,
  poll,
  pressKey,
  settledScroll,
} from "./harness.ts"

/** One side of a dropdown's open/closed state. */
interface State {
  expanded: string | null
  hidden: boolean
}

/** Where focus is, relative to the dropdown that is being driven. */
interface Focus {
  /** `true` when `document.activeElement` is the trigger itself. */
  onTrigger: boolean
  /** `true` when the focused element is inside the panel. */
  inPanel: boolean
  /** `true` when the focused element is outside the whole component. */
  outside: boolean
  /** The focused element's text, trimmed and cut short, for the failure message. */
  label: string
}

/** The trigger, the panel and where focus sits, read in one round trip. */
interface DropdownState extends State, Focus {}

/**
 * Read the dropdown's open state and where focus is, both in one go.
 *
 * Written as an expression rather than a helper in the page, because every check below needs the
 * same pair and a transition is only worth asserting when both halves come from the same instant.
 */
const DROPDOWN_STATE = `(() => {
  const { trigger, panel, root } = globalThis.__verifyDropdown
  const active = document.activeElement
  return {
    expanded: trigger.getAttribute("aria-expanded"),
    hidden: panel.classList.contains("hidden"),
    onTrigger: active === trigger,
    inPanel: panel.contains(active),
    outside: !root.contains(active),
    label: (active === document.body ? "the page" : (active?.textContent ?? "")).trim().slice(0, 40),
  }
})()`

/**
 * `ui/`'s browser checks: Dropdown's pointer and keyboard contract, ToggleSwitch, OnOffButtons,
 * `Field`, Tooltip, Combobox, Toastr, DateRangePicker's focus contract in both its day-only and
 * `withTime` modes, Pagination's end controls, DataTable's sort-by-header and paging contract,
 * `ImageGallery`'s thumbnail strip and the shared `Lightbox` it opens, `FileInput`'s keyboard,
 * drag-and-drop, refusal, preview-revocation and plain-form-post contract, and — last — Modal's
 * keyboard and focus contract.
 *
 * This file runs last of every package's, and Modal's checks run last inside it, for the same
 * reason: Modal opens a real modal dialog, and a dialog that refused to close would sit in the top
 * layer above every check that ran after it. `imageGalleryChecks` opens one too and closes it again
 * unconditionally in its own teardown before this function returns, for the same reason, since
 * `Lightbox`'s checks cannot themselves run last — Modal's have to. See `PACKAGE_BLOCKS` in
 * `pages/verify.ts` for where the run order across every package is fixed.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function uiChecks(devtools: Devtools): Promise<void> {
  await dropdownChecks(devtools)

  const switches = await devtools.evaluate<{ count: number; before: string; after: string }>(
    `(async () => {
      const card = document.querySelector("#demo-ToggleSwitch")
      const switches = [...card.querySelectorAll('button[role="switch"]')]
      const before = switches[0].getAttribute("aria-checked")
      switches[0].click()
      await new Promise((done) => setTimeout(done, 50))
      return { count: switches.length, before, after: switches[0].getAttribute("aria-checked") }
    })()`,
  )
  check(
    "ToggleSwitch toggles its controlled value",
    switches.before !== switches.after,
    `${switches.before} → ${switches.after} across ${switches.count} switches`,
  )

  const segmented = await devtools.evaluate<{ before: string; after: string }>(
    `(async () => {
      const card = document.querySelector("#demo-OnOffButtons")
      const off = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("OFF"))
      const before = off.className
      off.click()
      await new Promise((done) => setTimeout(done, 50))
      return { before, after: off.className }
    })()`,
  )
  check("OnOffButtons switches the selected half", segmented.before !== segmented.after)

  // The `Fields` section's primitives: what `Field` wires is exactly what the browser makes
  // observable — the label's `for`, the control's `id`, and the ids of the messages the control
  // describes itself by, including the one it stops describing itself by once the error clears.
  const fields = await devtools.evaluate<{
    echoBefore: string
    echoAfter: string
    controlId: string
    labelFor: string
    beforeInvalid: string | null
    beforeDescribedBy: string
    afterInvalid: string | null
    afterDescribedBy: string
    errorText: string
  }>(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 30))
    const echo = () =>
      document.querySelector('#demo-Field [data-e2e="controlled-value"]').textContent.trim()
    const email = document.querySelector("#demo-Field input[type=email]")
    const read = () => ({
      invalid: email.getAttribute("aria-invalid"),
      describedBy: email.getAttribute("aria-describedby") ?? "",
    })

    const echoBefore = echo()
    const before = read()
    email.value = "ada@example.com"
    email.dispatchEvent(new Event("input", { bubbles: true }))
    await settle()

    return {
      echoBefore,
      echoAfter: echo(),
      controlId: email.id,
      labelFor: document.querySelector("#demo-Field label[for='guide-email']")?.getAttribute("for") ?? "",
      beforeInvalid: before.invalid,
      beforeDescribedBy: before.describedBy,
      afterInvalid: read().invalid,
      afterDescribedBy: read().describedBy,
      errorText: document.querySelector("#guide-email-error")?.textContent ?? "",
    }
  })()`)
  check(
    "typing into a `Field`'s control drives the demo's controlled value",
    fields.echoBefore !== fields.echoAfter && fields.echoAfter.includes("ada@example.com"),
    fields.echoAfter,
  )
  check(
    "`Field` wires the label's `for` to the control's `id`",
    fields.controlId === "guide-email" && fields.labelFor === "guide-email",
    `for="${fields.labelFor}" id="${fields.controlId}"`,
  )
  check(
    "`Field` describes the control by its error and its hint, and drops the error once it clears",
    fields.beforeInvalid === "true" &&
      fields.beforeDescribedBy === "guide-email-error guide-email-hint" &&
      fields.afterInvalid === null && fields.afterDescribedBy === "guide-email-hint" &&
      fields.errorText === "",
    `invalid=${fields.beforeInvalid} "${fields.beforeDescribedBy}" → ` +
      `invalid=${fields.afterInvalid} "${fields.afterDescribedBy}"`,
  )

  await refForwardingChecks(devtools)

  await installBoxChecks(devtools)

  await tooltipChecks(devtools)
  await comboboxChecks(devtools)
  await toastrChecks(devtools)
  await dateRangeChecks(devtools)
  await dateRangeTimeChecks(devtools)
  await paginationChecks(devtools)
  await dataTableChecks(devtools)
  await enhancedFormAsyncFailureCheck(devtools)
  await enhancedFormSynchronousThrowCheck(devtools)
  await enhancedFormResultChecks(devtools)
  await signUpFormDoubleClickCheck(devtools)
  await signUpFormRequestSubmitGuardCheck(devtools)
  await signUpFormFocusElsewhereCheck(devtools)
  await signUpFormBlurWhileSendingCheck(devtools)
  await enhancedFormsHoneypotChecks(devtools)
  await contactFormHoneypotCheck(devtools)
  await contactFormStaleSubmitCheck(devtools)
  await enhancedFormBackForwardCacheCheck(devtools)
  await contactFormFailureRetryChecks(devtools)
  await enhancedFormsNoScriptChecks(devtools)
  await imageGalleryChecks(devtools)
  await lightboxRefusesEmptyCheck(devtools)
  await moneyInputChecks(devtools)
  await moneyInputPreHydrationChecks(devtools)
  await fileInputChecks(devtools)

  // Last on purpose: a Modal that refuses to close would sit in the top layer over everything, so a
  // failure here cannot take an unrelated check down with it.
  await modalChecks(devtools)
}

/** One component whose card carries a ref-forwarding demo, and the card that holds it. */
const REF_FORWARDING_CARDS = [
  ["Input", "#demo-Input"],
  ["Button", "#demo-Button"],
  ["Checkbox", "#demo-Checkbox"],
  ["Radio", "#demo-Radio"],
] as const

/**
 * `Input`, `Button`, `Checkbox` and `Radio` forward the `ref` they are given to the native element
 * they render, instead of it landing on the component and going nowhere.
 *
 * Preact strips `ref` off a function component's props and applies it to the component instance,
 * so a plain wrapper function makes `<Input ref={box} />` type-check and throw at `box.current
 * .focus()` time — the component instance has no `.focus` method. No unit test can see this: the
 * unit tests render to a string, which never attaches a ref or calls a method on one.
 *
 * Each of the four cards this drives (`ui-guide/sections/fields.tsx`'s `InputDemo`, `CheckboxDemo`
 * and `RadioDemo`, and `ui-guide/sections/buttons.tsx`'s `ButtonClickDemo`) holds a ref to one of
 * its own native elements, marked `[data-e2e="ref-target"]`, and a "Focus via ref" button, marked
 * `[data-e2e="ref-focus"]`, whose `onClick` calls `.focus()` through that ref — the same thing a
 * form does to move focus to its first invalid field, which is what the ref exists for. Each check
 * is a transition: the target does not have focus before the trigger is clicked, and does
 * afterwards, so a target that already happened to hold focus could not pass by accident.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function refForwardingChecks(devtools: Devtools): Promise<void> {
  for (const [name, card] of REF_FORWARDING_CARDS) {
    const target = `${card} [data-e2e="ref-target"]`
    const trigger = `${card} [data-e2e="ref-focus"]`

    const before = await devtools.evaluate<{ found: boolean; onTarget: boolean }>(`(() => {
      return {
        found: document.querySelector('${trigger}') !== null,
        onTarget: document.activeElement === document.querySelector('${target}'),
      }
    })()`)
    // `?.click()`, not `.click()`: a renamed or missing trigger has to fail this one named check,
    // not throw a page exception that would end the rest of this file's checks along with it.
    await devtools.evaluate<null>(`(document.querySelector('${trigger}')?.click(), null)`)
    const after = await devtools.evaluate<{ onTarget: boolean; label: string }>(`(() => {
      const active = document.activeElement
      return {
        onTarget: active === document.querySelector('${target}'),
        label: active === document.body ? "the page" : (active?.tagName ?? "nothing"),
      }
    })()`)

    check(
      `${name} forwards its ref to the native element, so "Focus via ref" can focus it`,
      before.found && !before.onTarget && after.onTarget,
      !before.found
        ? `the ${card} card has no [data-e2e="ref-focus"] trigger to click`
        : before.onTarget
        ? "the target already had focus before the trigger was clicked, so this proves nothing"
        : after.onTarget
        ? "clicking the trigger moved focus onto the native element through the ref"
        : `clicking the trigger left focus on ${after.label} instead of the target`,
    )
  }
}

/** The checkmark path {@link CopyButton} swaps in for its own glyph while `copied` is true. */
const COPY_BUTTON_CHECKMARK = "m5 13 4 4L19 7"

/**
 * `InstallBox` copies its command on a real click and on a real Enter press.
 *
 * Both are behind `ui/copy-button.tsx`'s click handler and its own `copied`-state timer, neither
 * reachable from a string render. The icon swap (the button's own SVG `d` attribute flipping to
 * {@link COPY_BUTTON_CHECKMARK}) proves the button reacted, but not what reached the clipboard — an
 * earlier version of this check stopped there, so `textToCopy=""` would still have swapped the icon
 * and passed. `navigator.clipboard.writeText` is patched in the page for that reason, the same way
 * `pages/checks/ui-guide.ts`'s copy-block check does it: every write is recorded, reset before each
 * half of this check, and required to equal the box's own `<code>` text — not the "Usage" snippet's
 * `<pre><code>`, a second `<code>` the same card carries for the JSX source, which is why the
 * button's own container is queried rather than the card as a whole. `CopyButton` itself has no
 * check of its own anywhere in this file; `InstallBox` is what first puts a real trigger for it in
 * the catalogue.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function installBoxChecks(devtools: Devtools): Promise<void> {
  await centreInView(devtools, `document.querySelector('#demo-InstallBox')`)

  await devtools.evaluate<null>(`(() => {
    const writeText = (text) => {
      globalThis.__installBoxCopied = text
      return Promise.resolve()
    }
    try {
      navigator.clipboard.writeText = writeText
    } catch {
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    }
    return null
  })()`)

  const iconPath = () =>
    `(document.querySelector('#demo-InstallBox button[aria-label="Copy command"] svg path')` +
    `?.getAttribute("d") ?? null)`
  const commandText = () =>
    `(document.querySelector('#demo-InstallBox button[aria-label="Copy command"]')` +
    `?.parentElement.querySelector("code")?.textContent ?? null)`

  const beforeClick = await devtools.evaluate<string | null>(iconPath())
  const spot = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const button = document.querySelector('#demo-InstallBox button[aria-label="Copy command"]')
    if (!button) return null
    const box = button.getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })()`)

  await devtools.evaluate<null>(`(globalThis.__installBoxCopied = undefined, null)`)
  if (spot !== null) {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await devtools.send("Input.dispatchMouseEvent", {
        type,
        x: spot.x,
        y: spot.y,
        button: "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: 1,
      })
    }
  }
  await poll(
    async () => (await devtools.evaluate<string | null>(iconPath())) === COPY_BUTTON_CHECKMARK,
    2_000,
  )
  const afterClick = await devtools.evaluate<string | null>(iconPath())
  const command = await devtools.evaluate<string | null>(commandText())
  const clickCopied = await devtools.evaluate<string | undefined>(`globalThis.__installBoxCopied`)

  check(
    "a real click on InstallBox's copy control swaps its icon to the checkmark and copies its command",
    spot !== null && beforeClick !== COPY_BUTTON_CHECKMARK &&
      afterClick === COPY_BUTTON_CHECKMARK &&
      clickCopied === command,
    spot === null
      ? 'the InstallBox card has no [aria-label="Copy command"] control to click'
      : beforeClick === COPY_BUTTON_CHECKMARK
      ? "the icon was already the checkmark before anything was clicked, so this proves nothing"
      : `clicked at (${spot.x}, ${spot.y}): icon path ${JSON.stringify(beforeClick)} → ` +
        `${JSON.stringify(afterClick)}, clipboard ${JSON.stringify(clickCopied)} vs command ` +
        `${JSON.stringify(command)}`,
  )

  // Wait for the confirmation timer (1500ms default) to clear before pressing Enter, so the second
  // half of this check starts from the same rest state as the first.
  await poll(
    async () => (await devtools.evaluate<string | null>(iconPath())) !== COPY_BUTTON_CHECKMARK,
    3_000,
  )

  await devtools.evaluate<null>(
    `(document.querySelector('#demo-InstallBox button[aria-label="Copy command"]')?.focus(), null)`,
  )
  const focused = await devtools.evaluate<boolean>(
    `document.activeElement === document.querySelector('#demo-InstallBox button[aria-label="Copy command"]')`,
  )
  const beforeEnter = await devtools.evaluate<string | null>(iconPath())
  await devtools.evaluate<null>(`(globalThis.__installBoxCopied = undefined, null)`)
  await pressKey(devtools, "Enter")
  await poll(
    async () => (await devtools.evaluate<string | null>(iconPath())) === COPY_BUTTON_CHECKMARK,
    2_000,
  )
  const afterEnter = await devtools.evaluate<string | null>(iconPath())
  const enterCopied = await devtools.evaluate<string | undefined>(`globalThis.__installBoxCopied`)

  check(
    "a real Enter press on the focused copy control also swaps its icon to the checkmark and copies its command",
    focused && beforeEnter !== COPY_BUTTON_CHECKMARK && afterEnter === COPY_BUTTON_CHECKMARK &&
      enterCopied === command,
    !focused
      ? "the copy control never took focus, so a key press here proves nothing"
      : beforeEnter === COPY_BUTTON_CHECKMARK
      ? "the icon was already the checkmark before Enter was pressed, so this proves nothing"
      : `focused, then a real Enter press: icon path ${JSON.stringify(beforeEnter)} → ` +
        `${JSON.stringify(afterEnter)}, clipboard ${JSON.stringify(enterCopied)} vs command ` +
        `${JSON.stringify(command)}`,
  )

  await devtools.evaluate<null>(
    `(document.querySelector('#demo-InstallBox button[aria-label="Copy command"]')?.blur(), null)`,
  )
}

/**
 * Dropdown's pointer, keyboard and focus contract, driven in the browser that owns it.
 *
 * Everything here is behind an effect, a ref or a listener, so no string-rendering test can reach
 * any of it: opening moves focus into the menu, the arrow keys with Home and End walk the items,
 * a real Escape press closes the menu and hands the trigger its focus back, Tab out closes it
 * behind the user, activating an item closes it too, and a click that misses an item does not.
 *
 * Two habits the Modal checks below set, and for the same reasons. The trigger, panel and root are
 * parked on `globalThis` rather than re-queried, so every focus assertion compares element identity
 * — a selector would also match a freshly rendered element that never had focus. And every
 * assertion is a transition, a before and an after: "the menu is closed" and "focus is on the
 * trigger" are both true of a menu that never opened, which is precisely the state a broken
 * opening step leaves behind.
 *
 * Every key is a real press through `Input.dispatchKeyEvent`, and the stray click is a real
 * press-and-release through `Input.dispatchMouseEvent` at viewport coordinates.
 *
 * `.click()` remains in two places on purpose, each asserting the click path itself rather than
 * standing in for a keyboard one: the open-and-close check below is named for what it drives, and
 * the pointer half of item activation is paired with a keyboard half — the Space check further
 * down — that already covers the keyboard path for the same control. Everywhere else that used to
 * reach for `.click()` because a real Enter press did not activate a focused button in this
 * browser — the focus-move check, and {@link reopen}, which every check after it depends on — now
 * presses Enter for real: `#261` found the missing `text` field on `pressKey`'s `keyDown` was the
 * whole reason Enter did not work, not the browser.
 *
 * **Space still gets its own check.** A real Space press through the same helper activates a
 * focused menu item: the menu closes and focus goes back to the trigger, which is what the Space
 * check below asserts. Every other key this issue is about — Enter on the trigger, the arrows with
 * Home and End, Escape and Tab — is proven by a real press too.
 *
 * The card holds four dropdowns; this drives the first, the icon trigger named "Row actions" over
 * three items. Its two link items point at this page's own `#inputs` route, so nothing here
 * activates one: the item that gets clicked is the third, a button.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dropdownChecks(devtools: Devtools): Promise<void> {
  const clicked = await devtools.evaluate<{ before: State; open: State; closed: State }>(
    `(async () => {
      const card = document.querySelector("#demo-Dropdown")
      const trigger = card.querySelector("button[aria-expanded]")
      const panel = card.querySelector('[role="menu"]')
      globalThis.__verifyDropdown = { trigger, panel, root: trigger.parentElement }
      const state = () => ({
        expanded: trigger.getAttribute("aria-expanded"),
        hidden: panel.classList.contains("hidden"),
      })
      const settle = () => new Promise((done) => setTimeout(done, 50))
      const before = state()
      trigger.click()
      await settle()
      const open = state()
      trigger.click()
      await settle()
      return { before, open, closed: state() }
    })()`,
  )
  check(
    "Dropdown opens and closes on click",
    clicked.before.expanded === "false" && clicked.open.expanded === "true" &&
      clicked.open.hidden === false && clicked.closed.hidden === true,
    `aria-expanded ${clicked.before.expanded} → ${clicked.open.expanded} → ${clicked.closed.expanded}`,
  )

  const shape = await devtools.evaluate<{
    triggerName: string | null
    triggerText: string
    labels: string[]
    interactive: number
    outOfTabOrder: number
  }>(`(() => {
    const { trigger, panel } = globalThis.__verifyDropdown
    const items = [...panel.querySelectorAll('[role="menuitem"]')]
    return {
      triggerName: trigger.getAttribute("aria-label"),
      triggerText: trigger.textContent.trim(),
      labels: items.map((item) => item.textContent.trim()),
      interactive: panel.querySelectorAll("a, button").length,
      outOfTabOrder: items.filter((item) => item.getAttribute("tabindex") === "-1").length,
    }
  })()`)
  // The trigger renders an icon and no text, so the only thing a screen reader can read out is the
  // name the caller was made to supply. Counting the menu items against every interactive element
  // in the panel is what catches the original defect: three children, none of them a menu item.
  check(
    "Dropdown names its icon trigger and marks every panel item as a menu item",
    shape.triggerName !== null && shape.triggerName.length > 0 && shape.triggerText === "" &&
      shape.labels.length === shape.interactive && shape.interactive > 0 &&
      shape.outOfTabOrder === shape.labels.length,
    `aria-label="${shape.triggerName}" over no text, ${shape.labels.length} of ` +
      `${shape.interactive} interactive children are menu items, all out of the tab order`,
  )

  const beforeEnterOpen = await devtools.evaluate<DropdownState>(
    `(globalThis.__verifyDropdown.trigger.focus(), ${DROPDOWN_STATE})`,
  )
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.inPanel === true`), 3_000)
  const openedByEnter = await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
  // A real Enter press on a native `<button>`, not `.click()`: proves both that Dropdown's trigger
  // opens on Enter and, as a side effect anywhere else in this repository needs it, that
  // `pressKey(devtools, "Enter")` genuinely activates a focused native button (#261) — breaking that
  // by dropping `text` from `KEYS.Enter` in `harness.ts` turns this check red.
  check(
    "a real Enter press activates Dropdown's trigger, opening the menu and moving focus to its " +
      "first item",
    beforeEnterOpen.onTrigger && beforeEnterOpen.expanded === "false" &&
      openedByEnter.expanded === "true" && openedByEnter.inPanel &&
      openedByEnter.label === shape.labels[0],
    `focus ${beforeEnterOpen.onTrigger ? "on the trigger" : beforeEnterOpen.label} → ` +
      `"${openedByEnter.label}", aria-expanded ${beforeEnterOpen.expanded} → ` +
      openedByEnter.expanded,
  )

  // Three items, so this walk visits both ends and crosses the middle: down, down, up, End, Home.
  // A menu that ignores the keys answers with the first item five times over, which is why the
  // whole sequence is compared rather than its last step.
  const walk: string[] = []
  for (const key of ["ArrowDown", "ArrowDown", "ArrowUp", "End", "Home"] as const) {
    await pressKey(devtools, key)
    walk.push(await devtools.evaluate<string>(`${DROPDOWN_STATE}.label`))
  }
  const [first, second, third] = shape.labels
  const expected = [second, third, second, third, first]
  check(
    "Dropdown's arrow, Home and End keys move focus between its menu items",
    openedByEnter.inPanel && walk.join(" → ") === expected.join(" → "),
    openedByEnter.inPanel
      ? `from "${first}": ${walk.join(" → ")} (expected ${expected.join(" → ")})`
      : "focus was never in the menu, so the keys prove nothing",
  )

  const beforeEscape = await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
  await pressKey(devtools, "Escape")
  const closedByEscape = await poll(
    () => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.hidden === true`),
    3_000,
  )
  const afterEscape = await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
  check(
    "a real Escape key press closes the Dropdown",
    beforeEscape.expanded === "true" && beforeEscape.inPanel && closedByEscape,
    beforeEscape.expanded !== "true"
      ? "the menu was never open, so this proves nothing about Escape"
      : !beforeEscape.inPanel
      ? "focus was never in the menu, so the key press never reached it"
      : closedByEscape
      ? "Input.dispatchKeyEvent Escape → the panel is hidden again"
      : "the panel was still open 3s after the key press",
  )
  check(
    "closing the Dropdown with Escape returns focus to the trigger",
    beforeEscape.inPanel && afterEscape.onTrigger,
    beforeEscape.inPanel
      ? `focus "${beforeEscape.label}" → ${
        afterEscape.onTrigger ? "the trigger" : `"${afterEscape.label}"`
      }`
      : "focus was never in the menu, so a return proves nothing",
  )

  const beforeTab = await reopen(devtools)
  await pressKey(devtools, "Tab")
  const closedByTab = await poll(
    () => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.hidden === true`),
    3_000,
  )
  const afterTab = await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
  // The items are out of the tab order, so one Tab press already takes focus out of the menu —
  // there is no last item to tab past. What is under test is that the menu does not stay open
  // behind the user, which is what the issue reported.
  check(
    "tabbing out of the Dropdown closes it behind you",
    beforeTab.expanded === "true" && beforeTab.inPanel && closedByTab && afterTab.outside,
    beforeTab.inPanel
      ? `focus "${beforeTab.label}" → "${afterTab.label}", aria-expanded ` +
        `${beforeTab.expanded} → ${afterTab.expanded}`
      : "focus was never in the menu, so tabbing out proves nothing",
  )

  const beforeActivate = await reopen(devtools)
  const afterActivate = await devtools.evaluate<DropdownState>(`(async () => {
    const items = [...globalThis.__verifyDropdown.panel.querySelectorAll('[role="menuitem"]')]
    // A menu with no items is a failure this check should report, not an exception that takes the
    // rest of this file's checks down with it.
    items[items.length - 1]?.click()
    await new Promise((done) => setTimeout(done, 80))
    return ${DROPDOWN_STATE}
  })()`)
  check(
    "clicking a Dropdown item closes the menu and returns focus to the trigger",
    beforeActivate.expanded === "true" && afterActivate.hidden && afterActivate.onTrigger,
    beforeActivate.expanded === "true"
      ? `clicked "${shape.labels[shape.labels.length - 1]}", aria-expanded ` +
        `${beforeActivate.expanded} → ${afterActivate.expanded}, focus on ` +
        (afterActivate.onTrigger ? "the trigger" : `"${afterActivate.label}"`)
      : "the menu was never open, so activating an item proves nothing",
  )

  // The keyboard half of item activation, alongside the pointer half above: a real Space press on a
  // focused menu item also produces the activation click, and closes the menu the same way.
  const beforeSpace = await reopen(devtools)
  await pressKey(devtools, "End")
  const onLastItem = await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
  await pressKey(devtools, "Space")
  const closedBySpace = await poll(
    () => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.hidden === true`),
    3_000,
  )
  const afterSpace = await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
  check(
    "a real Space press activates the focused Dropdown item and closes the menu",
    beforeSpace.expanded === "true" && onLastItem.inPanel && closedBySpace && afterSpace.onTrigger,
    !onLastItem.inPanel
      ? "focus was never on an item, so the key press proves nothing about activating one"
      : `End then Space on "${onLastItem.label}": aria-expanded ${beforeSpace.expanded} → ` +
        `${afterSpace.expanded}, focus on ` +
        (afterSpace.onTrigger ? "the trigger" : `"${afterSpace.label}"`),
  )

  await strayClickCheck(devtools)
  // The table below counts triggers on cards of three packages, so it is read on the guide's `all`
  // page, where every card is rendered.
  await openGuidePage(devtools, "all")
  await triggerNameCheck(devtools)
  await openGuidePage(devtools, "ui")
}

/** Where a real mouse press actually landed, recorded by the page as the browser dispatched it. */
interface Hit {
  /** `true` when the event's target is inside the panel. */
  insidePanel: boolean
  /** `true` when the target is inside a menu item. */
  onItem: boolean
  /** `true` when the target is anywhere inside the component. */
  insideRoot: boolean
  /** The target's tag name, for the message. */
  tag: string
  /** Where the browser says the press happened. */
  x: number
  y: number
}

/** The point to click, derived from the panel's geometry, with the derivation's own evidence. */
interface Spot {
  x: number
  y: number
  /** Height of the padding strip between the panel's top edge and the first item's. */
  strip: number
  /** `true` when the point is inside the viewport, where a dispatched click can reach it. */
  inViewport: boolean
  /** What `elementFromPoint` says is there, before the click. */
  insidePanel: boolean
  onItem: boolean
  tag: string
}

/**
 * A left click that misses an item leaves the menu open, with focus still on an item.
 *
 * This is the one check in the file driven with a real mouse event rather than `.click()`, and it
 * has to be: the whole point is that the click lands on something unfocusable — the panel's own
 * padding, the strip above the first item — so there is no element to call `.click()` on. The
 * browser reports that as a `focusout` whose `relatedTarget` is `null`, which is exactly what it
 * reports when focus leaves the page altogether. A menu that treats the two alike vanishes when a
 * person clicks a few pixels off the entry they wanted, and leaves their focus on `<body>`.
 *
 * Two things this check must never do, both learned from a review that caught it doing them. It
 * must not guess a coordinate: the point is derived from the panel's own top edge and the first
 * item's, so "the padding" is a measured strip rather than a hopeful two pixels, and the
 * derivation is asserted before it is used. And it must not report a click it did not land as a
 * broken menu: the page records the target of the real `mousedown` as the browser dispatches it,
 * so a press that arrived somewhere else says so in its own words. Both failures look identical
 * from the outside — the menu is shut and focus is on the page — and only one of them is this
 * component's fault.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function strayClickCheck(devtools: Devtools): Promise<void> {
  const before = await reopen(devtools)
  // Centre the panel rather than the trigger: the panel is what gets clicked, and the coordinates
  // are viewport pixels, so it has to be on screen and it has to have stopped moving.
  await centreInView(devtools, `globalThis.__verifyDropdown.panel`)

  const spot = await devtools.evaluate<Spot>(`(() => {
    const { panel } = globalThis.__verifyDropdown
    const item = panel.querySelector('[role="menuitem"]')
    const panelRect = panel.getBoundingClientRect()
    // Everything between the panel's own top edge and the first item's is padding by construction,
    // whatever the utilities happen to be, so the midpoint of that strip is the safest point in it.
    const strip = item === null ? 0 : item.getBoundingClientRect().top - panelRect.top
    const x = Math.round(panelRect.left + panelRect.width / 2)
    const y = Math.round(panelRect.top + strip / 2)
    const target = document.elementFromPoint(x, y)
    return {
      x,
      y,
      strip,
      inViewport: x >= 0 && y >= 0 && x < globalThis.innerWidth && y < globalThis.innerHeight,
      insidePanel: target !== null && panel.contains(target),
      onItem: target !== null && target.closest('[role="menuitem"]') !== null,
      tag: target === null ? "nothing" : target.tagName,
    }
  })()`)
  const derived = spot.strip >= 2 && spot.inViewport && spot.insidePanel && !spot.onItem

  // One-shot, capture phase, installed before the press: this is the browser's own answer to
  // "what did that click hit", which no later re-reading of the point can give once the menu has
  // closed and the panel stopped being displayed.
  await devtools.evaluate<null>(`(() => {
    const { panel, root } = globalThis.__verifyDropdown
    globalThis.__verifyStrayHit = null
    document.addEventListener("mousedown", (event) => {
      const target = event.target
      globalThis.__verifyStrayHit = {
        insidePanel: panel.contains(target),
        onItem: target !== null && target.closest('[role="menuitem"]') !== null,
        insideRoot: root.contains(target),
        tag: target === null ? "nothing" : target.tagName,
        x: event.clientX,
        y: event.clientY,
      }
    }, { capture: true, once: true })
    return null
  })()`)

  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: spot.x,
      y: spot.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    })
  }
  // The component answers this one tick late on purpose — it has to read where focus ended up —
  // so give it that tick before reading, rather than letting the result depend on the timing.
  await poll(() => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.inPanel === true`), 2_000)
  const after = await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
  const hit = await devtools.evaluate<Hit | null>(`globalThis.__verifyStrayHit ?? null`)
  const landed = hit !== null && hit.insidePanel && !hit.onItem

  check(
    "a click on the Dropdown's padding leaves the menu open with focus on its item",
    derived && landed && before.expanded === "true" && before.inPanel &&
      after.expanded === "true" && after.inPanel && after.label === before.label,
    !derived
      ? `no padding to click: a ${spot.strip}px strip at (${spot.x}, ${spot.y}) reading ` +
        `${spot.tag}${spot.inViewport ? "" : ", outside the viewport"} — this proves nothing`
      : hit === null
      ? `the press never reached the page, so this proves nothing about the menu`
      : !landed
      ? `the press landed on ${hit.tag} at (${hit.x}, ${hit.y}), ` +
        (hit.onItem
          ? "a menu item"
          : hit.insideRoot
          ? "inside the component but not the panel"
          : "outside the component") +
        `, not the ${spot.strip}px padding strip aimed at (${spot.x}, ${spot.y}) — a missed ` +
        `click, which proves nothing about the menu`
      : before.inPanel
      ? `pressed ${hit.tag} at (${hit.x}, ${hit.y}) in a ${spot.strip}px strip: aria-expanded ` +
        `${before.expanded} → ${after.expanded}, focus "${before.label}" → ` +
        (after.inPanel ? `"${after.label}"` : `${after.label}, outside the menu`)
      : "the menu was never open with focus inside, so a stray click proves nothing",
  )

  // Leave it closed for whatever runs next, the way every other check here does.
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.hidden === true`), 3_000)
}

/**
 * How many dropdown triggers each catalogue card renders.
 *
 * Written down rather than counted, and that is the point. The first version of the check below
 * compared one query of `button[aria-haspopup="menu"]` against another query of the same selector
 * over the same document, which cannot disagree: a review deleted a dropdown from the catalogue
 * and the check reported seven triggers, all named, and passed. A count is only worth asserting
 * against something that does not come from the thing being counted, so this is the catalogue's
 * own knowledge of what it renders — four anchorings on the `Dropdown` card, one row menu per row
 * of the `CrudList` demo.
 *
 * A card that gains or loses a dropdown turns the check red until this table is updated with it,
 * which is one line and is visible in review. That is the intended cost.
 */
const DROPDOWN_TRIGGERS_PER_CARD: Record<string, number> = {
  "demo-Dropdown": 4,
  "demo-CrudList": 3,
  "demo-Shell": 1,
}

/**
 * Every dropdown trigger the catalogue renders has an accessible name, as the browser computes it.
 *
 * `triggerLabel` and `triggerNamedByContent` make *omitting* a name a type error, but no type can
 * tell whether a caller's children render any text, so `triggerNamedByContent` on an icon-only
 * trigger compiles and produces a button a screen reader announces as just "button" — the defect
 * the issue opened with, reached through the prop meant to prevent it. This is where that can be
 * caught. The name is asked of Chromium through `Accessibility.getPartialAXTree` rather than
 * recomputed here, because re-implementing the naming algorithm inside the check would only prove
 * the check agrees with itself.
 *
 * `button[aria-haspopup="menu"]` is every `Dropdown` trigger in the document and nothing else —
 * that attribute appears in one component. The card ids come from a separate query in document
 * order, which is the order the protocol returns as well, so a failure names the card to open, and
 * the tally is compared against {@link DROPDOWN_TRIGGERS_PER_CARD} so that a catalogue which
 * quietly renders fewer is a failure rather than a smaller number.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function triggerNameCheck(devtools: Devtools): Promise<void> {
  const selector = `button[aria-haspopup="menu"]`
  await devtools.send("DOM.enable")
  await devtools.send("Accessibility.enable")

  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: 1,
  })
  const { nodeIds } = await devtools.send<{ nodeIds: number[] }>("DOM.querySelectorAll", {
    nodeId: root.nodeId,
    selector,
  })
  const cards = await devtools.evaluate<string[]>(
    `[...document.querySelectorAll('${selector}')]
      .map((trigger) => trigger.closest("[id^=demo-]")?.id ?? "outside any card")`,
  )

  const unnamed: string[] = []
  const named: string[] = []
  for (const [index, nodeId] of nodeIds.entries()) {
    const { nodes } = await devtools.send<{ nodes: Array<{ name?: { value?: string } }> }>(
      "Accessibility.getPartialAXTree",
      { nodeId, fetchRelatives: false },
    )
    const name = (nodes[0]?.name?.value ?? "").trim()
    const where = cards[index] ?? `trigger ${index + 1}`
    if (name === "") unnamed.push(where)
    else named.push(`${where}: "${name}"`)
  }

  const counted = new Map<string, number>()
  for (const card of cards) counted.set(card, (counted.get(card) ?? 0) + 1)
  const expected = Object.entries(DROPDOWN_TRIGGERS_PER_CARD)
  const expectedTotal = expected.reduce((total, [, count]) => total + count, 0)
  const miscounted = [
    ...expected
      .filter(([card, count]) => (counted.get(card) ?? 0) !== count)
      .map(([card, count]) => `${card}: expected ${count}, found ${counted.get(card) ?? 0}`),
    ...[...counted.keys()]
      .filter((card) => !(card in DROPDOWN_TRIGGERS_PER_CARD))
      .map((card) => `${card}: ${counted.get(card)} the expected set does not know about`),
  ]

  check(
    "every Dropdown trigger in the catalogue has an accessible name",
    miscounted.length === 0 && nodeIds.length === expectedTotal &&
      nodeIds.length === cards.length && unnamed.length === 0,
    miscounted.length > 0 || nodeIds.length !== expectedTotal
      ? `the catalogue renders ${nodeIds.length} dropdown triggers, not the ${expectedTotal} it ` +
        `should — ${miscounted.join("; ")}`
      : unnamed.length > 0
      ? `${unnamed.length} of ${nodeIds.length} announce as an unnamed button: ${
        unnamed.join(", ")
      }`
      : `all ${nodeIds.length} expected triggers named by Chromium — ${named.join(", ")}`,
  )
}

/**
 * Open the parked dropdown again and wait until focus has landed inside it.
 *
 * Every check that follows the first one needs the same starting point, and it has to be waited
 * for rather than assumed: the component moves focus from an effect, one render after the click.
 *
 * @param devtools The connected session.
 * @returns The state at the moment the menu was open with focus inside — the "before" half of the
 * transition the caller is about to assert. A menu that failed to open returns that failure, and
 * the caller's check says so rather than passing quietly.
 */
async function reopen(devtools: Devtools): Promise<DropdownState> {
  await devtools.evaluate<null>(`(globalThis.__verifyDropdown.trigger.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.inPanel === true`), 3_000)

  return await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
}

/** What one read of the Toastr card's live area sees. */
interface ToastrState {
  /** `true` when the parked live area is still in the document. */
  present: boolean
  /** `true` when the parked element is still the one the card renders — identity, not a selector. */
  same: boolean
  live: string | null
  role: string | null
  name: string | null
  /** Toasts in the stack, or `-1` when there is no live area to count them in. */
  toasts: number
  /** The stack's own box, rounded, or `-1` when there is none. */
  height: number
  width: number
  /** The stack's text, cut short, for the failure message. */
  text: string
}

/** The outcome of clearing the stack and pushing the one toast that dismisses itself. */
interface Pushed {
  ok: boolean
  /** What was missing from the card, when `ok` is false. */
  reason: string
  /** The duration the card pushed, read off its own button rather than written down here. */
  duration: number
  toasts: number
}

/** How long a condition went on holding in the page, and whether it reached the end of a window. */
interface Hold {
  held: boolean
  elapsedMs: number
  /** `true` when the page stopped answering, which is the harness failing rather than the page. */
  unreadable?: boolean
}

/** A toast that was allowed to run for part of its life, and what was done to it then. */
interface Ran {
  ok: boolean
  /** What was missing from the card, when `ok` is false. */
  reason: string
  /** The duration the card pushed, read off its own button. */
  duration: number
  /** Milliseconds from the push to the moment the action ran, timed in the page. */
  elapsed: number
  /** `true` when the toast was still on screen when the action ran. */
  present: boolean
  /** `true` when the action did what it set out to do. */
  done: boolean
  /** What the action has to say for itself, for the message. */
  note: string
}

/** Where a dispatched pointer move actually landed, as the page saw the browser deliver it. */
interface Hover {
  insideRegion: boolean
  tag: string
  x: number
  y: number
}

/** A point to move the pointer to, with the reading that says what is there. */
interface Point {
  x: number
  y: number
  inViewport: boolean
  insideRegion: boolean
  tag: string
}

/**
 * Park the Toastr card, its live area and its four demo controls on `globalThis`.
 *
 * Run before anything is pushed, which is the whole point: the live area has to be found in a page
 * that has never shown a toast. A component that renders nothing for an empty stack parks `null`
 * here, and every check below reports that rather than throwing.
 */
const TOASTR_SETUP = `(() => {
  const card = document.querySelector("#demo-Toastr")
  globalThis.__verifyToastr = {
    card,
    region: card?.querySelector('[data-e2e="guide-toastr"]') ?? null,
    auto: card?.querySelector('[data-e2e="toast-auto"]') ?? null,
    long: card?.querySelector('[data-e2e="toast-long"]') ?? null,
    extend: card?.querySelector('[data-e2e="toast-extend"]') ?? null,
    clear: card?.querySelector('[data-e2e="toast-clear"]') ?? null,
    success: card?.querySelector('[data-e2e="toast-success"]') ?? null,
    count: card?.querySelector('[data-e2e="toast-store-count"]') ?? null,
    fallback: card?.querySelector('[data-e2e="toast-default-duration"]') ?? null,
  }
  return null
})()`

/**
 * What the store says it is holding and what the live area shows, read together.
 *
 * The two numbers are the point. The card prints the store's own `list.length`, so a component
 * that took a toast off the screen without telling the store, or a store that dropped one the
 * screen still shows, reads as a disagreement here rather than as two checks that each pass.
 */
const TOASTR_STORE_AND_DOM = `(() => {
  const parked = globalThis.__verifyToastr ?? {}
  const region = parked.region ?? null
  const count = parked.count ?? null
  if (region === null || count === null) {
    return {
      ok: false,
      reason: "the Toastr card is missing " +
        (region === null ? "its live area" : 'its store readout (data-e2e="toast-store-count")'),
      store: -1,
      dom: -1,
      text: "",
    }
  }
  return {
    ok: true,
    reason: "",
    store: Number((count.textContent ?? "").trim()),
    dom: region.children.length,
    text: (region.textContent ?? "").trim().slice(0, 120),
  }
})()`

/**
 * The live area's markings, its contents and its box, read in one round trip.
 *
 * `same` compares the parked element with the one the card renders *now*, by identity. A selector
 * on its own cannot tell an area that was always there from one the first toast brought with it,
 * and that difference is the entire fix.
 */
const TOASTR_STATE = `(() => {
  const region = globalThis.__verifyToastr?.region ?? null
  if (region === null) {
    return {
      present: false, same: false, live: null, role: null, name: null,
      toasts: -1, height: -1, width: -1, text: "",
    }
  }
  const box = region.getBoundingClientRect()
  return {
    present: region.isConnected,
    same: region === document.querySelector('#demo-Toastr [data-e2e="guide-toastr"]'),
    live: region.getAttribute("aria-live"),
    role: region.getAttribute("role"),
    name: region.getAttribute("aria-label"),
    toasts: region.children.length,
    height: Math.round(box.height),
    width: Math.round(box.width),
    // Cut short for the failure message, and coupled to the card whether or not anybody meant it
    // to be: the first check asserts that this text carries the label of the button that pushed
    // the toast, so a card whose toast body grows past these 40 characters before that label
    // appears turns the check red for a reason that has nothing to do with the component. The
    // card's body is "success — pushed by the demo stack", 34 characters with the label first.
    // Lengthen this cut along with that body.
    text: (region.textContent ?? "").trim().slice(0, 40),
  }
})()`

/**
 * Toastr's live area, its auto-dismiss timer and the two things that pause it.
 *
 * None of this is reachable from a test that renders to a string: the area has to exist in a page
 * *before* the toast arrives, the timer is a `setTimeout`, and the pause is a pointer and a focus
 * move. The audit that opened this found the timer untested in the plainest way — it stopped the
 * timer from ever dismissing anything and the suite stayed green.
 *
 * Three habits the Dropdown and Modal checks above set, and one this one adds.
 *
 * The card's elements are parked on `globalThis` rather than re-queried, so the live-area check
 * compares element identity: re-querying would also match an area the first toast created, which is
 * exactly the defect under test. Every assertion is a transition — "no toast on screen" is true of
 * a toast that never appeared. Nothing here throws: a missing control is a failed check with a
 * message saying which one, because an exception costs every check left in this file — including
 * Modal's, which run after it — and replaces them with one failure that names `ui` rather than the
 * control.
 *
 * The addition is how the timer is driven. Waiting out the shipped five seconds, five times, is
 * both slow and a guess, so the card carries a button that pushes a **short, explicit** duration and
 * writes it on itself as `data-duration`; the checks read that number back and wait multiples of it.
 * The pause assertions are the awkward kind — they claim something does *not* happen for a while —
 * so they poll for the toast disappearing early instead of sleeping and hoping, and report the
 * moment it went if it went. A failure therefore reads "the toast left after 1240ms with focus
 * inside the stack" rather than "expected true".
 *
 * Two of the checks go further and time the toast from *inside the page*, through
 * {@link runThenAct}: a pause that lands after a known slice of the toast's life is what separates
 * a timer that resumes with what was left from one that starts the whole duration again, and that
 * slice cannot be measured across the protocol without carrying a round trip into it. Those two
 * exist because a review broke the budget two different ways and every check here stayed green.
 *
 * The pointer is moved to the top-left corner before the timer checks and asserted to be off the
 * stack. It is not idle equipment: `strayClickCheck` above leaves the virtual pointer at viewport
 * coordinates over the Dropdown card, and viewport coordinates do not scroll with the page, so
 * without this the pointer can end up resting on the Toastr card and pausing the timer the check is
 * about to measure.
 *
 * **Every toast here comes out of a real `createToastStore`.** The card used to keep its own array,
 * so these checks proved the component on its own and said nothing about the pair — which is how
 * #174 and #175 survived a green browser run. The card now reads the store, the component owns
 * every timer, and {@link storeDelayChecks} at the end covers the two things that only the pair
 * can be wrong about: the delay crossing the boundary, and the two sides agreeing about what is
 * on screen.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(TOASTR_SETUP)
  const empty = await devtools.evaluate<ToastrState>(TOASTR_STATE)

  // The button's own label is what the demo puts at the front of the toast's body, so the check can
  // demand that the words arrived without keeping a copy of the card's prose to drift from it.
  const filled = await devtools.evaluate<ToastrState & { pushed: string }>(`(async () => {
    const button = globalThis.__verifyToastr?.success ?? null
    const pushed = (button?.textContent ?? "").trim()
    button?.click()
    await new Promise((done) => setTimeout(done, 80))
    return { ...(${TOASTR_STATE}), pushed }
  })()`)
  const cleared = await devtools.evaluate<ToastrState>(`(async () => {
    globalThis.__verifyToastr?.clear?.click()
    await new Promise((done) => setTimeout(done, 80))
    return ${TOASTR_STATE}
  })()`)

  // The words matter as much as the element. A first version of this check counted children only,
  // and a review deleted the toast's body from the component and watched the whole browser suite
  // stay green — a toast with nothing in it is not a toast, and the check it replaced caught that.
  const arrived = filled.pushed.length > 0 && filled.text.includes(filled.pushed)
  check(
    "Toastr's live area is in the page before any toast, and a toast's words arrive inside that " +
      "same area",
    empty.present && empty.toasts === 0 && empty.role === "region" && empty.live === "polite" &&
      (empty.name ?? "").length > 0 && filled.same && filled.toasts === 1 && arrived,
    !empty.present
      ? "no live area in the page before the first toast, so nothing was there to be changed"
      : !arrived
      ? `the stack gained ${filled.toasts - empty.toasts} element(s) but reads "${filled.text}", ` +
        `which does not carry the "${filled.pushed}" that was pushed`
      : `an empty ${empty.role} named "${empty.name}" with aria-live="${empty.live}" went from ` +
        `${empty.toasts} to ${filled.toasts} toasts ${
          filled.same ? "in the same element" : "in a different element"
        }, reading "${filled.text}"`,
  )
  check(
    "an empty Toastr live area reserves no height",
    empty.height === 0 && empty.width > 0 && filled.height > 0 && cleared.height === 0 &&
      cleared.toasts === 0,
    empty.present
      ? `${empty.width}px wide and ${empty.height}px tall with an empty stack, ${filled.height}px ` +
        `tall with one toast, back to ${cleared.height}px once it is cleared`
      : "there was no live area to measure",
  )

  const parked = await pointerAway(devtools)
  const pushed = await pushAutoToast(devtools)
  const startedAt = Date.now()
  const early = await holdsFor(
    () =>
      devtools.evaluate<boolean>(`(globalThis.__verifyToastr?.region?.children.length ?? 0) > 0`),
    Math.round(pushed.duration / 2),
  )
  const left = await goneWithin(devtools, pushed.duration * 4)
  const lifetime = Date.now() - startedAt
  check(
    "Toastr's own timer dismisses a toast",
    pushed.ok && pushed.toasts === 1 && parked.insideRegion === false && early.held && left.held,
    !pushed.ok
      ? pushed.reason
      : pushed.toasts !== 1
      ? `the card pushed ${pushed.toasts} toasts instead of one, so this proves nothing`
      : parked.insideRegion
      ? `the pointer was resting on the stack (${parked.tag}), which pauses the timer, so this ` +
        `proves nothing about it`
      : early.unreadable
      ? `the page stopped answering ${early.elapsedMs}ms in, so this proves nothing`
      : !early.held
      ? `a ${pushed.duration}ms toast was gone ${early.elapsedMs}ms after it was pushed, too soon ` +
        `to be its own timer`
      : left.held
      ? `a ${pushed.duration}ms toast was still there ${early.elapsedMs}ms in and left on its own ` +
        `${lifetime}ms after it was pushed`
      : `a ${pushed.duration}ms toast was still on screen ${lifetime}ms after it was pushed`,
  )

  await focusPauseCheck(devtools)
  await pointerPauseCheck(devtools)
  await budgetCheck(devtools)
  await extendCheck(devtools)
  await storeDelayChecks(devtools)

  // Leave the card as it was found, for whatever reads the page next.
  await devtools.evaluate<null>(`(globalThis.__verifyToastr?.clear?.click(), null)`)
}

/** One reading of the card's store readout next to its live area. */
interface StoreAndDom {
  /** `false` when the card was missing a part, which makes every number below meaningless. */
  ok: boolean
  /** Which part was missing, for the failure message. */
  reason: string
  /** Toasts the store says it is holding, as the card prints the number. */
  store: number
  /** Toasts in the live area. */
  dom: number
  /** The stack's text, cut short, for the failure message. */
  text: string
}

/** A push of the card's two long-lived toasts, with the numbers the checks reason about. */
interface LongPush extends StoreAndDom {
  /** The long toast's delay, read off the card's own button. */
  long: number
  /** The delay a toast with no `duration` gets, read off the card rather than copied here. */
  fallback: number
}

/**
 * The delay a store toast asked for is the delay that runs, `0` included.
 *
 * This is #174 and #175 in the browser, and it needs the card's stack to come out of a real
 * `createToastStore` — it does, which is the other half of this change. Two toasts go up at once:
 * one asking for twenty seconds and one asking for `0`, which the store documents as "keep this
 * until somebody dismisses it". Before the fix both were gone in five, because the store wrote its
 * delay under a name the component did not read and the component fell back to its own default.
 *
 * One wait covers both, and it is the expensive part of this file, so it is sized rather than
 * padded: the window is the component's own default plus a fifth, read off the card so a changed
 * default moves the check with it. Five seconds is the number that has to be beaten; waiting the
 * full twenty would prove nothing more and cost fifteen seconds on every verification run.
 *
 * Then the two removal directions, which are why the card prints the store's own count: the
 * component takes the `0` toast off on a real press of its dismiss control, and the store's list
 * has to lose it too; the store takes the rest off on `clear`, and the live area has to empty.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function storeDelayChecks(devtools: Devtools): Promise<void> {
  const parked = await pointerAway(devtools)
  const pushed = await devtools.evaluate<LongPush>(`(async () => {
    const parked = globalThis.__verifyToastr ?? {}
    const { clear, long, success, fallback } = parked
    const blank = { long: 0, fallback: 0, store: -1, dom: -1, text: "" }
    if (!clear || !long || !success || !fallback) {
      const missing = !clear
        ? 'its clear button (data-e2e="toast-clear")'
        : !long
        ? 'its long-delay button (data-e2e="toast-long")'
        : !success
        ? 'its success button (data-e2e="toast-success")'
        : 'its default-duration readout (data-e2e="toast-default-duration")'
      return { ...blank, ok: false, reason: "the Toastr card is missing " + missing }
    }
    clear.click()
    await new Promise((done) => setTimeout(done, 50))
    long.click()
    success.click()
    await new Promise((done) => setTimeout(done, 80))
    return {
      ...(${TOASTR_STORE_AND_DOM}),
      long: Number(long.dataset.duration ?? 0),
      fallback: Number((fallback.textContent ?? "").trim()),
    }
  })()`)

  // Derived, not typed in: the window only has to outlast the default the component would have
  // applied, and the long toast only has to outlast the window.
  const waitMs = Math.round(pushed.fallback * 1.2)
  const held = await holdsFor(
    () => devtools.evaluate<boolean>(`${TOASTR_STORE_AND_DOM}.dom === 2`),
    waitMs,
  )
  const after = await devtools.evaluate<StoreAndDom>(TOASTR_STORE_AND_DOM)

  check(
    "a toast pushed through the store runs the delay the store was asked for, and duration: 0 " +
      "keeps it until somebody dismisses it",
    pushed.ok && pushed.dom === 2 && pushed.store === 2 && parked.insideRegion === false &&
      pushed.fallback > 0 && pushed.long > waitMs && held.held && after.dom === 2,
    !pushed.ok
      ? pushed.reason
      : pushed.fallback <= 0
      ? `the card's default-duration readout says "${pushed.fallback}", so there is no number to ` +
        `beat and this proves nothing`
      : pushed.dom !== 2 || pushed.store !== 2
      ? `the two toasts did not both go up: the store holds ${pushed.store} and the live area ` +
        `shows ${pushed.dom}, reading "${pushed.text}"`
      : pushed.long <= waitMs
      ? `the card's long toast asks for ${pushed.long}ms, which does not outlast the ${waitMs}ms ` +
        `window, so the two outcomes cannot be told apart`
      : parked.insideRegion
      ? `the pointer was resting on the stack (${parked.tag}), which pauses the timers, so ` +
        `surviving the window proves nothing`
      : held.unreadable
      ? `the page stopped answering ${held.elapsedMs}ms in, so this proves nothing`
      : !held.held
      ? `one of the two was gone ${held.elapsedMs}ms in — about the ${pushed.fallback}ms default ` +
        `the component applies to a toast whose delay never reached it; the stack reads ` +
        `"${after.text}"`
      : `a ${pushed.long}ms toast and a duration: 0 toast, both pushed through the store, were ` +
        `still on screen ${held.elapsedMs}ms later, past the ${pushed.fallback}ms the component ` +
        `would have given a toast whose delay it could not read`,
  )

  const dismissed = await devtools.evaluate<StoreAndDom & { pressed: boolean }>(`(async () => {
    const region = globalThis.__verifyToastr?.region ?? null
    const sticky = [...(region?.children ?? [])]
      .find((toast) => (toast.textContent ?? "").includes("success"))
    const control = sticky?.querySelector("button") ?? null
    if (control === null) return { ...(${TOASTR_STORE_AND_DOM}), pressed: false }
    control.click()
    await new Promise((done) => setTimeout(done, 80))
    return { ...(${TOASTR_STORE_AND_DOM}), pressed: true }
  })()`)

  check(
    "dismissing a toast in the stack takes it off the store's list as well as off the screen",
    dismissed.ok && dismissed.pressed && after.dom === 2 && after.store === 2 &&
      dismissed.dom === 1 && dismissed.store === 1,
    !dismissed.ok
      ? dismissed.reason
      : !dismissed.pressed
      ? "the duration: 0 toast carried no dismiss control to press, so this proves nothing"
      : after.dom !== 2 || after.store !== 2
      ? `there were not two toasts to take one away from: the store held ${after.store} and the ` +
        `live area showed ${after.dom}`
      : dismissed.dom === 1 && dismissed.store === 1
      ? `pressing one toast's dismiss control took the store from ${after.store} to ` +
        `${dismissed.store} and the live area from ${after.dom} to ${dismissed.dom}, leaving ` +
        `"${dismissed.text}"`
      : `the store and the screen disagree after the press: the store holds ${dismissed.store} ` +
        `and the live area shows ${dismissed.dom}`,
  )

  const emptied = await devtools.evaluate<StoreAndDom>(`(async () => {
    globalThis.__verifyToastr?.clear?.click()
    await new Promise((done) => setTimeout(done, 80))
    return ${TOASTR_STORE_AND_DOM}
  })()`)

  check(
    "a toast the store removes leaves the screen with it",
    emptied.ok && dismissed.dom === 1 && emptied.dom === 0 && emptied.store === 0,
    !emptied.ok
      ? emptied.reason
      : dismissed.dom !== 1
      ? `there was no toast left on screen to clear — the live area showed ${dismissed.dom}`
      : emptied.dom === 0 && emptied.store === 0
      ? `clearing the store took the live area from ${dismissed.dom} toast to ${emptied.dom}`
      : `the store was cleared to ${emptied.store} but the live area still shows ${emptied.dom}, ` +
        `reading "${emptied.text}"`,
  )
}

/**
 * A resumed timer runs the time the toast had left, not the whole duration over again.
 *
 * This is the behaviour the component's `remaining` ref, the subtraction in its timer cleanup and
 * a paragraph of its README exist for, and it is invisible to the two pause checks above: they hold
 * for longer than the whole duration and then allow four times it for the resume, so a toast that
 * restarts from scratch and one that carries on with 300ms look identical to them. A review made
 * resume use the full duration and watched every check stay green.
 *
 * So this one lets the toast run for three quarters of its life *before* pausing it, and then
 * compares the resumed lifetime against the two answers the two implementations give: about the
 * quarter that was left, or about a whole fresh duration. The threshold is the midpoint of those
 * two, computed from the elapsed time the page actually measured rather than from the one that was
 * asked for, which leaves each side around 450ms of room at the card's 1200ms — wide enough that a
 * loaded machine does not decide it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function budgetCheck(devtools: Devtools): Promise<void> {
  const parked = await pointerAway(devtools)
  const ran = await runThenAct(devtools, 0.75, FOCUS_INTO_STACK)
  const held = await holdsFor(
    () =>
      devtools.evaluate<boolean>(`(globalThis.__verifyToastr?.region?.children.length ?? 0) > 0`),
    Math.round(ran.duration * 1.25),
  )
  // The resumed lifetime is measured in the page, from the focus move to the mutation that empties
  // the stack. Measured from here instead, it carried a round trip and a poll interval on each end,
  // and on a loaded machine those alone pushed a correct 300ms resume past 900ms (#269).
  const out = await devtools.evaluate<{ ok: boolean; outside: boolean }>(`(() => {
    const parked = globalThis.__verifyToastr ?? {}
    if (!parked.clear || !parked.region) return { ok: false, outside: false }
    const clock = { leftAt: 0, goneAt: -1 }
    globalThis.__verifyToastrResume = clock
    const observer = new MutationObserver(() => {
      if (parked.region.children.length > 0) return
      clock.goneAt = performance.now()
      observer.disconnect()
    })
    observer.observe(parked.region, { childList: true })
    clock.leftAt = performance.now()
    parked.clear.focus()
    return { ok: true, outside: !parked.region.contains(document.activeElement) }
  })()`)
  const gone = await poll(
    () => devtools.evaluate<boolean>(`(globalThis.__verifyToastrResume?.goneAt ?? -1) >= 0`),
    ran.duration * 4,
  )
  const resumed: Hold = {
    held: gone,
    elapsedMs: gone
      ? await devtools.evaluate<number>(
        `Math.round(globalThis.__verifyToastrResume.goneAt - globalThis.__verifyToastrResume.leftAt)`,
      )
      : ran.duration * 4,
  }

  const owed = ran.duration - ran.elapsed
  const restart = ran.duration
  const threshold = Math.round((owed + restart) / 2)

  check(
    "a resumed Toastr timer runs the time the toast had left, not the whole duration again",
    ran.ok && ran.present && ran.done && parked.insideRegion === false && held.held && out.ok &&
      out.outside && resumed.held && resumed.elapsedMs < threshold,
    !ran.ok
      ? ran.reason
      : !ran.present
      ? `the ${ran.duration}ms toast was already gone ${ran.elapsed}ms in, before anything paused it`
      : !ran.done
      ? ran.note
      : parked.insideRegion
      ? `the pointer was resting on the stack (${parked.tag}), so the toast was paused before the ` +
        `check started counting`
      : held.unreadable
      ? `the page stopped answering ${held.elapsedMs}ms into the pause, so this proves nothing`
      : !held.held
      ? `the toast left ${held.elapsedMs}ms into a pause with ${ran.note}, so the timer did not ` +
        `pause at all and there is no resumed run to measure`
      : !out.outside
      ? "focus never left the stack, so nothing resumed"
      : !resumed.held
      ? `the timer never resumed: still on screen ${resumed.elapsedMs}ms after focus left`
      : resumed.elapsedMs < threshold
      ? `a ${ran.duration}ms toast ran ${ran.elapsed}ms, was paused with ${ran.note}, and then went ` +
        `${resumed.elapsedMs}ms after focus left — the ${owed}ms it had left, where starting over ` +
        `would have taken about ${restart}ms (anything past ${threshold}ms is a restart)`
      : `a ${ran.duration}ms toast ran ${ran.elapsed}ms, was paused, and then took another ` +
        `${resumed.elapsedMs}ms — nearer a fresh ${restart}ms than the ${owed}ms it had left, so ` +
        `the timer started over instead of resuming`,
  )
}

/**
 * Raising a live toast's duration gives it the new budget in full.
 *
 * The other half of the same few lines: the component resets `remaining` when a toast's own
 * duration changes, which is how a caller extends something already on screen, and deleting that
 * effect left every check green because nothing on the card ever changed a duration. The card now
 * carries a control that does, and the two implementations answer differently by seconds — the new
 * budget in full, or the sliver the old one had left.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function extendCheck(devtools: Devtools): Promise<void> {
  const parked = await pointerAway(devtools)
  const asked = await devtools.evaluate<number>(
    `Number(globalThis.__verifyToastr?.extend?.dataset.duration ?? 0)`,
  )
  const ran = await runThenAct(devtools, 0.75, CLICK_EXTEND)
  const held = await holdsFor(
    () =>
      devtools.evaluate<boolean>(`(globalThis.__verifyToastr?.region?.children.length ?? 0) > 0`),
    Math.round(asked * 0.6),
  )
  const gone = await goneWithin(devtools, asked * 2)
  const lived = held.elapsedMs + gone.elapsedMs
  const owed = ran.duration - ran.elapsed

  check(
    "extending a Toastr toast already on screen gives it the new duration in full",
    ran.ok && ran.present && ran.done && asked > ran.duration && parked.insideRegion === false &&
      held.held && gone.held,
    !ran.ok
      ? ran.reason
      : asked <= ran.duration
      ? `the card extends to ${asked}ms, which is not longer than the ${ran.duration}ms it pushes, ` +
        `so the two outcomes cannot be told apart`
      : !ran.present
      ? `the ${ran.duration}ms toast was already gone ${ran.elapsed}ms in, before it was extended`
      : !ran.done
      ? ran.note
      : parked.insideRegion
      ? `the pointer was resting on the stack (${parked.tag}), which pauses the timer, so this ` +
        `proves nothing about the new budget`
      : held.unreadable
      ? `the page stopped answering ${held.elapsedMs}ms after the extend, so this proves nothing`
      : !held.held
      ? `the toast left ${held.elapsedMs}ms after being extended to ${asked}ms — about the ${owed}ms ` +
        `its original ${ran.duration}ms budget had left, so the extend never refilled it`
      : !gone.held
      ? `extended to ${asked}ms, the toast was still on screen ${lived}ms later, so it is not ` +
        `dismissing itself at all any more`
      : `a ${ran.duration}ms toast was extended to ${asked}ms after ${ran.elapsed}ms and lived ` +
        `${lived}ms more, not the ${owed}ms its first budget had left`,
  )
}

/**
 * Focus inside the stack holds the timer, and the timer resumes once focus leaves.
 *
 * The toast comes out of `createToastStore`, because the whole card does now. That is what #175
 * was about: the pause was real and proven, and it reached nothing when the stack was wired the
 * way the documentation showed, because the store was running a second timer the component could
 * not touch.
 *
 * The control focused is a toast's own dismiss button — the one a keyboard user is reaching for
 * when the five-second race is lost — and focus leaves to the card's clear button, which is outside
 * the stack but still on the page. That is the stricter of the two paths the component has to get
 * right: `focusout` carries a real `relatedTarget` there, and a component that resumed on any
 * `focusout` would also resume while focus moved *between* two controls inside one toast.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function focusPauseCheck(devtools: Devtools): Promise<void> {
  const parked = await pointerAway(devtools)
  const pushed = await pushAutoToast(devtools)
  const focused = await devtools.evaluate<{ ok: boolean; inside: boolean; label: string }>(`(() => {
    const region = globalThis.__verifyToastr?.region ?? null
    const control = region?.querySelector("button") ?? null
    if (control === null) return { ok: false, inside: false, label: "" }
    control.focus()
    return {
      ok: true,
      inside: region.contains(document.activeElement),
      label: control.getAttribute("aria-label") ?? "",
    }
  })()`)

  const held = await holdsFor(
    () =>
      devtools.evaluate<boolean>(`(globalThis.__verifyToastr?.region?.children.length ?? 0) > 0`),
    Math.round(pushed.duration * 2.5),
  )
  const out = await devtools.evaluate<{ ok: boolean; outside: boolean }>(`(() => {
    const parked = globalThis.__verifyToastr ?? {}
    if (!parked.clear || !parked.region) return { ok: false, outside: false }
    parked.clear.focus()
    return { ok: true, outside: !parked.region.contains(document.activeElement) }
  })()`)
  const resumed = await goneWithin(devtools, pushed.duration * 4)

  check(
    "focus inside the Toastr stack holds the timer of a toast that came out of the store, and " +
      "leaving resumes it",
    pushed.ok && pushed.toasts === 1 && parked.insideRegion === false && focused.ok &&
      focused.inside && held.held && out.ok && out.outside && resumed.held,
    !pushed.ok
      ? pushed.reason
      : parked.insideRegion
      ? `the pointer was resting on the stack (${parked.tag}), which pauses the timer on its own, ` +
        `so a focus pause proves nothing here`
      : !focused.ok
      ? "the toast carried no control to focus, so this proves nothing about a pause"
      : !focused.inside
      ? "focus never landed inside the stack, so the timer was never asked to pause"
      : held.unreadable
      ? `the page stopped answering ${held.elapsedMs}ms in, so this proves nothing`
      : !held.held
      ? `the toast left ${held.elapsedMs}ms after it was pushed with focus on "${focused.label}", ` +
        `so a ${pushed.duration}ms timer did not pause`
      : !out.outside
      ? "focus never left the stack, so a resume proves nothing"
      : resumed.held
      ? `a ${pushed.duration}ms toast was still on screen ${held.elapsedMs}ms in with focus on ` +
        `"${focused.label}", and went ${resumed.elapsedMs}ms after focus left`
      : `the timer never resumed: still on screen ${resumed.elapsedMs}ms after focus left`,
  )
}

/**
 * The pointer over the stack holds the timer, and the timer resumes once the pointer leaves.
 *
 * Like the focus pause above, this runs against a toast the card pushed through the store, so it
 * measures the hold on the wiring the documentation shows rather than on a stack the card kept to
 * itself.
 *
 * The move is a real `Input.dispatchMouseEvent`, so the browser hit-tests it and produces the
 * `mouseenter` the component listens for; a synthesised event in the page would prove only that a
 * listener exists. Two things are measured rather than assumed, both for the same reason a missed
 * click and a broken component look identical from outside: the point is derived from the toast's
 * own box and checked against `elementFromPoint` before the move, and the page records where the
 * browser actually delivered the move, so a pointer that landed somewhere else says so.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function pointerPauseCheck(devtools: Devtools): Promise<void> {
  await pointerAway(devtools)
  // The point is computed in one round trip and dispatched in the next, so the page has to have
  // stopped moving in between — the same reason `strayClickCheck` waits above. The *stack* is what
  // gets centred, not the card: the card is taller than the viewport, and centring it left the
  // stack below the fold with no point to aim at.
  await centreInView(devtools, `globalThis.__verifyToastr?.region ?? null`)

  const pushed = await pushAutoToast(devtools)
  const spot = await devtools.evaluate<Point>(`(() => {
    const region = globalThis.__verifyToastr?.region ?? null
    const toast = region?.firstElementChild ?? null
    if (toast === null) return { x: -1, y: -1, inViewport: false, insideRegion: false, tag: "nothing" }
    const box = toast.getBoundingClientRect()
    const x = Math.round(box.left + box.width / 2)
    const y = Math.round(box.top + box.height / 2)
    const target = document.elementFromPoint(x, y)
    return {
      x,
      y,
      inViewport: x >= 0 && y >= 0 && x < globalThis.innerWidth && y < globalThis.innerHeight,
      insideRegion: target !== null && region.contains(target),
      tag: target === null ? "nothing" : target.tagName,
    }
  })()`)

  // One-shot, capture phase, installed before the move: the browser's own answer to "where did that
  // pointer go", which cannot be recovered afterwards once the toast has left the page.
  await devtools.evaluate<null>(`(() => {
    const region = globalThis.__verifyToastr?.region ?? null
    globalThis.__verifyToastHover = null
    document.addEventListener("mouseover", (event) => {
      globalThis.__verifyToastHover = {
        insideRegion: region !== null && region.contains(event.target),
        tag: event.target === null ? "nothing" : event.target.tagName,
        x: event.clientX,
        y: event.clientY,
      }
    }, { capture: true, once: true })
    return null
  })()`)
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: spot.x,
    y: spot.y,
    button: "none",
    buttons: 0,
  })
  const hover = await devtools.evaluate<Hover | null>(`globalThis.__verifyToastHover ?? null`)

  const held = await holdsFor(
    () =>
      devtools.evaluate<boolean>(`(globalThis.__verifyToastr?.region?.children.length ?? 0) > 0`),
    Math.round(pushed.duration * 2.5),
  )
  const away = await pointerAway(devtools)
  const resumed = await goneWithin(devtools, pushed.duration * 4)

  check(
    "the pointer over the Toastr stack holds the timer of a toast that came out of the store, " +
      "and leaving resumes it",
    pushed.ok && pushed.toasts === 1 && spot.inViewport && spot.insideRegion && hover !== null &&
      hover.insideRegion && held.held && away.insideRegion === false && resumed.held,
    !pushed.ok
      ? pushed.reason
      : !spot.inViewport || !spot.insideRegion
      ? `nothing of the stack to point at: (${spot.x}, ${spot.y}) reads ${spot.tag}` +
        `${spot.inViewport ? "" : ", outside the viewport"} — this proves nothing`
      : hover === null
      ? "the pointer move never reached the page, so this proves nothing about hovering"
      : !hover.insideRegion
      ? `the pointer landed on ${hover.tag} at (${hover.x}, ${hover.y}), outside the stack it was ` +
        `aimed at — a missed move, which proves nothing`
      : held.unreadable
      ? `the page stopped answering ${held.elapsedMs}ms in, so this proves nothing`
      : !held.held
      ? `the toast left ${held.elapsedMs}ms after it was pushed with the pointer on ${hover.tag}, ` +
        `so a ${pushed.duration}ms timer did not pause`
      : away.insideRegion
      ? "the pointer never left the stack, so a resume proves nothing"
      : resumed.held
      ? `a ${pushed.duration}ms toast was still on screen ${held.elapsedMs}ms in with the pointer ` +
        `on ${hover.tag} at (${hover.x}, ${hover.y}), and went ${resumed.elapsedMs}ms after the ` +
        `pointer moved to ${away.tag}`
      : `the timer never resumed: still on screen ${resumed.elapsedMs}ms after the pointer left`,
  )
}

/**
 * Clear the stack and push the card's one self-dismissing toast.
 *
 * The duration comes back from the button's own `data-duration` rather than being written down
 * here, so the checks wait multiples of what the card really pushed and the two cannot drift apart.
 *
 * @param devtools The connected session.
 * @returns What the card did, including which control was missing when it could do nothing.
 */
async function pushAutoToast(devtools: Devtools): Promise<Pushed> {
  return await devtools.evaluate<Pushed>(`(async () => {
    const { region, auto, clear } = globalThis.__verifyToastr ?? {}
    if (!region || !auto || !clear) {
      const missing = !region
        ? "its live area"
        : !auto
        ? 'its auto-dismiss button (data-e2e="toast-auto")'
        : 'its clear button (data-e2e="toast-clear")'
      return { ok: false, reason: "the Toastr card is missing " + missing, duration: 0, toasts: -1 }
    }
    clear.click()
    await new Promise((done) => setTimeout(done, 50))
    auto.click()
    await new Promise((done) => setTimeout(done, 50))
    const duration = Number(auto.dataset.duration ?? 0)
    if (!Number.isFinite(duration) || duration <= 0) {
      return {
        ok: false,
        reason: "the card's auto-dismiss button carries no usable data-duration",
        duration: 0,
        toasts: region.children.length,
      }
    }
    return { ok: true, reason: "", duration, toasts: region.children.length }
  })()`)
}

/** Put focus on the newest toast's own dismiss control, which is what pauses the stack. */
const FOCUS_INTO_STACK = `(() => {
  const control = region.querySelector("button")
  if (control === null) return { done: false, note: "the toast carried no control to focus" }
  control.focus()
  const inside = region.contains(document.activeElement)
  return {
    done: inside,
    note: inside
      ? 'focus on "' + (control.getAttribute("aria-label") ?? "its control") + '"'
      : "focus never landed inside the stack",
  }
})()`

/** Press the card's control that raises every toast on screen to a longer duration. */
const CLICK_EXTEND = `(() => {
  const extend = parked.extend ?? null
  if (extend === null) {
    return { done: false, note: 'the card is missing its extend control (data-e2e="toast-extend")' }
  }
  extend.click()
  return { done: true, note: "extended to " + (extend.dataset.duration ?? "?") + "ms" }
})()`

/**
 * Clear the stack, push the self-dismissing toast, let it run for part of its life, then act on it.
 *
 * The waiting happens **in the page**, not across the protocol, and that is the point of the
 * helper. Two of these checks turn on the toast having been alive for a known fraction of its
 * duration when the pause or the extend lands, and a host-side wait would carry a round trip and a
 * poll interval into that number; a page-side `setTimeout` measured from the moment of the push
 * gives it back to within a few milliseconds, and reports what it really was rather than what was
 * asked for.
 *
 * @param devtools The connected session.
 * @param share How much of the toast's duration to let run before acting, as a fraction.
 * @param act A page expression, with `region` and `parked` in scope, returning `{ done, note }`.
 * @returns What the toast did, and what the action has to say for itself.
 */
async function runThenAct(devtools: Devtools, share: number, act: string): Promise<Ran> {
  return await devtools.evaluate<Ran>(`(async () => {
    const parked = globalThis.__verifyToastr ?? {}
    const { region, auto, clear } = parked
    const blank = { duration: 0, elapsed: 0, present: false, done: false, note: "" }
    if (!region || !auto || !clear) {
      const missing = !region
        ? "its live area"
        : !auto
        ? 'its auto-dismiss button (data-e2e="toast-auto")'
        : 'its clear button (data-e2e="toast-clear")'
      return { ...blank, ok: false, reason: "the Toastr card is missing " + missing }
    }
    const duration = Number(auto.dataset.duration ?? 0)
    if (!Number.isFinite(duration) || duration <= 0) {
      return {
        ...blank,
        ok: false,
        reason: "the card's auto-dismiss button carries no usable data-duration",
      }
    }

    clear.click()
    await new Promise((done) => setTimeout(done, 50))
    const pushedAt = Date.now()
    auto.click()
    await new Promise((done) => setTimeout(done, 50))
    const wait = Math.round(duration * ${share}) - (Date.now() - pushedAt)
    if (wait > 0) await new Promise((done) => setTimeout(done, wait))

    const present = region.children.length > 0
    const outcome = present
      ? ${act}
      : { done: false, note: "the toast was gone before the check could act on it" }

    return {
      ok: true,
      reason: "",
      duration,
      elapsed: Date.now() - pushedAt,
      present,
      done: outcome.done,
      note: outcome.note,
    }
  })()`)
}

/**
 * Move the pointer to the top-left corner of the viewport, off the stack.
 *
 * @param devtools The connected session.
 * @returns What is under the corner, so a check can say the pointer really is clear of the stack.
 */
async function pointerAway(devtools: Devtools): Promise<Point> {
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 2,
    y: 2,
    button: "none",
    buttons: 0,
  })

  return await devtools.evaluate<Point>(`(() => {
    const region = globalThis.__verifyToastr?.region ?? null
    const target = document.elementFromPoint(2, 2)
    return {
      x: 2,
      y: 2,
      inViewport: true,
      insideRegion: region !== null && target !== null && region.contains(target),
      tag: target === null ? "nothing" : target.tagName,
    }
  })()`)
}

/**
 * Watch a page condition for a window, and report the moment it stopped holding.
 *
 * The inverse of {@link poll}, and the shape a "this must *not* happen yet" assertion needs: a bare
 * sleep followed by one read says nothing about when the thing it was watching gave way, which is
 * the only number that makes a paused-timer failure readable without a second run.
 *
 * A read that throws is reported as `unreadable` rather than as the condition giving way or as an
 * exception. The shared {@link poll} swallows the same thing and keeps waiting, which is right for
 * it and wrong here — a protocol error is not evidence that a toast disappeared, and blaming the
 * component for the harness is exactly the failure message nobody can act on. Letting it throw is
 * worse still: it would leave `uiChecks` and take the Modal checks down with it.
 *
 * @param read The condition.
 * @param windowMs How long it has to keep holding.
 */
async function holdsFor(read: () => Promise<boolean>, windowMs: number): Promise<Hold> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < windowMs) {
    try {
      if (!await read()) return { held: false, elapsedMs: Date.now() - startedAt }
    } catch {
      return { held: false, elapsedMs: Date.now() - startedAt, unreadable: true }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return { held: true, elapsedMs: Date.now() - startedAt }
}

/**
 * Wait for the stack to empty, and report how long that took.
 *
 * @param devtools The connected session.
 * @param timeoutMs How long to wait before giving up.
 */
async function goneWithin(devtools: Devtools, timeoutMs: number): Promise<Hold> {
  const startedAt = Date.now()
  const held = await poll(
    () =>
      devtools.evaluate<boolean>(
        `(globalThis.__verifyToastr?.region?.children.length ?? -1) === 0`,
      ),
    timeoutMs,
  )

  return { held, elapsedMs: Date.now() - startedAt }
}

/** The card `ImageGallery`'s and the shared `Lightbox`'s checks drive. */
const GALLERY_CARD = "#demo-ImageGallery"
const GALLERY_DIALOG = `${GALLERY_CARD} dialog`

/** Whether the gallery's lightbox is open, what it shows, and where focus and the live text sit. */
interface GalleryLightboxState {
  /** Whether the dialog is really in the top layer, not merely present and closed. */
  open: boolean
  /** `alt` of the image currently shown, or `""` when none is. */
  imageAlt: string
  /** The always-present live region's text, trimmed. */
  liveText: string
  /** Whether that region is the very element parked on `globalThis` before anything opened. */
  liveSameNode: boolean
  /** Whether the focused element is the thumbnail parked on `globalThis`. */
  focusedIsThumb: boolean
  /** What is focused, for a failure message. */
  focusedLabel: string
}

/** Read {@link GalleryLightboxState} in one round trip. */
function readGalleryState(devtools: Devtools): Promise<GalleryLightboxState> {
  return devtools.evaluate<GalleryLightboxState>(`(() => {
    const dialog = document.querySelector('${GALLERY_DIALOG}')
    const modal = Boolean(dialog) && dialog.matches(":modal")
    const img = modal ? dialog.querySelector("img") : null
    const live = dialog ? dialog.querySelector('[role="status"]') : null
    const active = document.activeElement
    return {
      open: modal,
      // Read only while the dialog is genuinely modal: the <img> is a child of Lightbox's own
      // { open && current && … } branch, which is gated on the *prop* the caller passed, not on
      // dialog.matches(":modal") — so with showModal() itself broken, this element still exists
      // and still carries a real alt, and a check that read it unconditionally would not notice.
      imageAlt: img ? img.getAttribute("alt") : "",
      liveText: live ? live.textContent.trim() : "",
      liveSameNode: live !== null && live === globalThis.__verifyGalleryLive,
      focusedIsThumb: active === globalThis.__verifyGalleryThumb,
      focusedLabel: active
        ? (active.getAttribute("aria-label") || active.tagName)
        : "nothing",
    }
  })()`)
}

/**
 * `ImageGallery`'s thumbnail strip and the shared `Lightbox` it opens, driven in the browser that
 * owns both: a thumbnail opens on a real Enter press and on Space, Left/Right and a real mouse
 * click on the previous/next buttons all page through the sequence and update the live region that
 * was already on the page before anything opened, Escape closes it, and focus returns to the
 * thumbnail that opened it.
 *
 * `ZoomableImages` (`ui/zoomable-images.tsx`) opens the same `Lightbox`, and its own checks in
 * `pages/checks/system.ts` already prove the backdrop click and the linked-image case; this file
 * does not repeat them.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function imageGalleryChecks(devtools: Devtools): Promise<void> {
  // Parked before the dialog is ever opened, so the later identity comparison proves the counter
  // reaches a region that was already on the page rather than one that arrived with its message
  // already inside it.
  await devtools.evaluate<null>(`(() => {
    globalThis.__verifyGalleryLive = document.querySelector('${GALLERY_DIALOG} [role="status"]')
    globalThis.__verifyGalleryThumb = document.querySelector('${GALLERY_CARD} button')
    globalThis.__verifyGalleryThumb.focus()
    return null
  })()`)

  const beforeOpen = await readGalleryState(devtools)
  const focusedThumb = beforeOpen.focusedIsThumb
  await pressKey(devtools, "Space")
  await poll(async () => (await readGalleryState(devtools)).open, 3_000)
  const afterSpace = await readGalleryState(devtools)
  check(
    "a real Space press opens the thumbnail's lightbox",
    focusedThumb && !beforeOpen.open && afterSpace.open,
    focusedThumb
      ? `closed → Space → ${
        afterSpace.open ? `open, showing "${afterSpace.imageAlt}"` : "still closed"
      }`
      : "the thumbnail never took focus, so a key press proves nothing about it",
  )

  await pressKey(devtools, "ArrowRight")
  await poll(async () => (await readGalleryState(devtools)).imageAlt !== afterSpace.imageAlt, 3_000)
  const afterRight = await readGalleryState(devtools)
  check(
    "a real Right press changes the image and announces it, with its position, in the live region that was already there",
    afterSpace.open && afterRight.imageAlt !== afterSpace.imageAlt &&
      afterRight.liveText.includes(afterRight.imageAlt) && afterRight.liveText.includes(" of ") &&
      afterRight.liveSameNode,
    afterSpace.open
      ? `"${afterSpace.imageAlt}" → Right → "${afterRight.imageAlt}", same live region ` +
        `(${afterRight.liveSameNode}) reads "${afterRight.liveText}"`
      : "the lightbox never opened, so Right proves nothing",
  )

  await pressKey(devtools, "ArrowLeft")
  await poll(async () => (await readGalleryState(devtools)).imageAlt !== afterRight.imageAlt, 3_000)
  const afterLeft = await readGalleryState(devtools)
  check(
    "a real Left press changes the image back",
    // Gated on the dialog having genuinely opened and Right having genuinely moved, not merely on
    // Left's own result equalling the start: without both, a Lightbox that never opened at all —
    // or where Right silently did nothing — reads as "unchanged", which a Left that also did
    // nothing would pass just as well. Measured: an earlier version of this check gated on neither
    // and stayed green with `showModal()` deleted from `ui/lightbox.tsx`.
    afterSpace.open && afterRight.imageAlt !== afterSpace.imageAlt &&
      afterLeft.imageAlt === afterSpace.imageAlt,
    afterSpace.open
      ? `"${afterRight.imageAlt}" → Left → "${afterLeft.imageAlt}"`
      : "the lightbox never opened, so Left proves nothing",
  )

  await pressKey(devtools, "Escape")
  await poll(async () => !(await readGalleryState(devtools)).open, 3_000)
  const afterEscape = await readGalleryState(devtools)
  check(
    "a real Escape press closes the lightbox and returns focus to the thumbnail that opened it",
    // Gated on `afterSpace.open`, not on `afterLeft.imageAlt !== ""`: the latter reads the <img>
    // that `Lightbox` renders whenever its `open` *prop* is true, which is not the same fact as
    // the dialog genuinely being `:modal` — measured in review, deleting `showModal()` left that
    // element in the DOM with a real `alt` while `dialog.matches(":modal")` stayed `false`
    // throughout, and this check stayed green regardless. `readGalleryState` now reads `imageAlt`
    // only while the dialog is modal too, so the two guards agree; this one names the fact the
    // check is actually about.
    afterSpace.open && !afterEscape.open && afterEscape.focusedIsThumb,
    afterSpace.open
      ? `open → Escape → open=${afterEscape.open}, focus is on ` +
        `${afterEscape.focusedIsThumb ? "the thumbnail" : afterEscape.focusedLabel}`
      : "the lightbox was never open, so Escape proves nothing",
  )

  // A real Enter key press, carrying `text: "\r"` — see `pressKey`'s own doc in `harness.ts` for why
  // that field is what makes this genuinely a key press rather than a stand-in for one (#261).
  await pressKey(devtools, "Enter")
  await poll(async () => (await readGalleryState(devtools)).open, 3_000)
  const afterEnter = await readGalleryState(devtools)
  check(
    "a real Enter press opens the thumbnail's lightbox",
    afterEscape.focusedIsThumb && !afterEscape.open && afterEnter.open,
    afterEscape.focusedIsThumb
      ? `closed → Enter → ${
        afterEnter.open ? `open, showing "${afterEnter.imageAlt}"` : "still closed"
      }`
      : "focus was not on the thumbnail after Escape, so a key press proves nothing about it",
  )

  // The previous/next buttons, with real mouse presses at their own rectangles — `.click()` fires
  // with no hit-testing, so it would "press" a button covered by something else just as readily as
  // one that is not.
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector('${GALLERY_DIALOG}')
    globalThis.__verifyGalleryNext = dialog?.querySelector('button[aria-label="Next image"]') ?? null
    globalThis.__verifyGalleryPrevious =
      dialog?.querySelector('button[aria-label="Previous image"]') ?? null
    return null
  })()`)

  const nextAim = await aimAt(devtools, "globalThis.__verifyGalleryNext")
  const nextLanding = await clickAt(devtools, nextAim, "globalThis.__verifyGalleryNext")
  await poll(async () => (await readGalleryState(devtools)).imageAlt !== afterEnter.imageAlt, 3_000)
  const afterNextClick = await readGalleryState(devtools)
  check(
    "a real mouse click on the next button moves forward, not backward or nowhere",
    afterEnter.open && nextAim.onTarget && afterNextClick.imageAlt === afterRight.imageAlt,
    afterEnter.open
      ? nextAim.onTarget
        ? `a real press at ${nextAim.x},${nextAim.y} landed on the next button and moved ` +
          `"${afterEnter.imageAlt}" → "${afterNextClick.imageAlt}" (the same image Right moved to)`
        : `no press was sent: the point landed on ${
          nextLanding?.tag ?? nextAim.tag
        }, not the button`
      : "the lightbox never opened, so this proves nothing",
  )

  const previousAim = await aimAt(devtools, "globalThis.__verifyGalleryPrevious")
  const previousLanding = await clickAt(devtools, previousAim, "globalThis.__verifyGalleryPrevious")
  await poll(
    async () => (await readGalleryState(devtools)).imageAlt !== afterNextClick.imageAlt,
    3_000,
  )
  const afterPreviousClick = await readGalleryState(devtools)
  check(
    "a real mouse click on the previous button moves back to where the next button started",
    afterNextClick.imageAlt !== afterEnter.imageAlt && previousAim.onTarget &&
      afterPreviousClick.imageAlt === afterEnter.imageAlt,
    afterNextClick.imageAlt !== afterEnter.imageAlt
      ? previousAim.onTarget
        ? `a real press at ${previousAim.x},${previousAim.y} landed on the previous button and ` +
          `moved "${afterNextClick.imageAlt}" → "${afterPreviousClick.imageAlt}"`
        : `no press was sent: the point landed on ${previousLanding?.tag ?? previousAim.tag}, ` +
          `not the button`
      : "the next button never moved the image, so this proves nothing about the previous one",
  )

  // Teardown, unconditional: `modalChecks` runs last in this file precisely because it cannot
  // tolerate a dialog left in the top layer, and this one has to leave none behind whatever went
  // wrong above.
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector('${GALLERY_DIALOG}')
    if (dialog && dialog.open) dialog.close()
    return null
  })()`)
}

/** The standalone `Lightbox` card's fourth button, and the dialog it tries to open. */
const LIGHTBOX_EMPTY_CARD = '#demo-Lightbox [data-e2e="lightbox-empty"]'
const LIGHTBOX_EMPTY_BUTTON = '#demo-Lightbox [data-e2e="lightbox-empty-open"]'

/**
 * `Lightbox` refuses to call `showModal()` when every image it was given has no description —
 * `canOpen`'s `total > 0` half. No unit test can reach this: a closed dialog and one refused open
 * for having nothing to show render identical server HTML (`open && current && …` is `false`
 * either way, since `current` is already `null` when `total` is `0`), so only a real
 * `dialog.matches(":modal")` reading, after a real click, can tell the two apart.
 *
 * `holdsFor` is the shape this needs, not `poll`: there is no state to wait *for* here, since
 * correct behaviour is that nothing ever changes, and polling for `:modal` becoming `true` would
 * time out and read as "closed" either way. What `holdsFor` alone cannot tell apart — found in
 * review — is "`canOpen` correctly refused" from "the button did nothing at all": both leave
 * `:modal` `false` forever. `data-requested` on the card's wrapper, flipped by the demo's own
 * `onClick`, is the missing half: asserting it became `true` is what makes a no-op button fail this
 * check instead of passing it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function lightboxRefusesEmptyCheck(devtools: Devtools): Promise<void> {
  const readModal = () =>
    devtools.evaluate<boolean>(
      `document.querySelector('${LIGHTBOX_EMPTY_CARD} dialog')?.matches(":modal") === true`,
    )
  // The card's own record of whether the button was pressed, read off the wrapper rather than
  // inferred from the dialog: a check that only ever reads "never became :modal" cannot tell
  // `canOpen` correctly refusing apart from the button silently doing nothing, and a demo whose
  // onClick was replaced with a no-op stayed green under the version of this check that only read
  // `:modal` — found in review.
  const readRequested = () =>
    devtools.evaluate<boolean>(
      `document.querySelector('${LIGHTBOX_EMPTY_CARD}')?.getAttribute("data-requested") === "true"`,
    )

  const before = await readModal()
  const requestedBefore = await readRequested()
  const clicked = await devtools.evaluate<boolean>(`(() => {
    const button = document.querySelector('${LIGHTBOX_EMPTY_BUTTON}')
    if (button) button.click()
    return Boolean(button)
  })()`)
  await poll(readRequested, 3_000)
  const requestedAfter = await readRequested()
  const stayedClosed = await holdsFor(async () => !(await readModal()), 1_000)

  check(
    "Lightbox refuses to open when every image it was given lacks a description",
    clicked && !before && !requestedBefore && requestedAfter && stayedClosed.held,
    !clicked
      ? "the card has no lightbox-empty-open button to press"
      : !requestedAfter
      ? "the button was pressed but the card never recorded the request, so this proves nothing " +
        "about canOpen"
      : stayedClosed.held
      ? `pressed the button that opens a lightbox with one undescribed image (requested: ` +
        `${requestedBefore} → ${requestedAfter}); the dialog never became :modal in ` +
        `${stayedClosed.elapsedMs}ms`
      : `the dialog became :modal ${stayedClosed.elapsedMs}ms after the press, though the one ` +
        `image it was given has no description`,
  )

  // Teardown, unconditional: a broken canOpen would leave this dialog in the top layer, which
  // would take Modal's own checks down with it — Modal runs last in this file precisely because it
  // cannot tolerate that.
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector('${LIGHTBOX_EMPTY_CARD} dialog')
    if (dialog && dialog.open) dialog.close()
    return null
  })()`)
}

/** What the card's step control did, and what the close port made of it afterwards. */
interface Stepped {
  /** `false` when the card was missing a control, which makes every reading below meaningless. */
  ok: boolean
  /** Which control was missing, for the failure message. */
  reason: string
  /** The step the parent held when the dialog opened. */
  before: number
  /** The step the parent holds after the control was pressed. */
  after: number
}

/**
 * Modal's keyboard and focus contract, driven in the browser that owns it.
 *
 * Four facts that no string-rendering test can reach: the element really enters the top layer, a
 * real Escape press closes it, that press runs the close port the parent passed most recently
 * rather than the one captured when the dialog opened, and focus goes back to the button that
 * opened it. All four live behind an effect, a ref and a listener, which is exactly the shape this
 * repository's unit tests cannot execute — the stale-port one most of all, since which closure an
 * effect captured leaves no trace in a rendered string.
 *
 * The trigger is parked on `globalThis` instead of being re-queried, so the focus assertion compares
 * element identity: a selector would also match a freshly rendered button that never had focus.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function modalChecks(devtools: Devtools): Promise<void> {
  const trigger = await devtools.evaluate<{ label: string; focused: boolean }>(`(() => {
    const card = document.querySelector("#demo-Modal")
    const button = [...card.querySelectorAll("button")]
      .find((candidate) => candidate.textContent.trim().startsWith("default"))
    globalThis.__verifyModalTrigger = button
    button.focus()
    return { label: button.textContent.trim(), focused: document.activeElement === button }
  })()`)

  // A real Enter press, not `.click()`: `#261` found that `Input.dispatchKeyEvent`'s `keyDown`
  // needs a `text` field to activate a focused button, which `harness.ts`'s shared `pressKey` now
  // sends. The Escape press below is a real key event too, because that is the path under test.
  await pressKey(devtools, "Enter")
  // Wait for `:modal`, not merely for the element: Preact renders the `<dialog>` first and calls
  // `showModal()` from an effect a tick later, so an element-presence poll returns while the dialog
  // is still a closed, non-modal node and reads `open === false`.
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector("#demo-Modal dialog")?.matches(":modal") === true`,
      ),
    3_000,
  )

  const opened = await devtools.evaluate<{
    open: boolean
    modal: boolean
    focusInside: boolean
    activeLabel: string
  }>(`(() => {
    const dialog = document.querySelector("#demo-Modal dialog")
    const active = document.activeElement
    return {
      open: dialog?.open === true,
      modal: dialog?.matches(":modal") === true,
      focusInside: dialog !== null && dialog.contains(active),
      activeLabel: (active?.getAttribute("aria-label") ?? active?.tagName ?? "none").trim(),
    }
  })()`)
  check(
    "activating Modal's trigger opens a modal dialog and moves focus into it",
    trigger.focused && opened.open && opened.modal && opened.focusInside,
    `trigger focused=${trigger.focused}, dialog.open=${opened.open}, ` +
      `:modal=${opened.modal}, focus now on ${opened.activeLabel}`,
  )

  // Move the parent on before the key press, so the port the dialog opened with and the port it
  // holds now disagree about one number. That difference is the whole assertion below: without it
  // the captured closure and the current one would report the same value and the check would pass
  // either way.
  //
  // The step control sits inside the dialog because that is where a person would meet it, and for
  // no stronger reason. It was once claimed here that a control outside an open modal could not be
  // pressed at all, the rest of the page being inert; that is true of a person and false of this
  // check, and measured so — moved outside, the check still passes, because a scripted `.click()`
  // is not a real press and inertness does not stop it. So the placement is a choice about what the
  // demo shows, and what makes this check honest is the step having moved, which it asserts.
  const stepped = await devtools.evaluate<Stepped>(`(async () => {
    const card = document.querySelector("#demo-Modal")
    const readout = card?.querySelector('[data-e2e="modal-close-step"]') ?? null
    const next = card?.querySelector('[data-e2e="modal-next-step"]') ?? null
    if (readout === null || next === null) {
      return {
        ok: false,
        reason: "the Modal card is missing its " +
          (readout === null ? 'step readout (data-e2e="modal-close-step")' : 'step control (data-e2e="modal-next-step")'),
        before: -1,
        after: -1,
      }
    }
    const before = Number(readout.dataset.step)
    next.click()
    await new Promise((done) => setTimeout(done, 50))
    const fresh = document.querySelector('#demo-Modal [data-e2e="modal-close-step"]')
    return { ok: true, reason: "", before, after: Number(fresh?.dataset.step ?? NaN) }
  })()`)

  await pressKey(devtools, "Escape")
  const closed = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const dialog = document.querySelector("#demo-Modal dialog")
        return dialog === null || dialog.open === false
      })()`),
    3_000,
  )
  // A transition, open → closed, not just the closed half: a dialog that never opened is trivially
  // closed, and that is precisely what a broken opening step would leave behind.
  check(
    "a real Escape key press closes the Modal",
    opened.open && closed,
    opened.open
      ? closed
        ? "Input.dispatchKeyEvent Escape → the dialog left the top layer"
        : "the dialog was still open 3s after the key press"
      : "the dialog was never open, so this proves nothing about Escape",
  )

  // The port writes its reading into the card's readout, a tick after the close, so this waits for
  // a reading rather than assuming one is there.
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `(document.querySelector('#demo-Modal [data-e2e="modal-close-step"]')?.dataset.closedAt ?? "") !== ""`,
      ),
    3_000,
  )
  const saw = await devtools.evaluate<{ closedAt: number; reported: string }>(`(() => {
    const readout = document.querySelector('#demo-Modal [data-e2e="modal-close-step"]')
    const raw = readout?.dataset.closedAt ?? ""
    return { closedAt: raw === "" ? -1 : Number(raw), reported: raw === "" ? "nothing" : "step " + raw }
  })()`)
  // The axis this reads is *which render's closure ran*, and the step is what varies along it: the
  // parent held one value when the dialog opened and another when Escape arrived, so the reading
  // can name the render that produced it. Every other assertion here would hold with the bug in
  // place.
  check(
    "Escape runs the close port the parent passed most recently",
    stepped.ok && opened.open && closed && stepped.after !== stepped.before &&
      saw.closedAt === stepped.after,
    !stepped.ok
      ? stepped.reason
      : !opened.open
      ? "the dialog was never open, so this proves nothing about Escape"
      : stepped.after === stepped.before
      ? `the parent's step never moved (${stepped.before} → ${stepped.after}), so both renders ` +
        `passed a port reading the same value and this proves nothing`
      : !closed
      ? "the dialog never closed, so no close port ran"
      : saw.closedAt === stepped.before
      ? `the port that ran was the one captured when the dialog opened: it read step ` +
        `${stepped.before} after the parent had moved to step ${stepped.after}`
      : saw.closedAt === stepped.after
      ? `the parent stepped ${stepped.before} → ${stepped.after} while the dialog was open, and ` +
        `Escape's port read step ${stepped.after}`
      : `Escape's port read ${saw.reported}, which is neither the opening step ` +
        `(${stepped.before}) nor the current one (${stepped.after})`,
  )

  const restored = await poll(
    () => devtools.evaluate<boolean>(`document.activeElement === globalThis.__verifyModalTrigger`),
    3_000,
  )
  const active = await devtools.evaluate<string>(`(() => {
    const active = document.activeElement
    if (active === globalThis.__verifyModalTrigger) return "the trigger"
    return (active?.tagName ?? "nothing") + " " + (active?.textContent ?? "").trim().slice(0, 40)
  })()`)
  // Also a transition: focus has to have left the trigger for the dialog first, or "focus is on the
  // trigger" would hold for a dialog that never took it.
  //
  // What this check does *not* guard, measured rather than assumed: the component's own
  // `restoreFocus`. Deleting the `target.focus()` call from `ui/modal.tsx`, rebuilding and
  // re-running left this green, because Chromium itself returns focus to the element that was
  // focused before `showModal()` when a dialog closes. So this asserts the behaviour a person
  // experiences; it cannot tell the component's restore from the platform's. The call stays all
  // the same, for an engine that does not do that — the decision is #148, and `Modal`'s own JSDoc
  // carries it. Nothing here will cover it until these checks can drive a second engine.
  check(
    "closing the Modal returns focus to the button that opened it",
    opened.focusInside && restored,
    opened.focusInside
      ? `trigger "${trigger.label}" — document.activeElement is ${active}`
      : "focus never moved into the dialog, so a restore proves nothing",
  )

  await uncontrolledModalChecks(devtools)
}

/** What the uncontrolled dialog left behind once Escape had been pressed. */
interface Settled {
  /** Whether the element is still in the page. */
  present: boolean
  /** Whether that element, if it is there, is still an open dialog. */
  open: boolean
  /** What the page's scroll lock reads: `released`, or the value still written on the body. */
  lock: string
}

/**
 * The branch where `Modal` settles its own open state, which nothing else here reaches.
 *
 * Every other dialog in the catalogue is handed an `open` prop, so the component never decides
 * anything about its own flag: the parent unmounts it and the element goes with the parent. An
 * uncontrolled dialog — no `open`, seeded by `defaultOpen` — is the opposite, and it is the only
 * shape in which the component's `settleOpen` is load-bearing. Stubbing that branch out leaves
 * every unit test green, because a string render never runs it, and leaves every other browser
 * check green too, because they all drive controlled dialogs.
 *
 * The reading that separates the two worlds is **whether the element is still in the page**, not
 * whether the dialog is closed. Both a settled and an unsettled dialog read `open === false` after
 * Escape, because `close()` ran either way. Only a settled one stops rendering: the component
 * returns `null`, the `<dialog>` leaves the DOM, and the scroll lock the effect was holding is
 * released with it. An unsettled one leaves a closed element behind that can never be opened again,
 * with the page still locked behind it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function uncontrolledModalChecks(devtools: Devtools): Promise<void> {
  const pressed = await devtools.evaluate<{ ok: boolean; reason: string }>(`(() => {
    const trigger = document.querySelector('#demo-Modal [data-e2e="modal-uncontrolled-open"]')
    if (trigger === null) {
      return {
        ok: false,
        reason: 'the Modal card is missing its uncontrolled trigger (data-e2e="modal-uncontrolled-open")',
      }
    }
    trigger.click()
    return { ok: true, reason: "" }
  })()`)

  const becameModal = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('[data-e2e="guide-modal-uncontrolled"]')?.matches(":modal") === true`,
      ),
    3_000,
  )

  await pressKey(devtools, "Escape")
  // Two polls rather than one read, and the second is not redundant. The element leaves the DOM in
  // the commit, and the effect cleanup that releases the page's scroll lock runs after it, a frame
  // later: reading the lock the instant the element disappeared landed inside that gap on one run
  // and reported a locked page that was released milliseconds afterwards.
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('[data-e2e="guide-modal-uncontrolled"]') === null`,
      ),
    3_000,
  )
  await poll(() => devtools.evaluate<boolean>(`document.body.style.overflow === ""`), 3_000)
  const settled = await devtools.evaluate<Settled>(`(() => {
    const dialog = document.querySelector('[data-e2e="guide-modal-uncontrolled"]')
    return {
      present: dialog !== null,
      open: dialog?.open === true,
      lock: document.body.style.overflow === "" ? "released" : document.body.style.overflow,
    }
  })()`)

  check(
    "an uncontrolled Modal settles its own open flag, so Escape takes it off the page",
    pressed.ok && becameModal && !settled.present && settled.lock === "released",
    !pressed.ok
      ? pressed.reason
      : !becameModal
      ? "the uncontrolled dialog never became modal, so nothing here proves anything about closing it"
      : settled.present && settled.open
      ? "the dialog was still open 3s after the key press"
      : settled.present
      ? `the dialog closed but stayed in the page, so the component never settled its own open ` +
        `flag: it can no longer be opened, and the page's scroll lock reads "${settled.lock}"`
      : settled.lock !== "released"
      ? `the element left the page, but 3s later the page's scroll lock still reads ` +
        `"${settled.lock}", so the page underneath it is stuck`
      : `defaultOpen → :modal, then a real Escape press → the element left the page and the ` +
        `page's scroll lock is released`,
  )
}

/** Where a dispatched pointer move landed, as the page saw the browser deliver it. */
interface Landing {
  /** `true` when the browser delivered the move to the element aimed at, or to something inside it. */
  onTarget: boolean
  tag: string
  x: number
  y: number
}

/** A point derived from an element's own box, with the reading that says what is at it. */
interface Aim {
  x: number
  y: number
  /** `true` when the point is inside the viewport, which viewport coordinates have to be. */
  inViewport: boolean
  /** `true` when `elementFromPoint` reads the element aimed at, or something inside it. */
  onTarget: boolean
  /** What is actually at the point, for the failure message. */
  tag: string
  /** The box, rounded: an element with no box reports itself rather than passing quietly. */
  width: number
  height: number
}

/** One read of the live tooltip: the hint's own state, plus where focus is. */
interface TooltipState {
  /** `false` when the card is missing the row these checks drive; every other field is then noise. */
  ok: boolean
  /** Computed `visibility` of the surface. `"visible"` only while the hint is revealed. */
  visibility: string
  /** Computed `opacity`, so a reading taken mid-transition is visible as one. */
  opacity: string
  /** `true` while the surface has a box at all — Escape takes the box away with `hidden`. */
  boxed: boolean
  /** How many client rects the surface has. `boxed` is this above zero; the count is evidence. */
  rects: number
  /** `true` when the browser has the trigger in its `:hover` state, which is what reveals a hint. */
  hover: boolean
  /** `true` when the browser has the surface itself in `:hover`. */
  surfaceHover: boolean
  /** The trigger's `aria-describedby`, or `null` once the hint is dismissed. */
  described: string | null
  /** `true` when the parked trigger is the focused element. */
  focused: boolean
  /** What the hint says, cut short for the failure message. */
  text: string
}

/** The strip of surface between the bubble and the trigger, and what hit-tests inside it. */
interface Bridge {
  x: number
  y: number
  /** The bridge's own thickness in pixels, from the surface's edge to the bubble's. */
  strip: number
  /** Pixels between the trigger's box and the surface's. Dead space is anything above zero. */
  gap: number
  /** `true` when a point in the middle of the bridge hit-tests to the hint. */
  onTarget: boolean
  tag: string
}

/** What Chromium makes of the trigger: the three things a hint on a nameless element loses. */
interface Named {
  role: string
  name: string
  description: string
}

/**
 * Park the tooltip card's live row, its trigger and its surface on `globalThis`.
 *
 * Parked rather than re-queried for a reason this component makes sharper than most: dismissing a
 * hint takes `aria-describedby` off the trigger, so a selector written around that attribute stops
 * matching exactly when the check needs to read what it matched before.
 *
 * The row is the one hint on the card that reveals itself. Every other hint there is pinned open
 * with `contentClass="visible opacity-100"`, and a hint that is always up cannot tell a reveal
 * that works from one that is broken.
 */
const TOOLTIP_SETUP = `(() => {
  const row = document.querySelector('#demo-Tooltip [data-e2e="tooltip-live"]')
  // The trigger is found by the name it carries, not by its tag. Which element the component puts
  // the name on is the thing under test in one of the checks below, and a selector written around
  // a "button" would answer that question by not matching at all.
  const trigger = row?.querySelector("[aria-label]") ?? null
  globalThis.__verifyTooltip = {
    row,
    trigger,
    surface: trigger?.querySelector('[role="tooltip"]') ?? null,
  }
  return null
})()`

/** The hint's state and the trigger's, read in one round trip. */
const TOOLTIP_STATE = `(() => {
  const { trigger, surface } = globalThis.__verifyTooltip ?? {}
  if (!trigger || !surface) {
    return {
      ok: false, visibility: "", opacity: "", boxed: false, rects: 0, hover: false,
      surfaceHover: false, described: null, focused: false, text: "",
    }
  }
  const style = getComputedStyle(surface)
  return {
    ok: true,
    visibility: style.visibility,
    opacity: style.opacity,
    boxed: surface.getClientRects().length > 0,
    rects: surface.getClientRects().length,
    hover: trigger.matches(":hover"),
    surfaceHover: surface.matches(":hover"),
    described: trigger.getAttribute("aria-describedby"),
    focused: document.activeElement === trigger,
    text: (surface.textContent ?? "").trim().slice(0, 40),
  }
})()`

/** Whether the hint is on screen right now: visible, fully faded in, and with a box. */
const TOOLTIP_SHOWN = `(() => {
  const surface = globalThis.__verifyTooltip?.surface ?? null
  if (surface === null) return false
  const style = getComputedStyle(surface)
  return style.visibility === "visible" && style.opacity === "1" &&
    surface.getClientRects().length > 0
})()`

/**
 * Whether the browser has the trigger in `:hover` — the state the reveal rule keys on.
 *
 * `:hover` propagates up the DOM, so a pointer resting on the hint keeps the trigger in it: the
 * hint is a descendant of the trigger wrapper however far outside it the hint is painted.
 */
const TOOLTIP_HOVERED = `(globalThis.__verifyTooltip?.trigger?.matches(":hover") ?? false)`

/** Whether the surface has stopped taking up a box, which is what a dismissed hint does. */
const TOOLTIP_DISMISSED =
  `(globalThis.__verifyTooltip?.surface?.getClientRects().length ?? 1) === 0`

/**
 * Tooltip's two halves of one rule: a hint can be dismissed, and a hint can be pointed at.
 *
 * Neither half is reachable from a test that renders to a string. The dismissal is a real Escape
 * press against a `keydown` listener the component keeps attached for its whole life (`#252`), and
 * the hoverable half is the browser's own hit testing — the thing `pointer-events-none` used to
 * fail, and which nothing in rendered markup can answer.
 *
 * **What the browser can show, and what it took to get there.** Tailwind v4 compiles every hover
 * style — `hover:`, `group-hover:` — inside `@media (hover: hover)`, and headless Chromium answers
 * `(hover: none)` and `(pointer: none)` unless it is told otherwise, so for a while no hover style
 * of any kind applied here and the reveal-on-hover was not observable at all. Neither emulation
 * route covers those two features: `Emulation.setEmulatedMedia` was tried with and without a
 * `media` string, and a device metrics override too, and `matchMedia("(hover: hover)")` still
 * answered false. The lever is a Chromium launch flag, and `pages/verify.ts` now passes it — see
 * `hoverCapability` there, which asserts the browser still answers `(hover: hover)` before any of
 * these checks run. So {@link hoverRevealCheck} below drives the reveal itself, with a real
 * pointer and with focus ruled out; the focus reveal is still checked beside it, because it is a
 * second path rather than the same one; and the pointer checks go on asserting what the hit
 * testing does — that the pointer reaches the hint at all, and that the trigger stays `:hover`
 * while it rests there, because the hint is a descendant of the trigger and that is the state the
 * reveal rule keys on.
 *
 * Three habits the checks above set, and why each one is needed here.
 *
 * The trigger and the surface are parked on `globalThis` instead of re-queried. Dismissing a hint
 * takes `aria-describedby` off the trigger, so a selector written around that attribute would stop
 * matching precisely when the check needs the element it matched a moment ago.
 *
 * Every assertion is a transition, and the first of them matters more than it looks: a hint that
 * always takes the pointer would pass "the hint is under the pointer" without proving anything at
 * all. So the pointer check reads the trigger unhovered at rest, moves onto it, moves onto the
 * hint, and then watches both leave `:hover` when the pointer does.
 *
 * No coordinate is guessed. Each point is the centre of the element's own box, read back with
 * `elementFromPoint` before it is used, and the page records where the browser actually delivered
 * the move. That second reading is what tells "the component is broken" from "the move went
 * somewhere else", and it is also how the hoverable half is proven at all: with
 * `pointer-events-none` the centre of the hint reads whatever is *behind* the hint, so the
 * derivation fails and the check says so in those words.
 *
 * Nothing here throws. A missing row is a failed check naming what is missing, because an exception
 * would cost every check left in this file — including Modal's, which run after it — and replace
 * them with one failure that names `ui` rather than the row.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function tooltipChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(TOOLTIP_SETUP)
  await centreInView(devtools, `globalThis.__verifyTooltip?.row ?? null`)
  // The Dropdown checks above leave the pointer at viewport coordinates, and viewport coordinates
  // do not scroll with the page: without parking it first, the pointer can be resting on this very
  // trigger while the check reads the trigger "at rest".
  await pointerAwayFromTooltips(devtools)

  await hoverRevealCheck(devtools)

  const atRest = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  // Revealed with focus here rather than with the pointer, on purpose: this check is about what the
  // hint does once it is on screen, and focus puts it there without the pointer already being where
  // the readings below are about to move it. A hidden element is not hit-testable at all, so
  // without a hint on screen there would be nothing for a pointer to reach and the two readings
  // below would be about nothing.
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.focus(), null)`)
  const revealed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)

  const bridge = await devtools.evaluate<Bridge>(`(() => {
    const { trigger, surface } = globalThis.__verifyTooltip ?? {}
    const bubble = surface?.firstElementChild ?? null
    if (!trigger || !surface || bubble === null) {
      return { x: -1, y: -1, strip: 0, gap: -1, onTarget: false, tag: "nothing" }
    }
    const surfaceBox = surface.getBoundingClientRect()
    const bubbleBox = bubble.getBoundingClientRect()
    const triggerBox = trigger.getBoundingClientRect()
    // This hint sits below its trigger, so its bridge is the strip between the surface's own top
    // edge and the bubble's. Measured from the two boxes rather than from the utility that makes
    // it, so it is the real gap whatever the class happens to be.
    const strip = bubbleBox.top - surfaceBox.top
    const x = Math.round(surfaceBox.left + surfaceBox.width / 2)
    const y = Math.round(surfaceBox.top + strip / 2)
    const at = document.elementFromPoint(x, y)
    return {
      x,
      y,
      strip: Math.round(strip),
      gap: Math.round(surfaceBox.top - triggerBox.bottom),
      onTarget: at !== null && (at === surface || surface.contains(at)),
      tag: at === null ? "nothing" : at.tagName,
    }
  })()`)

  const onTrigger = await hoverTrigger(devtools)
  const surfaceAim = await aimAt(devtools, `globalThis.__verifyTooltip?.surface ?? null`)
  const ontoSurface = await movePointer(
    devtools,
    surfaceAim,
    `globalThis.__verifyTooltip?.surface ?? null`,
  )
  const onHint = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)
  const held = await holdsFor(() => devtools.evaluate<boolean>(TOOLTIP_HOVERED), 600)
  await pointerAwayFromTooltips(devtools)
  const left = await poll(
    () =>
      devtools.evaluate<boolean>(
        `!${TOOLTIP_HOVERED} && !(globalThis.__verifyTooltip?.surface?.matches(":hover") ?? false)`,
      ),
    3_000,
  )
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  // Teardown, and nothing may be built on it: this waits for a CSS state, which stops matching the
  // instant focus leaves, with no render in between. It says the hint is off the screen; it does
  // not say the component has re-rendered or that its effect cleanups have run.
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)

  check(
    "a Tooltip's hint takes the pointer, bridge and all, and keeps its trigger hovered",
    atRest.ok && !atRest.hover && !atRest.surfaceHover && revealed && bridge.strip >= 2 &&
      bridge.gap <= 1 && bridge.onTarget && onTrigger.hovering &&
      onTrigger.landing?.onTarget === true && surfaceAim.onTarget &&
      ontoSurface?.onTarget === true && onHint.surfaceHover && onHint.hover && held.held && left,
    !atRest.ok
      ? "the Tooltip card has no live row — nothing matched '[data-e2e=\"tooltip-live\"]' with a " +
        "button and a role=tooltip inside it"
      : atRest.hover || atRest.surfaceHover
      ? "the pointer was already resting on the trigger with the page scrolled here, so the " +
        "readings below have nothing to move from"
      : !revealed
      ? `the hint never reached the screen on focus (visibility ${atRest.visibility}, opacity ` +
        `${atRest.opacity}), and a hidden hint cannot be pointed at by anyone`
      : bridge.strip < 2
      ? `the hint has no bridge: a ${bridge.strip}px strip between the surface's edge and the ` +
        `bubble's, so whatever separates the two is not part of the hint. This measures the strip ` +
        `above the bubble, which is where the bridge is for the card's bottom-anchored row — a ` +
        `row given another placement in ui-guide/sections/display.tsx reads 0 here too`
      : bridge.gap > 1
      ? `${bridge.gap}px of dead space between the trigger and the hint's own box: a pointer ` +
        `crossing it leaves the trigger, and the hint goes before the pointer arrives`
      : !bridge.onTarget
      ? `the middle of the ${bridge.strip}px bridge at (${bridge.x}, ${bridge.y}) reads ` +
        `${bridge.tag} rather than the hint, so the way to the hint is not the hint`
      : !onTrigger.aim.onTarget
      ? `nothing of the trigger to point at: (${onTrigger.aim.x}, ${onTrigger.aim.y}) reads ` +
        `${onTrigger.aim.tag} over a ${onTrigger.aim.width}×${onTrigger.aim.height} box — this ` +
        `proves nothing`
      : onTrigger.landing === null || !onTrigger.landing.onTarget
      ? `the pointer never landed on the trigger: ${
        onTrigger.landing === null
          ? "the move never reached the page"
          : `it went to ${onTrigger.landing.tag} at (${onTrigger.landing.x}, ${onTrigger.landing.y})`
      } — a missed move, which proves nothing`
      : !onTrigger.hovering
      ? "the browser never put the trigger into :hover with the pointer delivered onto it, so " +
        "nothing here is about hovering"
      : !surfaceAim.onTarget
      ? `the hint cannot be pointed at: its own centre (${surfaceAim.x}, ${surfaceAim.y}) reads ` +
        `${surfaceAim.tag}, which is what sits behind it — the surface takes no pointer events, ` +
        `so a pointer moving towards the hint lands on the page instead`
      : ontoSurface === null || !ontoSurface.onTarget
      ? `the pointer never landed on the hint: ${
        ontoSurface === null
          ? "the move never reached the page"
          : `it went to ${ontoSurface.tag} at (${ontoSurface.x}, ${ontoSurface.y})`
      } — a missed move, which proves nothing`
      : !onHint.surfaceHover
      ? "the pointer was delivered onto the hint and the browser did not take the hint into " +
        ":hover, so the hint is not something a pointer can rest on"
      : !onHint.hover
      ? "the pointer rests on the hint and the trigger has left :hover, so the rule that reveals " +
        "the hint has stopped matching and the hint would vanish under the pointer"
      : !held.held
      ? `the trigger left :hover ${held.elapsedMs}ms after the pointer moved onto the hint, so ` +
        `the hint cannot be read by resting on it`
      : !left
      ? "the trigger stayed in :hover with the pointer back in the corner, so it never leaves it " +
        "and the readings above prove nothing"
      : `the hint's box touches its trigger (${bridge.gap}px apart) across a ${bridge.strip}px ` +
        `bridge that hit-tests to the hint at (${bridge.x}, ${bridge.y}); the hint's own centre ` +
        `reads the hint, the pointer was delivered onto it at (${ontoSurface.x}, ` +
        `${ontoSurface.y}), and hint and trigger held :hover together for ${held.elapsedMs}ms → ` +
        `both left :hover when the pointer went back to the corner`,
  )

  await escapeOverPointerCheck(devtools)
  await escapeOnFocusCheck(devtools)
  await tooltipEscapeRaceCheck(devtools)
  await tooltipNameCheck(devtools)
}

/** What the browser says is under the parked pointer, relative to the tooltip's trigger. */
interface Corner {
  /** What `elementFromPoint` reads at the parking spot. */
  tag: string
  /** `true` when the parking spot is the trigger, or something inside it — a failed parking. */
  onTrigger: boolean
}

/**
 * Hovering the trigger reveals the hint, and taking the pointer away hides it again.
 *
 * This is the component's headline behaviour and the one nothing could check until the browser was
 * told it has a mouse: Tailwind compiles `group-hover:visible` and `group-hover:opacity-100` inside
 * `@media (hover: hover)`, so in a browser that answers `(hover: none)` the reveal rule is present
 * in the stylesheet and never matches. The flag that fixes that is in `pages/verify.ts`, and
 * `hoverCapability` there fails loudly if it ever stops working — so a failure here is the
 * component rather than the environment.
 *
 * **Focus is ruled out as the revealer**, which is what keeps this from being satisfiable a second
 * way: the component reveals the hint on `group-focus-within` too, so the trigger is blurred first
 * and `document.activeElement` is read at rest *and* with the hint on screen. A reveal that
 * happened while focus sat on the trigger would prove the focus path over again and say nothing
 * about hovering.
 *
 * Both ends are asserted, because half of this is not worth having. A hint that were simply always
 * visible would pass "the hint is visible with the pointer on the trigger" without a reveal ever
 * happening, so the run is: hidden at rest → pointer on → visible → pointer away → hidden again.
 *
 * The pointer's resting place is asserted rather than assumed, at both ends. The point it moves to
 * is the centre of the trigger's own box, read back with `elementFromPoint` before the move and
 * recorded by the page as the browser delivers it, so a move that went somewhere else is reported
 * as a missed move and never as a broken tooltip. The corner it parks in is read the same way: a
 * pointer left resting on the trigger would make "hidden at rest" impossible and the reason would
 * not be the component.
 *
 * Nothing here throws. A missing row is a failed check naming what is missing.
 *
 * @param devtools The connected session, with the tooltip card parked and scrolled to.
 */
async function hoverRevealCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  // The point comes back from the helper that dispatched the move, so this reads the place the
  // pointer actually went rather than a second copy of the same two numbers.
  const parked = await pointerAwayFromTooltips(devtools)
  const corner = await devtools.evaluate<Corner>(`(() => {
    const trigger = globalThis.__verifyTooltip?.trigger ?? null
    const at = document.elementFromPoint(${parked.x}, ${parked.y})
    return {
      tag: at === null ? "nothing" : at.tagName,
      onTrigger: trigger !== null && at !== null && (at === trigger || trigger.contains(at)),
    }
  })()`)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
  const atRest = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  const onTrigger = await hoverTrigger(devtools)
  const revealed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)
  const shown = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  await pointerAwayFromTooltips(devtools)
  const hidAgain = await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "the pointer alone reveals a Tooltip's hint, and taking it away hides the hint again",
    atRest.ok && !corner.onTrigger && !atRest.focused && !atRest.hover &&
      atRest.visibility === "hidden" && onTrigger.aim.onTarget &&
      onTrigger.landing?.onTarget === true && onTrigger.hovering && revealed && !shown.focused &&
      shown.rects > 0 && hidAgain && after.visibility === "hidden",
    !atRest.ok
      ? "the Tooltip card has no live row — nothing matched '[data-e2e=\"tooltip-live\"]' with a " +
        "button and a role=tooltip inside it"
      : corner.onTrigger
      ? `the pointer parked at (${parked.x}, ${parked.y}) is still on the trigger ` +
        `(elementFromPoint reads ${corner.tag}), so there is no unhovered state to start from`
      : atRest.focused
      ? "the trigger still had focus at rest, and a hint revealed by focus would prove the focus " +
        "path over again rather than the pointer one"
      : atRest.hover
      ? "the browser still had the trigger in :hover with the pointer in the corner, so nothing " +
        "below moves from anywhere"
      : atRest.visibility !== "hidden"
      ? `the hint is already ${atRest.visibility} at opacity ${atRest.opacity} with nothing ` +
        `hovering or focusing the trigger, so it is not revealed by anything — it is simply up`
      : !onTrigger.aim.onTarget
      ? `nothing of the trigger to point at: (${onTrigger.aim.x}, ${onTrigger.aim.y}) reads ` +
        `${onTrigger.aim.tag} over a ${onTrigger.aim.width}×${onTrigger.aim.height} box — this ` +
        `proves nothing`
      : onTrigger.landing === null || !onTrigger.landing.onTarget
      ? `the pointer never landed on the trigger: ${
        onTrigger.landing === null
          ? "the move never reached the page"
          : `it went to ${onTrigger.landing.tag} at (${onTrigger.landing.x}, ` +
            `${onTrigger.landing.y})`
      } — a missed move, which proves nothing`
      : !onTrigger.hovering
      ? "the browser never put the trigger into :hover with the pointer delivered onto it, so " +
        "nothing here is about hovering"
      : shown.focused
      ? "the pointer's arrival moved focus onto the trigger, so the reveal below cannot be told " +
        "from the focus one"
      : !revealed
      ? `the hint never reached the screen with the pointer resting on the trigger: visibility ` +
        `${shown.visibility}, opacity ${shown.opacity}, ${shown.rects} client rect(s). The rule ` +
        `that reveals it is \`group-hover:visible group-hover:opacity-100\`, which a browser ` +
        `answering (hover: none) compiles and never matches — check that one first`
      : !hidAgain
      ? `the hint stayed ${after.visibility} at opacity ${after.opacity} with the pointer back in ` +
        `the corner, so it never goes away and being up while hovered means nothing`
      : `at rest the hint reads visibility ${atRest.visibility} at opacity ${atRest.opacity}, ` +
        `with focus off the trigger and the pointer parked over ${corner.tag} at (${parked.x}, ` +
        `${parked.y}) → the pointer was delivered onto ${onTrigger.landing.tag} at ` +
        `(${onTrigger.landing.x}, ` +
        `${onTrigger.landing.y}) and the hint read visibility ${shown.visibility} at opacity ` +
        `${shown.opacity} over ${shown.rects} client rect(s), with focus still off the trigger → ` +
        `the pointer went back to the corner and it reads visibility ${after.visibility} again. ` +
        `The visibility flip is the reveal, and it is what takes the hint in and out of hit ` +
        `testing; the fade beside it is sampled at ${after.opacity} here because a headless page ` +
        `only advances a transition when it paints a frame`,
  )

  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
}

/**
 * Escape dismisses the hint the pointer is on, takes its description with it, and moves no focus.
 *
 * The dismissal has to work while the pointer is on the trigger and focus is somewhere else
 * entirely, which is why the component listens on `document` rather than on the trigger: a hint
 * revealed by a pointer has no focus of its own to catch the key.
 *
 * Two transitions, and neither of them is the paint — a dismissed hint loses its box and its id,
 * so this check reads what the `hidden` attribute and `aria-describedby` do, which this browser
 * runs whatever it thinks of hover.
 *
 * The last step hovers again, and it is not a formality: "the hint is gone" is also true of a
 * component that broke itself on the key press, and only a hint that comes back has been dismissed
 * rather than destroyed.
 *
 * An earlier version of this check began with a control — pointer in the corner, press Escape,
 * assert nothing happened — to pin the listener being registered only while the trigger is
 * engaged. It is gone since `#252`: the component now keeps the listener attached for its whole
 * life and decides at press time from `hovered`/`focused` instead, which is what closed the
 * same-task race `tooltipEscapeRaceCheck` proves below. The control also raced on its own terms
 * even before that fix mattered: the check before this one blurs the trigger and waits for the
 * hint to stop being shown, but that wait watches a CSS state which stops matching the instant
 * focus leaves, with no render involved, so it could return before the old effect's cleanup had
 * removed the listener. Two runs in eight then failed on the control press landing on a listener
 * that was still attached.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function escapeOverPointerCheck(devtools: Devtools): Promise<void> {
  await pointerAwayFromTooltips(devtools)
  const hovering = await hoverTrigger(devtools)
  await devtools.evaluate<null>(`(globalThis.__verifyFocusBefore = document.activeElement, null)`)
  const before = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  // Pressed inside the poll rather than before it. Nothing here can say the component's effect has
  // attached its listener — the wait that got the pointer this far is on `:hover`, which the
  // browser flips without a render — so a single press could land before the listener does and
  // leave this waiting three seconds for a dismissal nobody heard. Escape is idempotent here: once
  // the hint is dismissed, pressing it again sets the same flag.
  const gone = await poll(async () => {
    await pressKey(devtools, "Escape")
    return await devtools.evaluate<boolean>(TOOLTIP_DISMISSED)
  }, 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)
  const focusHeld = await devtools.evaluate<boolean>(
    `document.activeElement === globalThis.__verifyFocusBefore`,
  )
  const focusName = await devtools.evaluate<string>(
    `document.activeElement === document.body ? "the page" : document.activeElement.tagName`,
  )

  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_HOVERED}`), 3_000)
  const again = await hoverTrigger(devtools)
  const back = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "a real Escape press dismisses the Tooltip under the pointer, without moving focus",
    before.ok && hovering.hovering && before.boxed && before.described !== null && gone &&
      !after.boxed && after.described === null && focusHeld && again.hovering && back.boxed &&
      back.described !== null,
    !before.ok
      ? "the Tooltip card has no live row to dismiss"
      : !before.boxed
      ? "the hint had already been dismissed before this check pressed anything, so there was " +
        "nothing here to dismiss"
      : !hovering.hovering
      ? "the pointer never took the trigger into :hover, so a dismissal here proves nothing"
      : before.described === null
      ? "the trigger described nothing before the key press, so losing the description proves " +
        "nothing"
      : !gone
      ? `the hint still had a box 3s after a real Escape press, so nothing dismissed it`
      : after.described !== null
      ? `the hint is off the page but the trigger still points at it with ` +
        `aria-describedby="${after.described}", so a screen reader still reads a dismissed hint`
      : !focusHeld
      ? `Escape moved focus to ${focusName}; dismissing a hint must leave focus where it was`
      : !again.hovering
      ? "the pointer never took the trigger into :hover again, so the hint coming back cannot be " +
        "read from this"
      : !back.boxed || back.described === null
      ? "the hint never came back on the next hover, so Escape did not dismiss it — it destroyed " +
        "it"
      : `pointer onto the trigger, then Input.dispatchKeyEvent Escape: the hint lost its box and ` +
        `the trigger dropped aria-describedby="${before.described}", with focus still on ` +
        `${focusName} → pointer away and back: the hint has its box and its description again`,
  )
}

/**
 * The same dismissal from the keyboard: a focused hint goes on Escape, and focus stays put.
 *
 * Focus is placed with `.focus()` rather than by tabbing to it. The tab order between the last
 * check and this trigger belongs to the catalogue page, not to the component, so walking it would
 * assert the page's layout; the dismissal itself is a real `Input.dispatchKeyEvent` press, which
 * is the path under test.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function escapeOnFocusCheck(devtools: Devtools): Promise<void> {
  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.focus(), null)`)
  const revealed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)
  const focused = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  // Inside the poll, for the reason the check above gives: the reveal this waited on is a CSS
  // state, so nothing has said the listener is attached yet, and a repeated Escape costs nothing.
  const gone = await poll(async () => {
    await pressKey(devtools, "Escape")
    return await devtools.evaluate<boolean>(TOOLTIP_DISMISSED)
  }, 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "keyboard focus reveals a Tooltip, and Escape dismisses it with focus still on the trigger",
    revealed && focused.focused && gone && after.focused && after.described === null,
    !focused.focused
      ? "focus never reached the trigger, so nothing here is about the keyboard"
      : !revealed
      ? "the hint never appeared on focus, so this component cannot be used without a pointer"
      : !gone
      ? `the hint was still on screen 3s after a real Escape press (visibility ` +
        `${after.visibility}, opacity ${after.opacity})`
      : !after.focused
      ? "Escape took focus off the trigger; a dismissal must leave focus where it was, or the " +
        "next Tab starts from somewhere the person never went"
      : after.described !== null
      ? `the hint is off screen but the trigger still points at it with ` +
        `aria-describedby="${after.described}"`
      : "focus → the hint appeared; a real Escape press → it lost its box, dropped the " +
        "description, and focus never left the trigger",
  )

  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  await pointerAwayFromTooltips(devtools)
}

/**
 * An Escape dispatched in the same task as the focus that reveals the hint must still dismiss it —
 * `#252`.
 *
 * `ui/tooltip.tsx`'s "Dismissible" bullet explains the shape this used to have: a `keydown`
 * listener that only (re)attached once `engaged` had caught up ran *after* the render an
 * `onFocusIn` handler already committed synchronously, so a key press landing in that gap found no
 * listener at all. This drives `focus()` and a bubbling synthetic Escape back to back inside one
 * `Runtime.evaluate`, before Preact's own scheduling gets a turn to run the effect that would have
 * (re)attached the old, gated listener — `pages/checks/system.ts`'s `siteHeaderEscapeRaceCheck` is
 * the reference this follows, two animation frames included: they let the *previous* engagement's
 * effect cleanup finish first, so a listener left over from an earlier press is not what this one
 * accidentally passes against.
 *
 * `Input.dispatchKeyEvent` is not used here, unlike the two checks above: those exist to prove a
 * *trusted* key press reaches the listener. This one is not about trust — a plain
 * `document.addEventListener("keydown", …)` reacts to an untrusted, synthetic event exactly the
 * same way, and what is in question is only whether a listener exists at the instant the press
 * lands, which a same-task synthetic dispatch settles on its own.
 *
 * The dismissal itself lands through a render — `dismissed.value = true` takes the `hidden`
 * attribute and `aria-describedby` off through Preact's own scheduling, not a direct DOM write —
 * so unlike `siteHeaderEscapeRaceCheck`'s `details.open`, this cannot read the outcome inside the
 * same `Runtime.evaluate` call the press was sent in. Only the focus and the key press have to
 * land in the same task; reading the result afterwards, once the render has had a chance to run,
 * still proves the listener was there when the press arrived; a stale listener from a pathological
 * old build would only make this check pass *late*, and the 3s poll bounds how late.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function tooltipEscapeRaceCheck(devtools: Devtools): Promise<void> {
  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)

  const dispatched = await devtools.evaluate<boolean>(`(async () => {
    // Let the previous engagement's effect cleanup finish first — see the JSDoc above.
    for (let k = 0; k < 2; k++) {
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
    }
    const trigger = globalThis.__verifyTooltip?.trigger ?? null
    if (!trigger) return false
    // Same task, back to back: the focus that engages the trigger, then the Escape.
    trigger.focus()
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
    return true
  })()`)

  const dismissed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_DISMISSED), 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "an Escape dispatched in the same task as the focus that reveals the hint still dismisses it",
    dispatched && dismissed && after.described === null,
    !dispatched
      ? "the Tooltip card has no live row to focus"
      : !dismissed
      ? "the hint still had a box 3s after focus() and a same-task Escape dispatch — the listener " +
        "was not there yet when the press landed"
      : `dismissed, and aria-describedby reads ${JSON.stringify(after.described)}`,
  )

  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
}

/**
 * Chromium names the trigger and reads the hint as its description.
 *
 * This is the one thing the browser can settle that markup cannot: `aria-label` on an element with
 * no role is not guaranteed to reach the accessibility tree, so the old `<span tabindex="0">`
 * could carry a name and a description that nothing ever read. Asking Chromium for the node's own
 * computed role, name and description is asking the tree itself.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function tooltipNameCheck(devtools: Devtools): Promise<void> {
  await devtools.send("DOM.enable")
  await devtools.send("Accessibility.enable")
  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: 1,
  })
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: `#demo-Tooltip [data-e2e="tooltip-live"] [aria-label]`,
  })

  const atRest = await computedNode(devtools, nodeId)
  // That first reading is evidence, not an assertion. The check before this one left the hint
  // dismissed, so it is `display: none` and Chromium reads no description off it at all — which is
  // the dismissal doing its job rather than anything about naming. The reading that answers "is
  // the hint this trigger's description" is the one taken with the hint on screen, which is why
  // the trigger is focused for it.
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.focus(), null)`)
  await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)
  const computed = await computedNode(devtools, nodeId)
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)

  check(
    "Chromium names the Tooltip's trigger and reads its hint as the description",
    nodeId !== 0 && computed.role === "button" && computed.name.length > 0 &&
      computed.description.length > 0 && computed.name !== computed.description,
    nodeId === 0
      ? "the Tooltip card has no live row for Chromium to read"
      : computed.role !== "button"
      ? `Chromium reads the trigger as "${computed.role}" — a name and a description on an ` +
        `element with no role of its own may never reach the accessibility tree at all ` +
        `(name "${computed.name}", description "${computed.description}")`
      : computed.name.length === 0
      ? "Chromium computes no name for the trigger, so it announces as an unnamed button"
      : computed.description.length === 0
      ? `Chromium computes no description for the trigger named "${computed.name}", so the hint ` +
        `is never read out`
      : computed.name === computed.description
      ? `the hint is the trigger's name as well as its description ("${computed.name}"), so it ` +
        `is not supplementary to anything`
      : `Chromium reads a ${computed.role} named "${computed.name}", described by ` +
        `"${computed.description}" while the hint is on screen; with the hint dismissed by the ` +
        `check before this one it reads a ${atRest.role} named "${atRest.name}" described by ` +
        `"${atRest.description}", so a dismissed hint is not announced either`,
  )

  await groupTriggerNameCheck(devtools)
}

/**
 * The other trigger shape, asked of the same tree: `focusable={false}`.
 *
 * The `role="group"` wrapper is the documented limit of this component's design — the caller's own
 * control owns the name a reader announces on focus, and the group carries the hint — so it is the
 * variant most likely to surprise somebody, and until now the only one proven by a rendered string
 * alone. "An element that may carry a name" is exactly the question the other path came to the
 * browser to answer, so this path is asked it too.
 *
 * The catalogue already renders it: the card's `Archive` hint wraps a real `<button>` and pins its
 * surface open with `contentClass`, so there is nothing to reveal first.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function groupTriggerNameCheck(devtools: Devtools): Promise<void> {
  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: 1,
  })
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: root.nodeId,
    // Not `[role="group"]`: which role the wrapper carries is the question, and a selector that
    // asked for the answer would report a missing card instead of a wrong role.
    selector: `#demo-Tooltip [aria-label]:has(button)`,
  })
  const computed = await computedNode(devtools, nodeId)
  const inner = await devtools.evaluate<{ buttons: number; tabStops: number; label: string }>(
    `(() => {
      const group = document.querySelector('#demo-Tooltip [aria-label]:has(button)')
      const buttons = [...(group?.querySelectorAll("button") ?? [])]
      return {
        buttons: buttons.length,
        tabStops: buttons.length + (group?.hasAttribute("tabindex") ? 1 : 0),
        label: (buttons[0]?.textContent ?? "").trim().slice(0, 30),
      }
    })()`,
  )

  check(
    "Chromium reads a name and the hint off a Tooltip that wraps an interactive trigger",
    nodeId !== 0 && computed.role === "group" && computed.name.length > 0 &&
      computed.description.length > 0 && computed.name !== computed.description &&
      inner.buttons === 1 && inner.tabStops === 1,
    nodeId === 0
      ? `the Tooltip card renders no focusable={false} hint for Chromium to read`
      : computed.role !== "group"
      ? `Chromium reads the wrapper as "${computed.role}" rather than a group, so the name ` +
        `"${computed.name}" and the description "${computed.description}" are on an element the ` +
        `tree may drop`
      : computed.name.length === 0 || computed.description.length === 0
      ? `Chromium reads a ${computed.role} named "${computed.name}" described by ` +
        `"${computed.description}" — a hint that reaches nobody`
      : computed.name === computed.description
      ? `the hint is the group's name as well as its description ("${computed.name}")`
      : inner.tabStops !== 1
      ? `${inner.tabStops} tab stops for one control: the wrapper kept a tab stop of its own ` +
        `beside the ${inner.buttons} it wraps`
      : `Chromium reads a ${computed.role} named "${computed.name}", described by ` +
        `"${computed.description}", around one control ("${inner.label}") that keeps the single ` +
        `tab stop`,
  )
}

/**
 * Ask Chromium for one node's own computed role, name and description.
 *
 * @param devtools The connected session.
 * @param nodeId The DOM node, or `0` when the selector matched nothing.
 */
async function computedNode(devtools: Devtools, nodeId: number): Promise<Named> {
  if (nodeId === 0) return { role: "", name: "", description: "" }
  const { nodes } = await devtools.send<{
    nodes: Array<{
      role?: { value?: string }
      name?: { value?: string }
      description?: { value?: string }
    }>
  }>("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false })

  return {
    role: (nodes[0]?.role?.value ?? "").trim(),
    name: (nodes[0]?.name?.value ?? "").trim(),
    description: (nodes[0]?.description?.value ?? "").trim(),
  }
}

/** A hover of the tooltip trigger, with everything a failure message needs to explain itself. */
interface Hovered {
  aim: Aim
  landing: Landing | null
  /** `true` when the browser put the trigger into `:hover` within the budget. */
  hovering: boolean
  /** What the hint looked like once the pointer had arrived. */
  state: TooltipState
}

/**
 * Point at the tooltip's trigger and wait for the hint.
 *
 * @param devtools The connected session.
 * @returns The derivation, where the move landed, and whether the browser took the trigger into
 * `:hover` — so a caller can tell a component that did nothing from a pointer that never arrived.
 */
async function hoverTrigger(devtools: Devtools): Promise<Hovered> {
  const aim = await aimAt(devtools, `globalThis.__verifyTooltip?.trigger ?? null`)
  const landing = await movePointer(devtools, aim, `globalThis.__verifyTooltip?.trigger ?? null`)
  const hovering = await poll(() => devtools.evaluate<boolean>(TOOLTIP_HOVERED), 3_000)
  const state = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  return { aim, landing, hovering, state }
}

/**
 * Derive the centre of an element, and read back what sits at that point.
 *
 * The reading is the half that makes the point worth using: a coordinate on its own is a guess,
 * and `elementFromPoint` is the browser's own answer to what a press there would hit.
 *
 * @param devtools The connected session.
 * @param element A page expression for the element to aim at, or `null`.
 */
async function aimAt(devtools: Devtools, element: string): Promise<Aim> {
  return await devtools.evaluate<Aim>(`(() => {
    const element = ${element}
    if (element === null || element === undefined) {
      return { x: -1, y: -1, inViewport: false, onTarget: false, tag: "nothing", width: 0, height: 0 }
    }
    const box = element.getBoundingClientRect()
    const x = Math.round(box.left + box.width / 2)
    const y = Math.round(box.top + box.height / 2)
    const at = document.elementFromPoint(x, y)
    const inViewport = x >= 0 && y >= 0 && x < globalThis.innerWidth && y < globalThis.innerHeight
    return {
      x,
      y,
      inViewport,
      onTarget: inViewport && at !== null && (at === element || element.contains(at)),
      tag: at === null ? "nothing" : at.tagName,
      width: Math.round(box.width),
      height: Math.round(box.height),
    }
  })()`)
}

/**
 * Move the pointer to a derived point, and report where the browser actually delivered it.
 *
 * The recorder is installed before the move and fires once, in the capture phase: once a hint is
 * hidden again, no re-reading of the point can say what was under the pointer when it arrived.
 *
 * @param devtools The connected session.
 * @param aim The point, from {@link aimAt}.
 * @param target A page expression for the element the move was aimed at.
 * @returns What the page saw, or `null` when the move never reached it.
 */
async function movePointer(devtools: Devtools, aim: Aim, target: string): Promise<Landing | null> {
  await devtools.evaluate<null>(`(() => {
    const target = ${target}
    globalThis.__verifyPointer = null
    document.addEventListener("mouseover", (event) => {
      globalThis.__verifyPointer = {
        onTarget: target !== null && target !== undefined &&
          (target === event.target || target.contains(event.target)),
        tag: event.target === null ? "nothing" : event.target.tagName,
        x: event.clientX,
        y: event.clientY,
      }
    }, { capture: true, once: true })
    return null
  })()`)
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: aim.x,
    y: aim.y,
    button: "none",
    buttons: 0,
  })

  return await devtools.evaluate<Landing | null>(`globalThis.__verifyPointer ?? null`)
}

/** The corner {@link pointerToCorner} parks the pointer in, in viewport coordinates. */
const POINTER_CORNER = { x: 2, y: 2 } as const

/**
 * Park the pointer in the viewport's top-left corner, clear of any card.
 *
 * Viewport coordinates do not scroll with the page, so a pointer left over one card ends up
 * resting on another as soon as the next check scrolls to it.
 *
 * The coordinate comes back rather than being written down again by a caller that wants to read
 * what is under the parked pointer. Two copies of the same two numbers in two functions would come
 * apart the moment the corner moved, and the guard that reads the corner would then be reading a
 * point the pointer is not at — with nothing going red to say so.
 *
 * @param devtools The connected session.
 * @returns Where the pointer now is.
 */
async function pointerToCorner(devtools: Devtools): Promise<{ x: number; y: number }> {
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: POINTER_CORNER.x,
    y: POINTER_CORNER.y,
    button: "none",
    buttons: 0,
  })

  return POINTER_CORNER
}

/**
 * Park the pointer clear of every Tooltip in the catalogue's own demo card, for the checks in this
 * file that drive that card.
 *
 * {@link pointerToCorner}'s top-left corner is not clear of it: the card pins five of its six
 * tooltips permanently open (`contentClass="visible opacity-100"`) so the catalogue can show every
 * placement at once — `top`, `right`, `bottom` and two more besides the one row left to hover — and
 * `centreInView` scrolls the page to centre the card's *last* row (the one check that reveals its
 * own hint on hover). On a viewport shorter than the card — the 780×493 this harness actually
 * measured running, not the 800×600 assumed here before that measurement — that scroll leaves the
 * card's *top* row, and the bubbles pinned above and around it (including the `bottom`-placed one,
 * which anchors *below* its own trigger and so reaches past the row nominally above it), sitting
 * within a few pixels of the viewport's own top-left corner. A pointer parked there lands on one of
 * those bubbles instead of clear space: the bubble is a descendant of its own trigger and takes
 * pointer events by design (`ui/tooltip.tsx`'s "Hoverable" bullet), so landing on it puts that
 * *other* Tooltip into `:hover` — and a real Escape pressed while the pointer sits there, meant for
 * the row under test, dismisses whichever pinned tooltip the corner happened to land on instead.
 * Found by watching the group wrapper around the `Archive` hint lose its description this way, well
 * after the check driving it had moved the pointer elsewhere on purpose — the corner was never
 * involved as far as that check's own steps went.
 *
 * The bottom-right corner was picked as clear of all of that, but only because it happens to sit on
 * the page's own vertical scrollbar rather than on the card at all — an accident of this viewport's
 * width, not a property of the card's layout the way the doc comment above describes it. So this
 * checks the actual landing spot with `elementFromPoint` before handing it back, and fails loudly —
 * a check failure, not a silent bad read — if it lands inside a tooltip bubble or its trigger,
 * rather than trusting the corner forever.
 *
 * @param devtools The connected session.
 * @returns Where the pointer now is.
 */
async function pointerAwayFromTooltips(devtools: Devtools): Promise<{ x: number; y: number }> {
  const { x, y } = await devtools.evaluate<{ x: number; y: number }>(
    `({ x: innerWidth - 4, y: innerHeight - 4 })`,
  )
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
    buttons: 0,
  })

  const landedInTooltip = await devtools.evaluate<boolean>(
    `(() => {
      const target = document.elementFromPoint(${x}, ${y})
      if (target === null) return false
      if (target.closest('[role="tooltip"]') !== null) return true
      const described = target.closest("[aria-describedby]")
      if (described === null) return false
      return [...described.getAttribute("aria-describedby").split(/\\s+/)]
        .some((id) => document.getElementById(id)?.getAttribute("role") === "tooltip")
    })()`,
  )
  if (landedInTooltip) {
    throw new Error(
      `pointerAwayFromTooltips's landing spot (${x}, ${y}) is inside a tooltip or its trigger ` +
        `on this run's viewport — pick a different clear spot rather than trusting the corner`,
    )
  }

  return { x, y }
}

/** Which row the browser has under the pointer, and what the two rows are painted. */
interface Painted {
  /** `true` when the row aimed at is the one in `:hover`. */
  hovered: boolean
  /** `true` when a row nobody pointed at is in `:hover`, which would make the reading meaningless. */
  plain: boolean
  hoveredBackground: string
  plainBackground: string
}

/** What one read of a combobox says about its list, its highlight and its status message. */
interface ComboboxReading {
  /** `false` when the card has no combobox under the parked id; every other field is then noise. */
  ok: boolean
  expanded: string | null
  /** `true` while the popup carries the `hidden` attribute. */
  listHidden: boolean
  options: number
  /** `aria-activedescendant` of the input, or `null` when nothing is highlighted. */
  active: string | null
  /** The highlighted row's text, cut short, or `""` when nothing is highlighted. */
  activeText: string
  /** `true` when `aria-activedescendant` names an element the page no longer holds. */
  activeDangles: boolean
  describedBy: string | null
  /** The live region's role, or `null` when the component renders no region at all. */
  statusRole: string | null
  statusLive: string | null
  statusAtomic: string | null
  statusText: string
  /** How many element children the region holds; `0` is the empty region the field starts with. */
  statusChildren: number
  inputValue: string
  /** The popup's scroll position and box, which is where a highlight goes to get lost. */
  scrollTop: number
  clientHeight: number
  scrollHeight: number
  /** `true` when the highlighted row's own box lies inside the popup's visible band. */
  activeInView: boolean
  /** The page's own scroll position: `scrollIntoView` moves every scrollable ancestor it has. */
  pageScrollY: number
}

/**
 * Park one combobox's input and popup on `globalThis`.
 *
 * @param id The `id` the catalogue gave the input, which is also the base of every derived id.
 */
function comboboxSetup(id: string): string {
  return `(() => {
    const id = ${JSON.stringify(id)}
    globalThis.__verifyCombobox = {
      id,
      input: document.getElementById(id),
      list: document.getElementById(id + "-listbox"),
    }
    return null
  })()`
}

/**
 * The parked combobox's list, highlight, live region and popup geometry, in one round trip.
 *
 * The region is looked up by the id the component derives rather than by `role="status"`: a reading
 * has to be able to say "this field has none" without a selector coming back empty because it
 * found some other component's region instead.
 *
 * `statusText` is the whole answer to "what would a reader be told", and `statusChildren` separates
 * the two ways of being empty — a region holding an empty message element, and a region holding
 * nothing at all.
 */
const COMBOBOX_STATE = `(() => {
  const { id, input, list } = globalThis.__verifyCombobox ?? {}
  if (!input || !list) {
    return {
      ok: false, expanded: null, listHidden: false, options: -1, active: null, activeText: "",
      activeDangles: false,
      describedBy: null, statusRole: null, statusLive: null, statusAtomic: null, statusText: "",
      statusChildren: -1, inputValue: "",
      scrollTop: -1, clientHeight: -1, scrollHeight: -1, activeInView: false, pageScrollY: -1,
    }
  }
  const status = document.getElementById(id + "-status")
  const active = input.getAttribute("aria-activedescendant")
  const row = active === null ? null : document.getElementById(active)
  return {
    ok: true,
    expanded: input.getAttribute("aria-expanded"),
    listHidden: list.hidden,
    options: list.querySelectorAll('[role="option"]').length,
    active,
    activeText: (row?.textContent ?? "").trim().slice(0, 40),
    activeDangles: active !== null && row === null,
    describedBy: input.getAttribute("aria-describedby"),
    statusRole: status?.getAttribute("role") ?? null,
    statusLive: status?.getAttribute("aria-live") ?? null,
    statusAtomic: status?.getAttribute("aria-atomic") ?? null,
    statusText: (status?.textContent ?? "").trim().slice(0, 40),
    statusChildren: status?.childElementCount ?? -1,
    inputValue: input.value,
    scrollTop: Math.round(list.scrollTop),
    clientHeight: Math.round(list.clientHeight),
    scrollHeight: Math.round(list.scrollHeight),
    activeInView: row !== null && row.offsetTop >= list.scrollTop - 1 &&
      row.offsetTop + row.offsetHeight <= list.scrollTop + list.clientHeight + 1,
    pageScrollY: Math.round(globalThis.scrollY),
  }
})()`

/**
 * Combobox's three browser-only rules, each driven on the card built for it.
 *
 * What a rendered string cannot reach: whether a field nobody has touched stays silent *and* still
 * answers once it is opened, where a popup is scrolled to, and which element a pointer move leaves
 * `aria-activedescendant` pointing at. The card carries a list of 27 offsets and a list of none
 * precisely so these three have the shapes they need — a long list for a highlight to fall off, and
 * an empty one for a field to say nothing about.
 *
 * Every point is derived from an element's own box and read back with `elementFromPoint` before it
 * is used, and every press records where the browser delivered it, so a missed press reports itself
 * as a missed press rather than as a broken component. Nothing here throws: a card that lost a
 * combobox is a failed check naming the id it could not find.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function comboboxChecks(devtools: Devtools): Promise<void> {
  await liveRegionChecks(devtools)
  await untouchedComboboxCheck(devtools)
  await arrivingOptionsCheck(devtools)
  await highlightChecks(devtools)
  await reopenCheck(devtools)
}

/** One reading of the parked live region: what it is, what it holds, and what it has recorded. */
interface RegionReading {
  /** `false` when the page holds no such region at all; every other field is then noise. */
  ok: boolean
  /**
   * `false` when there was no region to park while the field was empty.
   *
   * That is the defect itself rather than a broken check, so it is reported apart from `ok`: the
   * page can hold a perfectly good region carrying the right words and still have built it around
   * the message a moment ago.
   */
  parkedOk: boolean
  role: string | null
  live: string | null
  atomic: string | null
  /** Everything a reader would be told, trimmed. `""` is the empty region the field starts with. */
  text: string
  children: number
  /** `true` when the region the page holds now is the very element parked before the field was used. */
  same: boolean
  /** `true` when the parked element is still in the document. */
  connected: boolean
  /** Mutation records the observer saw **on that node itself**. */
  mutations: number
  added: number
  removed: number
  /** The region's own height in pixels; `0` is what an empty one must cost. */
  height: number
  /** Border, padding, margin and `min-height`, so "no box" is reported rather than implied. */
  box: string
}

/** What a parent of a whole combobox is charged for the region inside it, one layout mode a row. */
interface RegionCost {
  name: string
  withRegion: number
  without: number
  cost: number
}

/** The id of the catalogue field these checks own, and the base of its derived ids. */
const ANNOUNCE_ID = "guide-combobox-announce"

/**
 * Park that field's live region and start watching it, while it is still empty.
 *
 * The observer is attached to the **region itself** with `childList`, and the callback throws away
 * any record whose target is not that node. This is what makes the check unable to pass against the
 * old code: a region that is created along with its message is a child arriving in the region's
 * *parent*, and an observer given the parent with `subtree` would count that as a change. Given the
 * node itself, an observer records nothing at all when the page replaces it — which is exactly the
 * difference being asserted.
 */
const REGION_PARK = `(() => {
  const region = document.getElementById(${JSON.stringify(`${ANNOUNCE_ID}-status`)})
  if (region === null) return false
  const parked = { region, mutations: 0, added: 0, removed: 0 }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target !== region) continue
      parked.mutations += 1
      parked.added += record.addedNodes.length
      parked.removed += record.removedNodes.length
    }
  })
  observer.observe(region, { childList: true })
  parked.observer = observer
  globalThis.__verifyRegion = parked
  return true
})()`

/** What {@link REGION_RELEASE} reports about the observer it took down. */
interface RegionRelease {
  /** `true` when nothing was ever parked, so there is nothing to report and nothing to clean up. */
  idle: boolean
  /** Records a deliberate poke produced **before** the disconnect: positive means it was watching. */
  watching: number
  /** Records the same poke produced **after** it: anything but zero means it is watching still. */
  watchingStill: number
  /** `true` when the global is off the page. */
  gone: boolean
}

/**
 * Stop watching the region, prove it stopped, and take the global off the page.
 *
 * A live observer is a cost every later check pays — `pages/checks/system.ts` disconnects its own
 * for the same reason — and this file's longest block, Modal's, runs after these.
 *
 * The proof is two pokes around the disconnect, each read with `takeRecords()` rather than through
 * the callback: a `MutationObserver` delivers its callback in a microtask, so a tally read in the
 * same turn would be unchanged whether it is connected or not, while `takeRecords()` answers
 * synchronously. A stray comment node is the poke, appended and removed again, so the page is left
 * exactly as it was found.
 *
 * Safe to run when nothing was ever parked: the path out of a failed precondition runs it too.
 */
const REGION_RELEASE = `(() => {
  const parked = globalThis.__verifyRegion ?? null
  const region = parked?.region ?? null
  if (parked === null || region === null) {
    delete globalThis.__verifyRegion
    return { idle: true, watching: -1, watchingStill: -1, gone: true }
  }
  const poke = () => {
    const comment = document.createComment("release probe")
    region.appendChild(comment)
    comment.remove()
    return parked.observer.takeRecords().length
  }
  const watching = poke()
  parked.observer.disconnect()
  const watchingStill = poke()
  delete globalThis.__verifyRegion
  return { idle: false, watching, watchingStill, gone: globalThis.__verifyRegion === undefined }
})()`

/** The parked region as it stands now, identity and observer tally included. */
const REGION_STATE = `(() => {
  const parked = globalThis.__verifyRegion ?? null
  const region = document.getElementById(${JSON.stringify(`${ANNOUNCE_ID}-status`)})
  if (region === null) {
    return {
      ok: false, parkedOk: parked !== null, role: null, live: null, atomic: null, text: "",
      children: -1, same: false, connected: false, mutations: -1, added: -1, removed: -1,
      height: -1, box: "",
    }
  }
  const style = getComputedStyle(region)
  return {
    ok: true,
    parkedOk: parked !== null,
    role: region.getAttribute("role"),
    live: region.getAttribute("aria-live"),
    atomic: region.getAttribute("aria-atomic"),
    text: (region.textContent ?? "").trim().slice(0, 60),
    children: region.childElementCount,
    same: parked !== null && region === parked.region,
    connected: parked !== null && parked.region.isConnected,
    mutations: parked?.mutations ?? -1,
    added: parked?.added ?? -1,
    removed: parked?.removed ?? -1,
    height: Math.round(region.getBoundingClientRect().height),
    box: [
      style.borderTopWidth, style.borderBottomWidth, style.paddingTop, style.paddingBottom,
      style.marginTop, style.marginBottom, style.minHeight,
    ].join(" "),
  }
})()`

/**
 * What a host's container is charged for the always-present region, in six layout modes.
 *
 * The question a host actually faces is not what the region measures but what its *parent* spaces,
 * and the answer turns on where the region lives. `SWUpdater`'s region is the component's whole
 * output, so a host's `flex` or `grid` gap is charged for it; this one is a child of the combobox's
 * own root, so what the host lays out is one combobox-shaped box either way.
 *
 * Measured rather than argued: the real field is cloned into each parent, the parent is measured,
 * the clone's region is taken out, and the parent is measured again. The clone is mounted off
 * screen and removed before the expression returns.
 */
const REGION_COST = `(() => {
  const region = document.getElementById(${JSON.stringify(`${ANNOUNCE_ID}-status`)})
  const root = region?.parentElement ?? null
  if (root === null) return { ok: false, rows: [] }
  const host = document.createElement("div")
  host.style.cssText = "position:absolute;left:-10000px;top:0;width:320px"
  document.body.appendChild(host)
  const modes = [
    ["block flow, no spacing", ""],
    ["block flow with space-y-4", "space-y-4"],
    ["flex column with gap-4", "flex flex-col gap-4"],
    ["flex column with space-y-4", "flex flex-col space-y-4"],
    ["grid with gap-4", "grid gap-4"],
    ["grid with space-y-4", "grid space-y-4"],
  ]
  const rows = modes.map(([name, cls]) => {
    const parent = document.createElement("div")
    parent.className = cls
    const first = document.createElement("p")
    first.style.cssText = "height:24px;margin:0"
    const last = first.cloneNode(true)
    const field = root.cloneNode(true)
    parent.append(first, field, last)
    host.appendChild(parent)
    const withRegion = Math.round(parent.getBoundingClientRect().height)
    field.querySelector('[role="status"]')?.remove()
    const without = Math.round(parent.getBoundingClientRect().height)
    return { name, withRegion, without, cost: withRegion - without }
  })
  host.remove()
  return { ok: true, rows }
})()`

/**
 * The accessible **description** the browser computes for one element, as the tree reports it.
 *
 * Read over the DevTools Protocol rather than from the markup, because "described by an element
 * that happens to be empty" and "not described at all" are the same attribute and different trees,
 * and it is the tree a screen reader reads.
 *
 * @param devtools The connected session.
 * @param selector A CSS selector for the element.
 * @returns The description, `""` when the tree reports none, or `null` when it could not be read.
 */
async function accessibleDescription(
  devtools: Devtools,
  selector: string,
): Promise<string | null> {
  try {
    await devtools.send("Accessibility.enable")
    const document_ = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
      depth: 0,
    })
    const found = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
      nodeId: document_.root.nodeId,
      selector,
    })
    if (!found.nodeId) return null
    // `description` is a computed string — `{ type, value }` — and it is absent altogether when the
    // browser computes none. An earlier revision read `description.value.value`, which is undefined
    // for every node, so the check passed against an input that really was described: the break
    // that would not go red is what found it.
    const tree = await devtools.send<{ nodes: Array<{ description?: { value?: string } }> }>(
      "Accessibility.getPartialAXTree",
      { nodeId: found.nodeId, fetchRelatives: false },
    )
    const node = tree.nodes.at(0)
    if (node === undefined) return null
    return node.description?.value ?? ""
  } catch {
    return null
  }
}

/**
 * The live region the combobox keeps: there before it is needed, and changed rather than replaced.
 *
 * Three things a rendered string cannot show, and one of them is the whole issue. That the region
 * is in the page before anybody has touched the field, a unit test can pin. That a message *arrives
 * as a change to that same element* cannot be pinned anywhere but here, and it is the difference
 * between a screen reader announcing the count and saying nothing at all: assistive technology
 * announces a change to a region it is already watching, and commonly ignores a region that turns
 * up with its message already inside it.
 *
 * So the element is parked while it is genuinely empty and compared by identity afterwards, and a
 * `MutationObserver` is attached to that same node beforehand. A check that merely found "a status
 * region with the right text in it" after typing would pass against the old code just as well; both
 * of these go red on it, which the pull request shows by doing it.
 *
 * The field is the card's own, driven by nothing else, and both its strings come from props the
 * card passes — so no English default hard-coded anywhere could satisfy what is read back.
 *
 * The observer and the global it is parked on are taken down on every way out of here, a failed
 * precondition and a throw included, which is what the `finally` is for: the checks that follow —
 * Modal's among them, and they are the longest in this file — should not pay for one still
 * watching the combobox card.
 *
 * @param devtools The connected session, on a hydrated page, before the card has been touched.
 */
async function liveRegionChecks(devtools: Devtools): Promise<void> {
  let release: RegionRelease = { idle: true, watching: -1, watchingStill: -1, gone: false }
  try {
    await runLiveRegionChecks(devtools)
  } finally {
    release = await devtools.evaluate<RegionRelease>(REGION_RELEASE).catch(() => release)
  }

  check(
    "the Combobox live-region checks leave nothing watching the page behind them",
    !release.idle && release.watching > 0 && release.watchingStill === 0 && release.gone,
    release.idle
      ? `no region was ever parked, so the checks above proved nothing and there was nothing to ` +
        `take down`
      : release.watching <= 0
      ? `the observer recorded nothing for a deliberate change to the region it was given, so it ` +
        `was not watching during the checks above and their evidence is worth nothing`
      : release.watchingStill !== 0
      ? `the observer still records changes to the region (${release.watchingStill} for one ` +
        `deliberate poke) after these checks finished: every package block below this one, ` +
        `Modal's included, would pay for it`
      : !release.gone
      ? `the observer is disconnected but globalThis.__verifyRegion is still on the page`
      : `one deliberate change to the region produced ${release.watching} record(s) while the ` +
        `checks ran and ${release.watchingStill} after the disconnect, and the global is off the ` +
        `page`,
  )
}

/**
 * The checks themselves — see {@link liveRegionChecks}, which owns parking and releasing the page.
 *
 * @param devtools The connected session, on a hydrated page, before the card has been touched.
 */
async function runLiveRegionChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup(ANNOUNCE_ID))
  await scrollToParked(devtools)
  const parked = await devtools.evaluate<boolean>(REGION_PARK)
  const pristine = await devtools.evaluate<RegionReading>(REGION_STATE)
  const field = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  const cost = await devtools.evaluate<{ ok: boolean; rows: RegionCost[] }>(REGION_COST)
  const describedBefore = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)

  const noBox = pristine.box === "0px 0px 0px 0px 0px 0px 0px"
  const charged = cost.rows.filter((row) => row.cost !== 0)
  const costTable = cost.rows.map((row) => `${row.name} ${row.cost}px`).join(", ")

  check(
    "a Combobox's live region is in the page, empty and costing nothing, before the field is used",
    parked && pristine.ok && pristine.role === "status" && pristine.live === "polite" &&
      pristine.atomic === "true" && pristine.text === "" && pristine.children === 0 &&
      pristine.height === 0 && noBox && field.ok && field.expanded === "false" &&
      cost.ok && charged.length === 0,
    !parked || !pristine.ok
      ? `the Combobox card has no live region with id ${ANNOUNCE_ID}-status, so there is nothing ` +
        `for a message to arrive in`
      : field.expanded !== "false"
      ? `the field was already open (aria-expanded ${field.expanded}) when this ran, so it is not ` +
        `the untouched state this check is about`
      : pristine.role !== "status" || pristine.live !== "polite" || pristine.atomic !== "true"
      ? `the region is marked role="${pristine.role}" aria-live="${pristine.live}" ` +
        `aria-atomic="${pristine.atomic}", and a reader announces a polite, atomic status`
      : pristine.text !== "" || pristine.children !== 0
      ? `an untouched field's region already reads "${pristine.text}" in ${pristine.children} ` +
        `element(s) — nobody has asked it anything`
      : pristine.height !== 0 || !noBox
      ? `the empty region is ${pristine.height}px tall with border/padding/margin/min-height of ` +
        `${pristine.box}, so it takes space on a field that is saying nothing`
      : !cost.ok
      ? "the region's own root could not be cloned, so what a parent is charged was not measured"
      : charged.length > 0
      ? `a parent holding the whole field is charged ${
        charged.map((row) => `${row.cost}px in a ${row.name}`).join(", ")
      } for the empty region`
      : `role="status" aria-live="polite" aria-atomic="true", 0 element children, text "", 0px ` +
        `tall with border/padding/margin/min-height ${pristine.box} — and a parent holding the ` +
        `whole field is charged nothing for it in any layout mode: ${costTable}`,
  )

  await countArrivesCheck(devtools, pristine)
  const describedCounting = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)
  await emptyMessageCheck(devtools)
  await describedByCheck(devtools, describedBefore, describedCounting)

  // Putting the page back for the checks below, not an assertion: every reading this block makes
  // has been taken and asserted by now, and nothing after this line is read.
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/**
 * What the browser computes as the input's accessible description, in each state the region has.
 *
 * Read out of the accessibility tree over the protocol rather than off the markup, because
 * "described by an element that happens to be empty" and "not described at all" are the same
 * attribute and different trees, and it is the tree a reader reads.
 *
 * The rule being pinned is that the description follows the empty message and only the empty
 * message. It is a transition, so all of it is asserted: nothing on an untouched field, nothing
 * while a count is in the region, the message once the query matches nothing, still the message on
 * the closed field the query was abandoned on — which is the state a server-filtered field is
 * rendered in, and the one the description exists for, since a live region announces a change and
 * says nothing at all when focus arrives — and nothing again once the field is cleared.
 *
 * @param devtools The connected session, with the field open and the empty message in its region.
 * @param untouched The description read before the field was touched.
 * @param counting The description read while the region held the count.
 */
async function describedByCheck(
  devtools: Devtools,
  untouched: string | null,
  counting: string | null,
): Promise<void> {
  const message = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)

  // Tab leaves the input for the clear button, which the component treats as a leave: the list
  // closes and the query stays, so this is the abandoned-query state a person reaches by walking
  // away from a search — and the state a controlled `query` renders on its own.
  //
  // The poll's answer is kept and asserted rather than waited on and dropped. The fourth reading
  // is the same string as the third, so a field that never closed produces a line saying "closed
  // on the abandoned query" that is indistinguishable from the real thing: deleting this key
  // press left the check green and the line unchanged until the answer went into the condition.
  await pressKey(devtools, "Tab")
  const listClosed = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`),
    3_000,
  )
  const closed = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)

  const clear = `globalThis.__verifyCombobox?.input?.parentElement?.querySelector("button") ?? null`
  const pressed = await clickAt(devtools, await aimAt(devtools, clear), clear)
  const regionEmptied = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === ""`),
    3_000,
  )
  const emptied = await accessibleDescription(devtools, `#${ANNOUNCE_ID}`)

  const readings = [untouched, counting, message, closed, emptied]
  const named =
    `untouched "${untouched}", counting "${counting}", nothing matching "${message}", ` +
    `closed on the abandoned query "${closed}", cleared "${emptied}"`

  check(
    "a Combobox's input is described by its live region for the empty message alone",
    !readings.includes(null) && untouched === "" && counting === "" &&
      message === "No coin left" && listClosed && closed === "No coin left" &&
      pressed?.onTarget === true && regionEmptied && emptied === "",
    readings.includes(null)
      ? `the accessibility tree could not be read for #${ANNOUNCE_ID}, so this proves nothing`
      : !listClosed
      ? `the Tab never closed the list, so the fourth reading "${closed}" is not the closed ` +
        `state and this says nothing about a description surviving the field closing`
      : pressed?.onTarget !== true
      ? `the press never landed on the clear button, so the field was never emptied`
      : !regionEmptied
      ? `the region never went empty after the clear, so the last reading is not the cleared state`
      : untouched !== "" || counting !== ""
      ? `the field carries a description before anybody has asked it anything (untouched ` +
        `"${untouched}", with a count in the region "${counting}"): a count is about the last ` +
        `keystroke, and a description is re-read as part of the field every time it is announced`
      : message !== "No coin left" || closed !== "No coin left"
      ? `a field showing the empty message computes its description as "${message}", and the ` +
        `closed field the query was abandoned on as "${closed}": a live region says nothing when ` +
        `focus arrives, so a reader tabbing into a server-filtered field rendered with a query ` +
        `matching nothing would be told nothing about the message on its face`
      : `"" → "" → "No coin left" → "No coin left" → "": ${named}`,
  )
}

/**
 * Typing narrows the list, and the count of what is left arrives in the region that was there.
 *
 * The assertion is a transition and an identity, not an end state: empty before, the caller's own
 * count afterwards, in an element compared with `===` against the one parked while it was empty,
 * with the observer attached to that node reporting the change it saw.
 *
 * Text is inserted the way every other combobox check here types — through the browser's own input
 * pipeline — so the component's `onInput` runs on a trusted event.
 *
 * @param devtools The connected session, with the region parked and watched.
 * @param pristine The reading taken before the field was touched, for the failure message.
 */
async function countArrivesCheck(devtools: Devtools, pristine: RegionReading): Promise<void> {
  const target = `globalThis.__verifyCombobox?.input ?? null`
  const landing = await clickAt(devtools, await aimAt(devtools, target), target)
  // Every poll's answer is kept and asserted below. One waited on and dropped would let the
  // reading after it stand for a state the page never reached.
  const fieldOpened = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`),
    3_000,
  )
  const opened = await devtools.evaluate<RegionReading>(REGION_STATE)

  await typeInto(devtools, "u")
  const queryArrived = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === "u"`),
    3_000,
  )
  const regionSpoke = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text !== ""`),
    3_000,
  )
  const narrowed = await devtools.evaluate<RegionReading>(REGION_STATE)
  const list = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "a Combobox's match count arrives as a change to the live region that was already there",
    pristine.ok && landing?.onTarget === true && fieldOpened && narrowed.parkedOk &&
      opened.text === "" && opened.mutations === 0 && queryArrived && regionSpoke &&
      list.options > 0 && narrowed.same && narrowed.connected &&
      narrowed.text === `${list.options} coins left` && narrowed.mutations >= 1 &&
      narrowed.added >= 1,
    landing?.onTarget !== true
      ? `the press never landed on the field, so nothing was typed into it — this proves nothing`
      : !fieldOpened
      ? `the field never opened on that press, so the reading taken next is not the open, empty ` +
        `state the count is measured against`
      : !queryArrived
      ? `the text never reached the field, so nothing narrowed the list`
      : !regionSpoke
      ? `the region was still empty ${3_000}ms after the query arrived, so typing announced nothing`
      : !narrowed.parkedOk
      ? `there was no region to park while the field was empty, so nothing was ever watched. The ` +
        `page now holds one reading "${narrowed.text}", which a check looking only for a status ` +
        `region with the right text in it would have accepted — that region was built around the ` +
        `message, which is the shape a screen reader does not announce`
      : opened.text !== "" || opened.mutations !== 0
      ? `opening the field alone put "${opened.text}" into the region (${opened.mutations} ` +
        `change(s)), so the count below is not what typing produced`
      : list.options === 0
      ? `the query left no options at all, so there was no count for the region to carry`
      : !narrowed.same || !narrowed.connected
      ? `the region holding the count is a different element from the one parked while it was ` +
        `empty (same: ${narrowed.same}, the parked one still in the document: ` +
        `${narrowed.connected}) — the page threw the watched region away and built a new one ` +
        `around the message, which is the shape a screen reader does not announce. It reads ` +
        `"${narrowed.text}", so a check that looked only for the right text would have passed`
      : narrowed.text !== `${list.options} coins left`
      ? `the region reads "${narrowed.text}" over ${list.options} matching options, rather than ` +
        `the count the card passes as a prop`
      : narrowed.mutations < 1 || narrowed.added < 1
      ? `an observer watching the parked region recorded ${narrowed.mutations} change(s) and ` +
        `${narrowed.added} added node(s) while the count appeared: the message did not arrive in ` +
        `the element that was being watched`
      : `the element parked while the region was empty is the same element that now reads ` +
        `"${narrowed.text}" over ${list.options} options, it is still in the document, and an ` +
        `observer attached to that node beforehand recorded ${narrowed.mutations} change(s) and ` +
        `${narrowed.added} added node(s) — a region created together with its message would have ` +
        `recorded none`,
  )
}

/**
 * The other two states of the same region: nothing matches, and the field is cleared.
 *
 * Three transitions in one walk, because each is only worth asserting against the one before it: a
 * query that matches nothing replaces the count with the empty message, the clear button empties
 * the region, and typing again brings the message back as a fresh change rather than as text that
 * was never taken away.
 *
 * @param devtools The connected session, with the field open and a count in its region.
 */
async function emptyMessageCheck(devtools: Devtools): Promise<void> {
  // As above, every poll's answer is kept: the reading taken after one that timed out would stand
  // for a state the page never reached, and the message it printed would not say so.
  await typeInto(devtools, "zz")
  const listEmptied = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.options === 0`),
    3_000,
  )
  const messageArrived = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === "No coin left"`),
    3_000,
  )
  const nothing = await devtools.evaluate<RegionReading>(REGION_STATE)

  // The component's own clear button, pressed for real: the way a person empties the field.
  const clear = `globalThis.__verifyCombobox?.input?.parentElement?.querySelector("button") ?? null`
  const pressed = await clickAt(devtools, await aimAt(devtools, clear), clear)
  const regionEmptied = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === ""`),
    3_000,
  )
  const cleared = await devtools.evaluate<RegionReading>(REGION_STATE)

  const target = `globalThis.__verifyCombobox?.input ?? null`
  const reopening = await clickAt(devtools, await aimAt(devtools, target), target)
  const reopened = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`),
    3_000,
  )
  await typeInto(devtools, "zz")
  const messageBack = await poll(
    () => devtools.evaluate<boolean>(`${REGION_STATE}.text === "No coin left"`),
    3_000,
  )
  const again = await devtools.evaluate<RegionReading>(REGION_STATE)

  check(
    "a Combobox's empty message replaces the count in that region, leaves it, and comes back",
    nothing.parkedOk && listEmptied && messageArrived && nothing.same &&
      nothing.text === "No coin left" && pressed?.onTarget === true && regionEmptied &&
      cleared.same && cleared.text === "" && cleared.children === 0 &&
      cleared.mutations > nothing.mutations && reopening?.onTarget === true && reopened &&
      messageBack && again.same && again.connected &&
      again.text === "No coin left" && again.mutations > cleared.mutations,
    !nothing.parkedOk
      ? `there was no region to park while the field was empty, so nothing was ever watched; the ` +
        `page now holds one reading "${nothing.text}"`
      : !listEmptied
      ? `the query still leaves options in the list, so this is not the nothing-matches state ` +
        `the empty message belongs to`
      : !messageArrived || nothing.text !== "No coin left"
      ? `a query matching nothing left the region reading "${nothing.text}" rather than the ` +
        `empty message the card passes`
      : pressed?.onTarget !== true
      ? `the press never landed on the clear button, so the field was never emptied`
      : !regionEmptied || cleared.text !== "" || cleared.children !== 0
      ? `clearing the field left "${cleared.text}" in the region (${cleared.children} element ` +
        `children), so it never went quiet`
      : cleared.mutations <= nothing.mutations
      ? `the observer recorded no change to the parked region when the message left it ` +
        `(${nothing.mutations} → ${cleared.mutations})`
      : reopening?.onTarget !== true || !reopened
      ? `the field never reopened on a real press, so the message did not arrive a second time ` +
        `into a field anybody had touched`
      : !messageBack || !again.same || !again.connected
      ? `typing again put the message in a different element (same: ${again.same}, the parked ` +
        `one still in the document: ${again.connected})`
      : again.text !== "No coin left" || again.mutations <= cleared.mutations
      ? `typing again left the region reading "${again.text}" after ` +
        `${again.mutations - cleared.mutations} further change(s), so the message did not arrive ` +
        `a second time`
      : `count → "${nothing.text}" → cleared by a real press on the clear button, empty with 0 ` +
        `children → typed again, "${again.text}" — one element throughout, with the observer ` +
        `recording ${again.mutations} changes to it in all`,
  )
}

/**
 * A list that changes under an open popup, both ways: options arriving, and options taken away.
 *
 * A field opened before its options have arrived shows the empty message, because opening it asked
 * a question. When the list lands underneath it three things have to happen at once: the message
 * goes, the input stops describing itself by it, and a row is highlighted — a list that arrives
 * with nothing highlighted leaves `Enter` doing nothing and tells a screen reader nothing came.
 *
 * The return leg is the half that was missing, and the defect it caught is worse than the one the
 * arrival fixed: with the highlight taken and the options then withdrawn,
 * `aria-activedescendant` went on naming a row the page no longer held. That is not a degraded
 * announcement but an invalid one — a reading position inside a list with no such row, on a field
 * that is saying at that same moment that there is nothing to match. So the reading below carries
 * `activeDangles`, which asks the page whether the pointer resolves to anything at all, rather
 * than only whether an attribute is present.
 *
 * The card's button arms the arrival rather than performing it, and that shape is forced: pressing
 * anything outside a combobox closes it, so the only way to have options land under an open popup
 * is to ask for them first and open the field while they are on their way. The check reads the
 * delay off the button rather than keeping its own copy, and asserts it really did get the field
 * open first — if the options beat it, the run proves nothing and says so.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function arrivingOptionsCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-empty"))
  await scrollToParked(devtools)

  // A scripted press of the card's own control, the way the Toastr checks press theirs: nothing
  // here is a claim about that button. What is under test starts at the field below it.
  const armed = await devtools.evaluate<{ ok: boolean; delay: number }>(`(() => {
    const button = document.querySelector('#demo-Combobox [data-e2e="combobox-load"]')
    if (button === null) return { ok: false, delay: 0 }
    button.click()
    return { ok: true, delay: Number(button.dataset.delay) }
  })()`)

  const field = `globalThis.__verifyCombobox?.input ?? null`
  const landing = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const waiting = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  const landed = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.options > 0`),
    armed.delay * 4,
  )
  // The highlight follows the options in a later commit than the one that drew them, so on a slow
  // page it can still be on its way when the options already read as there (#269). Waited for,
  // not read once; a combobox that never highlights still fails, on the reading below.
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.active !== null`), 3_000)
  const arrived = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // The same control again. It empties the list on the press and refills it after the delay, so
  // this is the caller taking its options away with the popup open — the return leg of the same
  // walk. The press is scripted on purpose: a real press outside the popup would close it, and
  // what has to be driven here is a list changing under an open popup, which in an application is
  // a response landing rather than a click.
  await devtools.evaluate<null>(
    `(document.querySelector('#demo-Combobox [data-e2e="combobox-load"]')?.click(), null)`,
  )
  const emptied = await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.options === 0`),
    3_000,
  )
  // The same for the highlight's departure.
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.active === null`), 3_000)
  const departed = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "a Combobox follows its list under an open popup, in both directions",
    armed.ok && landing?.onTarget === true && waiting.expanded === "true" &&
      waiting.options === 0 && waiting.statusRole === "status" && waiting.active === null &&
      landed && arrived.expanded === "true" && arrived.options > 0 &&
      arrived.statusText === "" && arrived.describedBy === null &&
      arrived.active === "guide-combobox-empty-option-0" && arrived.activeText.length > 0 &&
      !arrived.activeDangles && emptied && departed.expanded === "true" &&
      departed.active === null && !departed.activeDangles,
    !armed.ok
      ? `the Combobox card has no [data-e2e="combobox-load"] control to arm`
      : landing?.onTarget !== true
      ? "the press never landed on the field, so it was never open when the options arrived"
      : waiting.options !== 0
      ? `the options were already there ${waiting.options} rows deep when the field opened, so ` +
        `they never arrived underneath it — this proves nothing`
      : waiting.statusRole !== "status"
      ? `the open, empty field renders no status to clear (role ${waiting.statusRole})`
      : waiting.active !== null
      ? `the open, empty field already points at ${waiting.active}, with no options to point at`
      : !landed
      ? `no options arrived within ${armed.delay * 4}ms of arming a ${armed.delay}ms wait`
      : arrived.expanded !== "true"
      ? "the popup closed while the options were arriving, so nothing landed underneath it"
      : arrived.statusText !== "" || arrived.describedBy !== null
      ? `${arrived.options} options arrived and the field's live region still reads ` +
        `"${arrived.statusText}"${
          arrived.describedBy === null ? "" : `, with the input still describing itself by it`
        }`
      : arrived.active !== "guide-combobox-empty-option-0"
      ? `${arrived.options} options arrived under the open popup and the highlight is ` +
        `${arrived.active ?? "nowhere"}: a screen reader is told nothing came, and Enter does ` +
        `nothing until an arrow key is pressed`
      : arrived.activeDangles
      ? `the highlight points at ${arrived.active}, which is not an element the page holds`
      : !emptied
      ? `the options never went away again, so the return leg proves nothing`
      : departed.expanded !== "true"
      ? "the popup closed when the options went away, so nothing was left open to check"
      : departed.active !== null
      ? `the options went away and the field still points at ${departed.active}` +
        `${
          departed.activeDangles
            ? ", which is not an element the page holds: a screen reader is left reading a row " +
              "that does not exist, on a field that says there are no matches"
            : ""
        }`
      : `open and empty: a polite live region reading "${waiting.statusText}" and no ` +
        `aria-activedescendant → ${arrived.options} options landed ${armed.delay}ms later: that ` +
        `same region is empty again, the input describes nothing, and the highlight is on ` +
        `"${arrived.activeText}" → the caller took them away again: no rows, no ` +
        `aria-activedescendant, and the popup still open`,
  )

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/**
 * A combobox with no options says nothing until it is asked, and then answers.
 *
 * The defect: a page whose options arrive over the network renders this field with an empty list,
 * and the closed field showed "No matches" and announced it through a live region — to everybody,
 * about a control nobody had touched.
 *
 * Three readings rather than two, because each end of the rule can fail on its own. A component
 * that always shows the message fails the first; one that never shows it fails the second; and one
 * that shows it from the first touch onwards, forever, fails the third.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function untouchedComboboxCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-empty"))
  await scrollToParked(devtools)
  const untouched = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  const aim = await aimAt(devtools, `globalThis.__verifyCombobox?.input ?? null`)
  const landing = await clickAt(devtools, aim, `globalThis.__verifyCombobox?.input ?? null`)
  await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`),
    3_000,
  )
  const opened = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  const closed = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // "Silent" is now about what the region holds, not about whether there is one: the region is
  // always in the page, and the rule is that it carries no word until the field has been used.
  const silent = (reading: ComboboxReading) =>
    reading.statusRole === "status" && reading.statusText === "" && reading.statusChildren === 0
  check(
    "a Combobox with no options says nothing until it is opened, and answers only then",
    untouched.ok && untouched.expanded === "false" && untouched.options === 0 &&
      silent(untouched) && aim.onTarget && landing?.onTarget === true &&
      opened.expanded === "true" && opened.statusRole === "status" &&
      opened.statusLive === "polite" && opened.statusText.length > 0 && silent(closed),
    !untouched.ok
      ? "the Combobox card has no field with id guide-combobox-empty"
      : untouched.options !== 0
      ? `the field under test renders ${untouched.options} options, so it is not the empty one ` +
        `this check is about`
      : untouched.statusRole !== "status"
      ? `an untouched field renders no live region at all (role ${untouched.statusRole}), so a ` +
        `message would have to create one to arrive`
      : !silent(untouched)
      ? `an untouched, closed field's live region already reads "${untouched.statusText}" ` +
        `(${untouched.statusChildren} element children) — nobody has asked it anything`
      : !aim.onTarget || landing?.onTarget !== true
      ? `the press never landed on the field: ${
        landing === null
          ? `(${aim.x}, ${aim.y}) reads ${aim.tag} and the press never reached the page`
          : `it went to ${landing.tag} at (${landing.x}, ${landing.y})`
      } — a missed press, which proves nothing`
      : opened.expanded !== "true"
      ? "the field never opened on a real click, so the rest proves nothing"
      : opened.statusRole !== "status" || opened.statusLive !== "polite"
      ? `opened, the field renders no polite status region to answer with (role ` +
        `${opened.statusRole}, aria-live ${opened.statusLive})`
      : opened.statusText.length === 0
      ? `opened, the live region is still empty, so the field answered nothing`
      : !silent(closed)
      ? `closing the field left the region reading "${closed.statusText}", so once touched it ` +
        `never goes quiet again`
      : `untouched: an empty polite region and no aria-describedby → opened by a real click at ` +
        `(${landing.x}, ${landing.y}): that region now reads "${opened.statusText}" → closed ` +
        `with Escape: empty again`,
  )
}

/**
 * The keyboard highlight stays on screen, and the pointer does not move it.
 *
 * Both rules need the same long list, so they share one opening of it: the popup shows about six
 * of its 27 rows, which is what lets a highlight fall off the bottom in the first place.
 *
 * The scroll half is measured, not eyeballed: the number of `ArrowDown` presses is derived from
 * the popup's own height and its row height, so the highlight is taken exactly one row past the
 * fold whatever the card's styling does, and the row's box is then compared with the popup's
 * visible band. A popup that does not follow its highlight stays at `scrollTop` 0 with the row
 * below the band.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function highlightChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-offset"))
  await scrollToParked(devtools)

  const aim = await aimAt(devtools, `globalThis.__verifyCombobox?.input ?? null`)
  const landing = await clickAt(devtools, aim, `globalThis.__verifyCombobox?.input ?? null`)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const opened = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  const rowHeight = await devtools.evaluate<number>(
    `Math.round(globalThis.__verifyCombobox?.list?.firstElementChild?.offsetHeight ?? 0)`,
  )

  // One row past the last one the popup can show, derived rather than picked: whatever the card's
  // row height and popup height are, this is the first press whose highlight the popup has to
  // scroll to keep.
  const fits = rowHeight > 0 ? Math.floor(opened.clientHeight / rowHeight) : 0
  const steps = fits + 1
  const overflows = opened.scrollHeight > opened.clientHeight && steps < opened.options

  // The quiet case first, and it has to be the **last** row the popup already shows: an earlier row
  // cannot be centred in a list that is at the top, so a popup that centred every highlight would
  // hold still there and prove nothing. `block: "nearest"` leaves this one where it is; `"center"`
  // pulls it to the middle of the box.
  //
  // Only the popup's own scroll is asserted. `scrollIntoView` moves every scrollable ancestor it
  // has, so the page may legitimately shift a few pixels when the row sits below the fold of the
  // window, and it does here — that is the row being brought into sight, which is the point. The
  // page's position is reported rather than pinned.
  const quietSteps = fits - 1
  for (let press = 0; press < quietSteps; press++) await pressKey(devtools, "ArrowDown")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${COMBOBOX_STATE}.active === "guide-combobox-offset-option-${quietSteps}"`,
      ),
    3_000,
  )
  const quiet = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  check(
    "a Combobox highlight that is already on screen leaves the popup where it is",
    opened.ok && overflows && fits >= 3 && opened.scrollTop === 0 &&
      quiet.active === `guide-combobox-offset-option-${quietSteps}` && quiet.scrollTop === 0 &&
      quiet.activeInView,
    !opened.ok || landing?.onTarget !== true
      ? "the field was never opened, so this proves nothing"
      : !overflows
      ? `the popup shows all ${opened.options} of its rows, so it has nowhere to scroll and ` +
        `holding still proves nothing`
      : fits < 3
      ? `only ${fits} row(s) fit the popup, so there is no already-visible row far enough down ` +
        `to be worth scrolling to — this proves nothing`
      : quiet.active !== `guide-combobox-offset-option-${quietSteps}`
      ? `${quietSteps} real ArrowDown presses left the highlight on ${quiet.active} rather than ` +
        `on option ${quietSteps}`
      : quiet.scrollTop !== 0
      ? `the popup scrolled to ${quiet.scrollTop}px to reach row ${quietSteps}, which was already ` +
        `on screen, so the list jerks under a reader who is only moving down it`
      : `${quietSteps} real ArrowDown presses onto the last of the ${fits} rows already showing: ` +
        `the popup stayed at scrollTop 0 (the window moved ` +
        `${quiet.pageScrollY - opened.pageScrollY}px, bringing that row into sight)`,
  )

  for (let press = quietSteps; press < steps; press++) await pressKey(devtools, "ArrowDown")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${COMBOBOX_STATE}.active === "guide-combobox-offset-option-${steps}"`,
      ),
    3_000,
  )
  const walked = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "arrowing past the fold scrolls the Combobox's popup to keep the highlight on screen",
    opened.ok && overflows && landing?.onTarget === true && opened.scrollTop === 0 &&
      opened.active === "guide-combobox-offset-option-0" &&
      walked.active === `guide-combobox-offset-option-${steps}` && walked.scrollTop > 0 &&
      walked.activeInView,
    !opened.ok
      ? "the Combobox card has no field with id guide-combobox-offset"
      : landing?.onTarget !== true
      ? `the press never landed on the field, so it was never opened — this proves nothing`
      : !overflows
      ? `the popup shows all ${opened.options} of its rows (${opened.scrollHeight}px of list in ` +
        `${opened.clientHeight}px of box), so no highlight can fall off it and this proves nothing`
      : opened.active !== "guide-combobox-offset-option-0" || opened.scrollTop !== 0
      ? `the popup opened at scrollTop ${opened.scrollTop} with ${opened.active} highlighted, ` +
        `not at the top on the first row, so the walk below starts from nowhere known`
      : walked.active !== `guide-combobox-offset-option-${steps}`
      ? `${steps} real ArrowDown presses left the highlight on ${walked.active}, not on option ` +
        `${steps}`
      : !walked.activeInView
      ? `the highlight walked to option ${steps} and off the screen: the row sits outside the ` +
        `popup's ${opened.clientHeight}px band at scrollTop ${walked.scrollTop}`
      : `${steps} real ArrowDown presses (${fits} rows of ${rowHeight}px fit the ` +
        `${opened.clientHeight}px popup): the highlight went to option ${steps} and the popup ` +
        `scrolled 0 → ${walked.scrollTop}px to keep it in view`,
  )

  await pointerHighlightCheck(devtools, steps)
}

/**
 * A pointer over a row paints it, and leaves the announced highlight where the keyboard put it.
 *
 * `aria-activedescendant` is where a screen reader is reading. Writing it from a `mouseenter`
 * drags that reading around with a pointer whose user may not be holding it at all — the two input
 * methods are not the same person's.
 *
 * "Unchanged" is a weak thing to assert, so this pins both ends. The highlight is put on a known
 * row with a real `Home` press first, the pointer is landed on a *different* row, the page records
 * that it landed there, and the browser is asked which row it now has in `:hover` — so a check
 * whose pointer never arrived fails rather than reporting a highlight that did not move.
 *
 * The paint is asserted as well as the state, which it could not be until the browser was told it
 * has a mouse: Tailwind gates `hover:` styles behind `@media (hover: hover)`, so the row's
 * `hover:bg-gray-50` used to be compiled and never matched, and both rows read the same
 * transparent background. Now the row under the pointer has to be painted differently from the row
 * beside it, and both backgrounds still go into the message so the difference is visible rather
 * than implied.
 *
 * @param devtools The connected session, with the offsets popup open.
 * @param walkedTo The row the previous check left the highlight on, for the failure message.
 */
async function pointerHighlightCheck(devtools: Devtools, walkedTo: number): Promise<void> {
  await pressKey(devtools, "Home")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${COMBOBOX_STATE}.active === "guide-combobox-offset-option-0" && ` +
          `${COMBOBOX_STATE}.scrollTop === 0`,
      ),
    3_000,
  )
  const before = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  const row = `document.getElementById("guide-combobox-offset-option-2")`
  const aim = await aimAt(devtools, row)
  const landing = await movePointer(devtools, aim, row)
  const after = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)
  const painted = await devtools.evaluate<Painted>(`(() => {
    const read = (index) => document.getElementById("guide-combobox-offset-option-" + index)
    const hovered = read(2)
    const plain = read(3)
    return {
      hovered: hovered !== null && hovered.matches(":hover"),
      plain: plain !== null && plain.matches(":hover"),
      hoveredBackground: hovered === null ? "no row" : getComputedStyle(hovered).backgroundColor,
      plainBackground: plain === null ? "no row" : getComputedStyle(plain).backgroundColor,
    }
  })()`)

  check(
    "the pointer paints a Combobox row without moving the highlight a screen reader follows",
    before.active === "guide-combobox-offset-option-0" && aim.onTarget &&
      landing?.onTarget === true && after.active === before.active && painted.hovered &&
      !painted.plain && painted.hoveredBackground !== painted.plainBackground,
    before.active !== "guide-combobox-offset-option-0"
      ? `Home left the highlight on ${before.active} rather than the first row (the walk before ` +
        `this one had it on option ${walkedTo}), so there is no known place for the pointer not ` +
        `to move it from`
      : !aim.onTarget || landing?.onTarget !== true
      ? `the pointer never landed on the third row: ${
        landing === null
          ? `(${aim.x}, ${aim.y}) reads ${aim.tag} and the move never reached the page`
          : `it went to ${landing.tag} at (${landing.x}, ${landing.y})`
      } — a missed move, which proves nothing`
      : after.active !== before.active
      ? `pointing at the third row moved the announced highlight from ${before.active} to ` +
        `${after.active}, which is a screen reader's reading position following a mouse`
      : !painted.hovered || painted.plain
      ? `the browser did not take the row under the pointer into :hover (third row ` +
        `${painted.hovered}, fourth row ${painted.plain}), so there is nothing here about a ` +
        `pointer at all`
      : painted.hoveredBackground === painted.plainBackground
      ? `the row under the pointer is painted exactly like the row beside it ` +
        `(${painted.hoveredBackground}), so \`hover:bg-gray-50\` reached nothing — a browser ` +
        `answering (hover: none) gates every hover utility out, which is the first thing to check`
      : `the pointer landed on ${landing.tag} at (${landing.x}, ${landing.y}) and the browser put ` +
        `that row, and only that row, into :hover, while aria-activedescendant stayed on ` +
        `${after.active}. The paint is Tailwind's \`hover:bg-gray-50\`: the row under the pointer ` +
        `reads ${painted.hoveredBackground} against ${painted.plainBackground} on the row beside ` +
        `it`,
  )

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/**
 * Reopening a Combobox highlights its selection, not a row the abandoned query chose.
 *
 * Opening drops the draft query, which widens the list back to every item — and the highlight used
 * to be placed against the *narrow* list the query had left. The row at that index in the wide list
 * is a different row, so abandoning a search and coming back highlighted whatever now happened to
 * sit where the search's first match used to be.
 *
 * The walk is deliberately the one a person takes: pick something far down the list, search for
 * something else, leave without choosing, and come back. Each step is asserted before the next is
 * read — a selection that never happened or a query that never arrived would otherwise make the
 * final reading meaningless.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function reopenCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(comboboxSetup("guide-combobox-coin"))
  await scrollToParked(devtools)

  const field = `globalThis.__verifyCombobox?.input ?? null`
  const opened = await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)

  // The last row of the list, found by its text rather than by an index written down here: what
  // makes the check work is that the selection is far from the first row, not which row it is.
  const lastRow =
    `[...(globalThis.__verifyCombobox?.list?.querySelectorAll('[role="option"]') ?? [])]
    .at(-1) ?? null`
  const rowAim = await aimAt(devtools, lastRow)
  const picked = await clickAt(devtools, rowAim, lastRow)
  const chosen = await devtools.evaluate<string>(
    `(globalThis.__verifyCombobox?.list?.querySelectorAll('[role="option"]').length ?? 0) > 0
      ? [...globalThis.__verifyCombobox.list.querySelectorAll('[role="option"]')].at(-1).textContent.trim()
      : ""`,
  )
  await poll(
    () => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === ${JSON.stringify(chosen)}`),
    3_000,
  )
  const selected = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // Reopen before typing: opening empties the input of its selection, so the query is the one
  // character and not the selection with a character stuck to it.
  await clickAt(devtools, await aimAt(devtools, field), field)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  await typeInto(devtools, "E")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.inputValue === "E"`), 3_000)
  const narrowed = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // Tab leaves the input for the clear button, which is a leave: the list closes and keeps the
  // query, which is the state the defect needs — a closed field with an abandoned search in it.
  await pressKey(devtools, "Tab")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  const abandoned = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  // Focus rather than a click, and the difference is the whole defect. A click fires `focus` and
  // then `click`, and the component opens the list on both: the first call is the one that drops
  // the query and highlights against the stale list, and the second, running one render later,
  // quietly puts the highlight right again. Coming back to the field with the keyboard fires focus
  // alone, and nothing corrects it. `.focus()` is how that arrives here because tabbing backwards
  // needs Shift+Tab, which the shared key helper does not describe — what the page receives is the
  // single `focus` event a Tab into the field would deliver.
  await devtools.evaluate<null>(`(globalThis.__verifyCombobox?.input?.focus(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "true"`), 3_000)
  const reopened = await devtools.evaluate<ComboboxReading>(COMBOBOX_STATE)

  check(
    "reopening a Combobox highlights its selection, not a row the abandoned query chose",
    opened?.onTarget === true && picked?.onTarget === true && chosen.length > 0 &&
      selected.inputValue === chosen && narrowed.options > 0 &&
      narrowed.options < selected.options &&
      narrowed.active === "guide-combobox-coin-option-0" &&
      reopened.options === selected.options && reopened.activeText === chosen,
    opened?.onTarget !== true || picked?.onTarget !== true
      ? `the press never landed on the field or on its last row, so nothing was selected — this ` +
        `proves nothing`
      : selected.inputValue !== chosen
      ? `clicking the last row left the field reading "${selected.inputValue}" rather than ` +
        `"${chosen}", so nothing was selected`
      : narrowed.inputValue !== "E"
      ? `the query never arrived: the field reads "${narrowed.inputValue}", so the list was ` +
        `never narrowed and this proves nothing`
      : narrowed.options >= selected.options
      ? `the query left all ${narrowed.options} rows in the list, so there is no narrow list for ` +
        `the reopening to be measured against`
      : narrowed.active !== "guide-combobox-coin-option-0"
      ? `the query "${narrowed.inputValue}" filtered the selection "${chosen}" out of the list and ` +
        `left the highlight on ${narrowed.active ?? "nothing"} rather than on the first row that ` +
        `survived it, so Enter right after typing would pick nothing`
      : abandoned.expanded !== "false"
      ? "Tab never closed the list, so the query was never abandoned"
      : reopened.options !== selected.options
      ? `reopening left ${reopened.options} rows rather than the full ${selected.options}, so the ` +
        `query was not dropped and the highlight has nothing to be wrong about`
      : reopened.activeText !== chosen
      ? `reopening highlighted "${reopened.activeText}" (${reopened.active}) rather than the ` +
        `selected "${chosen}": the highlight was placed against the ${narrowed.options} rows the ` +
        `abandoned query "${narrowed.inputValue}" had left, and that index is a different row in ` +
        `the full list of ${reopened.options}`
      : `selected "${chosen}" → the query "${narrowed.inputValue}" narrowed the list to ` +
        `${narrowed.options} of ${selected.options} rows, dropping the selection, and the ` +
        `highlight moved to the first row that survived → Tab abandoned it → focusing the field ` +
        `again restored all ${reopened.options} rows and highlighted "${reopened.activeText}" ` +
        `(${reopened.active}), the selection`,
  )

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${COMBOBOX_STATE}.expanded === "false"`), 3_000)
  await pointerToCorner(devtools)
}

/**
 * Bring the parked combobox into view and wait for the page to stop moving.
 *
 * Coordinates are derived one round trip and used the next, in viewport pixels, so the page has to
 * have settled in between — the same reason `strayClickCheck` waits above.
 *
 * @param devtools The connected session.
 */
async function scrollToParked(devtools: Devtools): Promise<void> {
  await centreInView(devtools, `globalThis.__verifyCombobox?.input ?? null`)
  await pointerToCorner(devtools)
}

/**
 * Press and release the left button at a derived point, and report where the press landed.
 *
 * @param devtools The connected session.
 * @param aim The point, from {@link aimAt}.
 * @param target A page expression for the element the press was aimed at.
 * @returns What the page saw, or `null` when the press never reached it.
 */
async function clickAt(devtools: Devtools, aim: Aim, target: string): Promise<Landing | null> {
  await devtools.evaluate<null>(`(() => {
    const target = ${target}
    globalThis.__verifyClick = null
    document.addEventListener("mousedown", (event) => {
      globalThis.__verifyClick = {
        onTarget: target !== null && target !== undefined &&
          (target === event.target || target.contains(event.target)),
        tag: event.target === null ? "nothing" : event.target.tagName,
        x: event.clientX,
        y: event.clientY,
      }
    }, { capture: true, once: true })
    return null
  })()`)
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: aim.x,
      y: aim.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    })
  }

  return await devtools.evaluate<Landing | null>(`globalThis.__verifyClick ?? null`)
}

/**
 * Type text into whatever the page has focused, through the browser's own input pipeline.
 *
 * `Input.insertText` rather than a key press, and the difference is worth stating plainly. The
 * shared key table in `harness.ts` describes no character keys and this file may not add one; what
 * the component reads its query from is the `input` event and never a `keydown`; and an insertion
 * the browser delivers is a trusted event, unlike one synthesised inside the page. So this drives
 * the same path a typed character drives. Every caller reads the query back afterwards and reports
 * a query that never arrived as exactly that.
 *
 * @param devtools The connected session.
 * @param text The text to insert at the caret.
 */
async function typeInto(devtools: Devtools, text: string): Promise<void> {
  await devtools.send("Input.insertText", { text })
}

/** One read of the date range picker: the panel's state, and where focus sits relative to it. */
interface PickerState {
  /** `false` when the card is missing the trigger or the panel it names; every check reports that. */
  ok: boolean
  /** `true` when the panel is on screen: the `hidden` attribute is gone and it has a box. */
  open: boolean
  expanded: string | null
  onTrigger: boolean
  /** `true` when the focused element is the panel or anything inside it. */
  inPanel: boolean
  /** `true` when the focused element carries `aria-pressed="true"` — the preset the panel opens on. */
  focusPressed: boolean
  /** `true` when the focused element is the panel's own start-date field. */
  onFromField: boolean
  /** `aria-pressed` of the `Custom…` preset, or `null` when there is no such button. */
  customPressed: string | null
  /** How many presets say they are pressed; a swap rather than an addition would keep this at one. */
  pressedCount: number
  /** The focused element's text or test hook, cut short, for the failure message. */
  label: string
}

/**
 * Park the picker's card, trigger and panel on `globalThis`.
 *
 * The panel is found through the trigger's own `aria-controls` rather than by a second selector, so
 * a trigger pointing at an id nothing answers to is reported here rather than silently handing the
 * checks a different element. Parked by identity, like every other component's, because the focus
 * assertions compare elements and a re-query would also match one that had just been re-rendered.
 */
const PICKER_SETUP = `(() => {
  const card = document.querySelector("#demo-DateRangePicker")
  const trigger = card?.querySelector('[data-e2e="guide-date-range"]') ?? null
  const panelId = trigger?.getAttribute("aria-controls") ?? ""
  globalThis.__verifyPicker = {
    trigger,
    panel: panelId === "" ? null : document.getElementById(panelId),
    // The second picker's trigger: a focusable control on the same card and outside this one, for
    // the check that presses Escape from somewhere the person has walked to.
    away: card?.querySelector('[data-e2e="guide-date-range-empty"]') ?? null,
  }
  return {
    card: card !== null,
    trigger: trigger !== null,
    panel: globalThis.__verifyPicker.panel !== null,
  }
})()`

/** The panel's state and where focus is, read in one round trip. */
const PICKER_STATE = `(() => {
  const { trigger, panel } = globalThis.__verifyPicker ?? {}
  if (!trigger || !panel) {
    return {
      ok: false, open: false, expanded: null, onTrigger: false, inPanel: false,
      focusPressed: false, onFromField: false, customPressed: null, pressedCount: -1, label: "",
    }
  }
  const active = document.activeElement
  const custom = panel.querySelector('[data-e2e="date-range-preset-custom"]')
  const from = panel.querySelector('[data-e2e="date-range-from"]')
  const text = active === document.body
    ? "the page"
    : ((active?.textContent ?? "").trim() || active?.getAttribute?.("data-e2e") ||
      (active?.tagName ?? ""))
  return {
    ok: true,
    open: !panel.hasAttribute("hidden") && panel.getBoundingClientRect().height > 0,
    expanded: trigger.getAttribute("aria-expanded"),
    onTrigger: active === trigger,
    inPanel: panel.contains(active),
    focusPressed: active?.getAttribute?.("aria-pressed") === "true",
    onFromField: from !== null && active === from,
    customPressed: custom === null ? null : custom.getAttribute("aria-pressed"),
    pressedCount: panel.querySelectorAll('button[aria-pressed="true"]').length,
    label: String(text).slice(0, 40),
  }
})()`

/**
 * DateRangePicker's focus contract, driven in the browser that owns it.
 *
 * Nothing here is reachable from a test that renders to a string. Opening the panel is a signal
 * write, the focus move is an effect that runs one render later, the dismissal is a real key press,
 * and `aria-pressed` on `Custom…` changes only when a handler writes the signal the fields read.
 *
 * The three checks are one journey, in the order a person would take it, and each one's "before"
 * is the state the one above it left behind. That is deliberate rather than convenient: the Escape
 * check has to start from focus **inside** the panel and not on the trigger, or "focus is on the
 * trigger afterwards" would also be true of a press that did nothing at all, and the surest way to
 * be somewhere else is to have just been sent there by the check before.
 *
 * Every assertion is a transition for the same reason the Dropdown and Modal checks above give: a
 * panel that never opened is closed, and its trigger keeps whatever focus it had, so an end state
 * on its own cannot tell a working component from an inert one.
 *
 * The card drives the first of the two pickers on it, the one with `selectedPreset="last-7-days"`,
 * which is what makes the opening check able to say *where* focus landed without knowing the card's
 * copy: the element it lands on is the one carrying `aria-pressed="true"`.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dateRangeChecks(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const found = await devtools.evaluate<{ card: boolean; trigger: boolean; panel: boolean }>(
    PICKER_SETUP,
  )

  const opened = await devtools.evaluate<PickerState>(`(() => {
    // Focus the trigger first, so "focus moved into the panel" is a move from a known place rather
    // than from wherever the check before this one left it.
    globalThis.__verifyPicker?.trigger?.focus()
    return ${PICKER_STATE}
  })()`)
  await devtools.evaluate<null>(`(globalThis.__verifyPicker?.trigger?.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${PICKER_STATE}.inPanel === true`), 3_000)
  const inside = await devtools.evaluate<PickerState>(PICKER_STATE)

  check(
    "opening the DateRangePicker's panel moves focus from the trigger into the panel",
    found.trigger && found.panel && opened.ok && opened.onTrigger && !opened.open &&
      inside.open && inside.inPanel && !inside.onTrigger && inside.focusPressed,
    !found.card
      ? "there is no DateRangePicker card on the page to drive"
      : !found.trigger || !found.panel
      ? `the card has ${found.trigger ? "a trigger" : "no trigger"} and ${
        found.panel ? "a panel" : "no panel it names through aria-controls"
      }`
      : !opened.onTrigger
      ? `focus would not go to the trigger, it stayed on ${opened.label}, so there is no move to ` +
        `measure`
      : opened.open
      ? "the panel was already open before the trigger was pressed, so this proves nothing"
      : !inside.open
      ? `the panel never opened: aria-expanded ${opened.expanded} → ${inside.expanded}`
      : !inside.inPanel
      ? `the panel opened and focus stayed on ${
        inside.onTrigger ? "the trigger" : inside.label
      }, so a keyboard user has to tab into it`
      : !inside.focusPressed
      ? `focus went to "${inside.label}", which is not the preset the panel opens on`
      : `focus on the trigger → "${inside.label}", the pressed preset, with aria-expanded ` +
        `${opened.expanded} → ${inside.expanded} and the panel no longer hidden`,
  )

  const pressedCustom = await devtools.evaluate<PickerState>(`(async () => {
    const custom = globalThis.__verifyPicker?.panel
      ?.querySelector('[data-e2e="date-range-preset-custom"]') ?? null
    custom?.click()
    await new Promise((done) => setTimeout(done, 80))
    return ${PICKER_STATE}
  })()`)

  // The count is what rules out the second cause. `aria-pressed="true"` on `Custom…` would also be
  // explained by the card swapping its `selectedPreset` over to custom, and that swap would leave
  // one pressed preset where there had been one. Gaining a second is the state the fields read.
  check(
    "using the DateRangePicker's custom fields marks the Custom preset pressed",
    inside.customPressed === "false" && pressedCustom.customPressed === "true" &&
      inside.pressedCount === 1 && pressedCustom.pressedCount === 2 && pressedCustom.onFromField,
    inside.customPressed === null
      ? "the panel renders no Custom preset, so there is nothing to mark"
      : inside.customPressed !== "false"
      ? `Custom was already aria-pressed="${inside.customPressed}" before it was used`
      : pressedCustom.customPressed !== "true"
      ? `Custom is in use and still reads aria-pressed="${pressedCustom.customPressed}", so a ` +
        `screen reader says the panel is on some other preset`
      : pressedCustom.pressedCount !== 2
      ? `${pressedCustom.pressedCount} presets say they are pressed, not the caller's one plus ` +
        `Custom — the card changed its own selection, so this proves nothing about the fields`
      : !pressedCustom.onFromField
      ? `Custom is marked pressed but focus went to ${pressedCustom.label} rather than the start ` +
        `date field, so the fields were never reached`
      : `aria-pressed on Custom false → true with focus on the start date field, and the caller's ` +
        `own pressed preset still pressed beside it (${inside.pressedCount} → ` +
        `${pressedCustom.pressedCount})`,
  )

  const beforeEscape = await devtools.evaluate<PickerState>(PICKER_STATE)
  await pressKey(devtools, "Escape")
  const closed = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_STATE}.open === false`),
    3_000,
  )
  // The focus goes back in an effect after the closing render; see `returnPathChecks` (#269).
  await poll(() => devtools.evaluate<boolean>(`${PICKER_STATE}.onTrigger`), 3_000)
  const afterEscape = await devtools.evaluate<PickerState>(PICKER_STATE)

  check(
    "a real Escape press closes the DateRangePicker and hands focus back to its trigger",
    beforeEscape.open && beforeEscape.inPanel && !beforeEscape.onTrigger && closed &&
      afterEscape.onTrigger,
    !beforeEscape.open
      ? "the panel was not open, so this proves nothing about Escape"
      : !beforeEscape.inPanel
      ? `focus was on ${beforeEscape.label}, outside the panel, so the press never came from inside it`
      : beforeEscape.onTrigger
      ? "focus was already on the trigger before the press, so finding it there afterwards would " +
        "prove nothing"
      : !closed
      ? `the panel was still open 3s after a real Escape press from "${beforeEscape.label}"`
      : !afterEscape.onTrigger
      ? `the panel closed and focus fell to ${afterEscape.label}, so the next Tab starts from ` +
        `somewhere the person never went`
      : `Input.dispatchKeyEvent Escape from "${beforeEscape.label}": the panel is hidden again ` +
        `(aria-expanded ${beforeEscape.expanded} → ${afterEscape.expanded}) and focus is on the ` +
        `trigger`,
  )

  await returnPathChecks(devtools)
  await escapeFromOutsideCheck(devtools)
  await outsideClickCheck(devtools)

  // The trigger answers Space, and the block after this one presses Space four times, so hand the
  // focus back rather than leaving it on a control that would open this panel again.
  await blurActive(devtools)
}

/**
 * One way of closing the panel from inside it, and how a check drives it.
 *
 * A table rather than four near-identical functions, because the four differ only in the control
 * they press and every other line of the check is the same transition. Each entry still gets its
 * **own** `check(...)` naming it, so a failure says which path broke rather than that one of four
 * did; a single assertion over all four would hide three of them behind the first.
 */
interface ReturnPath {
  /** Completes the sentence "closing the DateRangePicker by …". */
  name: string
  /**
   * A page expression that performs the close. It answers with `""` when it acted, and otherwise
   * with the reason it could not — a control that is missing or disabled is a check this run cannot
   * make, which is a different thing from a component that lost the focus.
   */
  act: string
}

const RETURN_PATHS: readonly ReturnPath[] = [
  {
    name: "choosing a preset",
    act: `(() => {
      const button = globalThis.__verifyPicker?.panel
        ?.querySelector('[data-e2e="date-range-preset-this-month"]') ?? null
      if (button === null) return "the panel renders no this-month preset to choose"
      button.click()
      return ""
    })()`,
  },
  {
    name: "applying the custom range",
    act: `(() => {
      const button = globalThis.__verifyPicker?.panel
        ?.querySelector('[data-e2e="date-range-apply"]') ?? null
      if (button === null) return "the panel renders no apply control"
      if (button.disabled) return "the apply control is disabled, so the draft never committed"
      button.click()
      return ""
    })()`,
  },
  {
    name: "cancelling the custom draft",
    // Found as the control before apply rather than by its words: the cancel button's text is the
    // caller's copy and may be in any language, while its position beside apply is the component's.
    act: `(() => {
      const apply = globalThis.__verifyPicker?.panel
        ?.querySelector('[data-e2e="date-range-apply"]') ?? null
      const button = apply?.previousElementSibling ?? null
      if (button === null || button.tagName !== "BUTTON") {
        return "the panel renders no cancel control beside apply"
      }
      button.click()
      return ""
    })()`,
  },
  {
    name: "pressing the trigger a second time",
    act: `(() => {
      const trigger = globalThis.__verifyPicker?.trigger ?? null
      if (trigger === null) return "the card has no trigger to press"
      trigger.click()
      return ""
    })()`,
  },
]

/**
 * The four ways of closing the panel from inside it that Escape is not.
 *
 * `ui/README.md` states all five as fact, and by this repository's rule a behaviour behind a
 * handler is proven under `pages/checks/` or it is not proven. Escape had a check; these four had
 * the component's word for it.
 *
 * Each is a transition, and the "before" reading is what makes it one: the panel open **with focus
 * inside it and not on the trigger**, so "focus is on the trigger afterwards" cannot also be true
 * of a press that did nothing. The panel is reopened for each path, because each one closes it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function returnPathChecks(devtools: Devtools): Promise<void> {
  for (const path of RETURN_PATHS) {
    const opened = await openPickerPanel(devtools)
    const refused = await devtools.evaluate<string>(path.act)
    const closed = await poll(
      () => devtools.evaluate<boolean>(`${PICKER_STATE}.open === false`),
      3_000,
    )
    // The focus goes back in an effect after the render that closed the panel, so on a slow page it
    // can still be on its way when the panel already reads closed (#269). Waited for, not read once;
    // a picker that never returns it still fails, with the reading below.
    await poll(() => devtools.evaluate<boolean>(`${PICKER_STATE}.onTrigger`), 3_000)
    const after = await devtools.evaluate<PickerState>(PICKER_STATE)

    check(
      `closing the DateRangePicker by ${path.name} returns focus to its trigger`,
      opened.open && opened.inPanel && !opened.onTrigger && refused === "" && closed &&
        after.onTrigger,
      !opened.open
        ? "the panel would not open, so there is nothing to close"
        : !opened.inPanel || opened.onTrigger
        ? `focus was on ${opened.label} rather than inside the panel, so a return to the trigger ` +
          `would prove nothing`
        : refused !== ""
        ? refused
        : !closed
        ? `${path.name} left the panel open 3s later`
        : !after.onTrigger
        ? `${path.name} closed the panel and focus fell to ${after.label}, so the next Tab starts ` +
          `from somewhere the person never went`
        : `focus "${opened.label}" → the trigger, with the panel hidden again (aria-expanded ` +
          `${opened.expanded} → ${after.expanded})`,
    )
  }
}

/**
 * An Escape press from outside an open panel closes it and leaves focus where it is.
 *
 * The case exists because a Tab out does not close this panel: it stays open behind the person,
 * who can then be several controls away when they reach for Escape. Returning focus there would
 * drag them back across the page — the very thing this component was changed to stop — so the
 * Escape branch returns focus only when the component still contains `document.activeElement`.
 *
 * Focus is put on the outside control with `.focus()` rather than by tabbing to it. The tab order
 * between the panel and anything else belongs to the catalogue page, not to this component, so
 * walking it would assert the page's layout; the outside control is the second picker's trigger,
 * which is focusable, is outside this picker's root, and does not open anything of its own until it
 * is clicked. The Escape itself is a real key press, which is the path under test.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function escapeFromOutsideCheck(devtools: Devtools): Promise<void> {
  const opened = await openPickerPanel(devtools)
  const moved = await devtools.evaluate<{ ok: boolean; took: boolean; outside: boolean }>(`(() => {
    const away = globalThis.__verifyPicker?.away ?? null
    const trigger = globalThis.__verifyPicker?.trigger ?? null
    if (away === null || trigger === null) return { ok: false, took: false, outside: false }
    away.focus()
    return {
      ok: true,
      took: document.activeElement === away,
      // Asserted rather than assumed: a control that turned out to be inside this component would
      // make the whole check a restatement of the one above it.
      outside: !(trigger.closest("div")?.contains(away) ?? true),
    }
  })()`)

  await pressKey(devtools, "Escape")
  const closed = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_STATE}.open === false`),
    3_000,
  )
  // See settledActiveElement's own doc: reading focus immediately once `closed` is true can catch a
  // moment between the panel closing and a wrongly-refocusing effect finishing, which reads as
  // correct by coincidence rather than by the component actually leaving focus alone (#265).
  const settled = await settledActiveElement(devtools)
  const after = await devtools.evaluate<PickerState & { stillAway: boolean }>(`(() => ({
    ...${PICKER_STATE},
    stillAway: document.activeElement === (globalThis.__verifyPicker?.away ?? null),
  }))()`)

  check(
    "a real Escape press from outside an open DateRangePicker leaves focus where it is",
    opened.open && moved.ok && moved.took && moved.outside && closed && settled &&
      after.stillAway && !after.onTrigger,
    !opened.open
      ? "the panel would not open, so there is nothing to press Escape at"
      : !moved.ok
      ? "the card has no second control to move focus to, so there is no outside to press from"
      : !moved.took
      ? "focus would not leave the panel, so the press did not come from outside it"
      : !moved.outside
      ? "the control focus was moved to is inside this picker, so this repeats the check above"
      : !closed
      ? "the panel was still open 3s after a real Escape press from outside it"
      : !settled
      ? "focus was still moving after the press, so this proves nothing about where it settled"
      : after.onTrigger
      ? "Escape from outside dragged focus back onto the trigger, several controls from where the " +
        "person had got to — which is the defect this component was changed to stop, arriving by " +
        "the fix for it"
      : !after.stillAway
      ? `Escape from outside closed the panel and moved focus to ${after.label} rather than ` +
        `leaving it alone`
      : "focus outside the component → a real Escape press → the panel is hidden and focus has " +
        "not moved at all",
  )
}

/**
 * A real click outside an open panel closes it and leaves focus on what was clicked.
 *
 * The one close path driven by a genuine `Input.dispatchMouseEvent` rather than a scripted
 * `.click()`, and it has to be: the behaviour under test belongs to a `mousedown` listener on the
 * document, and a scripted click dispatches no `mousedown` at all.
 *
 * What is clicked is the card's own `Usage` summary, which is outside the picker, is focusable, and
 * moves focus nowhere itself — unlike the other picker on the card, which would open its own panel
 * and take focus into it, so that "focus is not on the first trigger" would hold for a component
 * that had tried to pull it back and merely lost the race. The point is derived from the summary's
 * own box and checked with `elementFromPoint` before the press, and the page records where the
 * browser actually delivered it, so a press that landed elsewhere is reported as a missed press
 * rather than as a broken component.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function outsideClickCheck(devtools: Devtools): Promise<void> {
  await centreInView(
    devtools,
    `document.querySelector('#demo-DateRangePicker [data-e2e="usage"] summary')`,
  )
  await pointerToCorner(devtools)

  const opened = await openPickerPanel(devtools)
  // Opening the panel moves focus into it, and the panel is inline rather than an overlay, so
  // focus-follow scrolling can in principle carry the viewport away from the summary that was
  // centred before the panel opened. This re-centre is a precaution, not a proven fix: one run
  // during this check's development did land the aim below the viewport without it, but a later
  // review of this file removed it and saw three passing runs in a row on the same code, so the
  // failure was not reproduced on demand either way. Kept because it costs one more settle here and
  // nothing at all when the panel never moved the page — cheaper than being wrong about which of the
  // two runs was the fluke.
  const target = `document.querySelector('#demo-DateRangePicker [data-e2e="usage"] summary')`
  await centreInView(devtools, target)
  const aim = await aimAt(devtools, target)
  const landing = await clickAt(devtools, aim, target)
  const closed = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_STATE}.open === false`),
    3_000,
  )
  // See settledActiveElement's own doc: reading focus immediately once `closed` is true can catch a
  // moment between the panel closing and a wrongly-refocusing effect finishing, which reads as
  // correct by coincidence rather than by the component actually leaving focus alone (#265).
  const settled = await settledActiveElement(devtools)
  const after = await devtools.evaluate<PickerState & { onClicked: boolean }>(`(() => ({
    ...${PICKER_STATE},
    onClicked: document.activeElement ===
      document.querySelector('#demo-DateRangePicker [data-e2e="usage"] summary'),
  }))()`)

  check(
    "a real click outside an open DateRangePicker closes it without taking focus back",
    opened.open && opened.inPanel && aim.onTarget && landing !== null && landing.onTarget &&
      closed && settled && !after.onTrigger && after.onClicked,
    !opened.open || !opened.inPanel
      ? "the panel would not open with focus inside, so there is nothing to click away from"
      : !aim.onTarget
      ? `there is nothing to click at (${aim.x}, ${aim.y}) — the point reads ${aim.tag}` +
        (aim.inViewport ? "" : ", outside the viewport")
      : landing === null
      ? "the press never reached the page, so this proves nothing about the panel"
      : !landing.onTarget
      ? `the press landed on ${landing.tag} at (${landing.x}, ${landing.y}) rather than the ` +
        `summary aimed at (${aim.x}, ${aim.y}) — a missed press, which proves nothing`
      : !closed
      ? "the panel was still open 3s after a real click outside it"
      : !settled
      ? "focus was still moving after the click, so this proves nothing about where it settled"
      : after.onTrigger
      ? "the outside click pulled focus back onto the trigger, taking it off the control the " +
        "person had just clicked"
      : !after.onClicked
      ? `the panel closed and focus went to ${after.label} rather than staying on what was clicked`
      : `pressed ${landing.tag} at (${landing.x}, ${landing.y}): the panel is hidden and focus is ` +
        `on the control that was clicked, not back on the trigger`,
  )

  // Leave the usage block as it was found; the press toggled it open.
  await devtools.evaluate<null>(
    `(() => {
      const details = document.querySelector('#demo-DateRangePicker [data-e2e="usage"] details')
      if (details !== null) details.open = false
      return null
    })()`,
  )
}

/**
 * Open the parked picker's panel and wait until focus has landed inside it.
 *
 * Every check that closes the panel needs the same starting point, and it has to be waited for
 * rather than assumed: focus moves from an effect, one render after the click.
 *
 * @param devtools The connected session.
 * @returns The state at the moment the panel was open with focus inside — the "before" half of the
 * transition the caller is about to assert. A panel that failed to open returns that failure, and
 * the caller's check says so rather than passing quietly.
 */
async function openPickerPanel(devtools: Devtools): Promise<PickerState> {
  await devtools.evaluate<null>(`(globalThis.__verifyPicker?.trigger?.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${PICKER_STATE}.inPanel === true`), 3_000)

  return await devtools.evaluate<PickerState>(PICKER_STATE)
}

/**
 * One read of `withTime`'s trigger, panel and focus — the same shape as {@link PickerState}, minus
 * the day-mode-only `Custom…` fields nothing in this mode renders.
 */
interface PickerTimeState {
  ok: boolean
  open: boolean
  expanded: string | null
  onTrigger: boolean
  inPanel: boolean
  /** `true` when the focused element carries `aria-pressed="true"` — Last hour, on first open. */
  focusPressed: boolean
  label: string
}

/**
 * Park the `withTime` card's trigger, panel and controlled-value readout on `globalThis`, under a
 * key of its own so it never collides with {@link PICKER_SETUP}'s day-mode parking — both run on
 * the same page, one after the other.
 */
const PICKER_TIME_SETUP = `(() => {
  const card = document.querySelector("#demo-DateRangePicker")
  const trigger = card?.querySelector('[data-e2e="guide-date-range-time"]') ?? null
  const panelId = trigger?.getAttribute("aria-controls") ?? ""
  const panel = panelId === "" ? null : document.getElementById(panelId)
  globalThis.__verifyPickerTime = {
    trigger,
    panel,
    // The paragraph the card renders next to the picker, printing whatever the caller's onChange
    // last received — read back rather than reaching into Preact state, the same way every other
    // check in this file learns what a controlled demo is holding. It is found as a direct child of
    // the nearest ancestor of the trigger that has one, so the card's layout classes can change:
    // the card holds several pickers, each with its own readout beside it.
    controlled: trigger
      ?.closest(':has(> [data-e2e="controlled-value"])')
      ?.querySelector(':scope > [data-e2e="controlled-value"]') ?? null,
    // A focusable control on the same card, outside this picker's own root — for the two checks
    // driven from outside it. Reuses the day-mode empty card's trigger; nothing here depends on
    // what that picker does with a click, only on it being able to hold focus.
    away: card?.querySelector('[data-e2e="guide-date-range-empty"]') ?? null,
  }
  return {
    card: card !== null,
    trigger: trigger !== null,
    panel: panel !== null,
    controlled: globalThis.__verifyPickerTime.controlled !== null,
  }
})()`

/** The panel's state and where focus is, read in one round trip — the `withTime` counterpart of {@link PICKER_STATE}. */
const PICKER_TIME_STATE = `(() => {
  const { trigger, panel } = globalThis.__verifyPickerTime ?? {}
  if (!trigger || !panel) {
    return { ok: false, open: false, expanded: null, onTrigger: false, inPanel: false, focusPressed: false, label: "" }
  }
  const active = document.activeElement
  const text = active === document.body
    ? "the page"
    : ((active?.textContent ?? "").trim() || active?.getAttribute?.("data-e2e") ||
      (active?.tagName ?? ""))
  return {
    ok: true,
    open: !panel.hasAttribute("hidden") && panel.getBoundingClientRect().height > 0,
    expanded: trigger.getAttribute("aria-expanded"),
    onTrigger: active === trigger,
    inPanel: panel.contains(active),
    focusPressed: active?.getAttribute?.("aria-pressed") === "true",
    label: String(text).slice(0, 40),
  }
})()`

/**
 * Open the parked `withTime` panel and wait until focus has landed inside it — the `withTime`
 * counterpart of {@link openPickerPanel}.
 */
async function openTimePickerPanel(devtools: Devtools): Promise<PickerTimeState> {
  await devtools.evaluate<null>(`(globalThis.__verifyPickerTime?.trigger?.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.inPanel === true`), 3_000)

  return await devtools.evaluate<PickerTimeState>(PICKER_TIME_STATE)
}

/**
 * How long {@link settledActiveElement} waits before it starts comparing reads.
 *
 * The two-reads-100ms-apart loop below only proves focus held still for one interval; started
 * immediately, both of those reads can land before a wrong refocus that is merely a little late —
 * #265's second review measured one arriving 250ms after the panel reported closed, and a caller
 * using only the loop, with no floor, reported "settled" against that mid-transition value 2 of 2
 * runs. This floor has to be comfortably past that 250ms for the loop's first read to start only
 * once a late refocus has already happened, so a wrong one shows up as a real change instead of
 * being outrun.
 */
const FOCUS_SETTLE_FLOOR_MS = 400

/**
 * Wait past a late refocus effect, then wait until two reads of `document.activeElement`, one
 * `poll` retry interval (100ms) apart, name the same element — the same "two consecutive reads
 * agree" pattern {@link settledScroll} uses, applied to focus instead of scroll position, behind a
 * fixed {@link FOCUS_SETTLE_FLOOR_MS} floor.
 *
 * The floor is what the 100ms-apart loop alone cannot promise: that loop guarantees only that focus
 * did not change during the one interval it measured, and starting it the moment the panel reports
 * closed can measure an interval that is entirely before a wrong refocus arrives, which is exactly
 * what #265's second review found for a refocus delayed 250ms — the loop is deliberately unchanged
 * here, since #265 does not blame its shape, only what ran it too early. Even with the floor, this
 * cannot guarantee focus will never change again after the moment it returns — nothing short of
 * waiting out every timer and microtask a page could still have queued could promise that. What it
 * is for is narrower and is enough for its callers: a check that proves an *absence* — that a close
 * driven from outside a panel does not pull focus onto the trigger — cannot tell "hasn't happened
 * yet" from "correctly never happens" by reading once right after the panel reads closed. Closing
 * the panel and the effect that would wrongly move focus afterward are two separate Preact commits,
 * and a read timed between them reports whatever focus happens to be resting on mid-transition,
 * which can, by coincidence, look like the correct outcome even when the wrong one is a commit away.
 * Confirmed by breaking it: with a bug that always pulls focus back onto the trigger reintroduced, a
 * caller that read `document.activeElement` immediately after `closed` — no wait at all — reported
 * "ok" 3 of 3 runs; the same caller waiting on this function's own return value read the pulled-back
 * focus and reported the bug every time. **Its return value has to be checked**: a caller that calls
 * this and reads `document.activeElement` anyway without looking at what came back has proven
 * nothing more than the immediate read already did.
 *
 * @param devtools The connected session.
 * @param timeoutMs How long to wait, after the floor, for two consecutive reads to agree before
 * giving up.
 * @returns Whether two consecutive reads, 100ms apart, agreed inside the budget once the floor had
 * passed — `false` when focus was still changing when the budget ran out, which a caller must treat
 * as its own failure rather than press on and read a value this function never confirmed had
 * settled.
 */
async function settledActiveElement(devtools: Devtools, timeoutMs = 3_000): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, FOCUS_SETTLE_FLOOR_MS))
  let previous: string | null = null
  return await poll(async () => {
    const current = await devtools.evaluate<string>(`(() => {
      const active = document.activeElement
      return active === document.body
        ? "BODY"
        : (active?.getAttribute?.("data-e2e") ?? active?.tagName ?? "?")
    })()`)
    const settled = current === previous
    previous = current
    return settled
  }, timeoutMs)
}

/**
 * `withTime`'s own focus contract, and the one behaviour this mode adds: typing into the two
 * `datetime-local` fields and applying carries the typed times to the caller's `onChange`.
 *
 * The focus contract itself is not new mechanism — {@link DateRangePicker}'s open/close signals,
 * `closePanel` and the effect that moves focus are the exact same code paths `withTime` runs
 * through, untouched by it, which is what {@link dateRangeChecks} above already proved for the
 * day-only mode. This function is the proof that showing a `datetime-local` field instead of a
 * `date` one, and two built-in presets instead of a caller-supplied list, changed nothing about
 * where focus goes: the #115/#159 fixes were never mode-specific, and this is what makes that true
 * rather than assumed.
 *
 * `datetime-local`'s value is set and an `input` event dispatched, exactly the way the `Field`
 * check above drives its `email` input — measured against this catalogue's own build in a real
 * browser first (kept as this function's own evidence in the pull request), rather than assumed
 * from the day-only fields' behaviour, which this repository has never had to type into either.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dateRangeTimeChecks(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const found = await devtools.evaluate<
    { card: boolean; trigger: boolean; panel: boolean; controlled: boolean }
  >(PICKER_TIME_SETUP)

  const presetCounts = await devtools.evaluate<{ withTime: number; dayOnly: number }>(`(() => {
    const timePanel = globalThis.__verifyPickerTime?.panel ?? null
    const subDaySelector =
      '[data-e2e="date-range-preset-last-hour"], [data-e2e="date-range-preset-last-24-hours"]'
    const withTime = timePanel ? timePanel.querySelectorAll(subDaySelector).length : -1
    const dayOnly = [...document.querySelectorAll('#demo-DateRangePicker [role="group"]')]
      .filter((panel) => panel !== timePanel)
      .reduce((total, panel) => total + panel.querySelectorAll(subDaySelector).length, 0)
    return { withTime, dayOnly }
  })()`)

  check(
    "withTime shows Last hour and Last 24 hours; the day-only cards on the same page show neither",
    found.panel && presetCounts.withTime === 2 && presetCounts.dayOnly === 0,
    !found.panel
      ? "there is no withTime DateRangePicker card on the page to read"
      : `the withTime panel carries ${presetCounts.withTime} of the two sub-day presets, the ` +
        `day-only panels on the same page carry ${presetCounts.dayOnly} of them between them`,
  )

  const opened = await devtools.evaluate<PickerTimeState>(`(() => {
    globalThis.__verifyPickerTime?.trigger?.focus()
    return ${PICKER_TIME_STATE}
  })()`)
  await devtools.evaluate<null>(`(globalThis.__verifyPickerTime?.trigger?.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.inPanel === true`), 3_000)
  const inside = await devtools.evaluate<PickerTimeState>(PICKER_TIME_STATE)

  // Nothing is pressed on this card — it carries no selectedPreset — so `focusIntoPanel`'s own rule
  // ("the pressed preset comes first... with nothing pressed the first preset") lands here on the
  // first rendered preset, Last hour, not on a pressed one; `inside.focusPressed` would always read
  // false on this card and is not what this check is about.
  check(
    "opening withTime's panel moves focus from the trigger into the panel, onto Last hour",
    found.trigger && found.panel && opened.ok && opened.onTrigger && !opened.open &&
      inside.open && inside.inPanel && !inside.onTrigger && inside.label === "Last hour",
    !found.card
      ? "there is no DateRangePicker card on the page to drive"
      : !found.trigger || !found.panel
      ? `the withTime card has ${found.trigger ? "a trigger" : "no trigger"} and ${
        found.panel ? "a panel" : "no panel it names through aria-controls"
      }`
      : !opened.onTrigger
      ? `focus would not go to the trigger, it stayed on ${opened.label}, so there is no move to ` +
        `measure`
      : !inside.open
      ? `the panel never opened: aria-expanded ${opened.expanded} → ${inside.expanded}`
      : !inside.inPanel
      ? `the panel opened and focus stayed on ${
        inside.onTrigger ? "the trigger" : inside.label
      }, so a keyboard user has to tab into it`
      : inside.label !== "Last hour"
      ? `focus went to "${inside.label}", not the first preset`
      : `focus on the trigger → "${inside.label}", with the panel no longer hidden`,
  )

  const EXPECTED_TYPED = "range: 2026-08-22T14:00 → 2026-08-22T18:00"
  const typedSetup = await devtools.evaluate<{ ok: boolean; controlledBefore: string }>(`(() => {
    const { panel, controlled } = globalThis.__verifyPickerTime ?? {}
    if (!panel || !controlled) return { ok: false, controlledBefore: "" }
    const from = panel.querySelector('[data-e2e="date-range-from"]')
    const to = panel.querySelector('[data-e2e="date-range-to"]')
    const apply = panel.querySelector('[data-e2e="date-range-apply"]')
    if (!from || !to || !apply) return { ok: false, controlledBefore: "" }
    const controlledBefore = controlled.textContent.trim()
    const type = (el, value) => {
      el.value = value
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }
    // "Yesterday 14:00 – 18:00": the literal date does not matter — nothing here asks what day it
    // is — only that the exact wall-clock strings typed into the two fields are the ones the
    // caller's onChange receives back.
    type(from, "2026-08-22T14:00")
    type(to, "2026-08-22T18:00")
    return { ok: true, controlledBefore }
  })()`)

  // The draft signals `type()` above writes to are read by Apply's own `disabled` binding through a
  // render Preact schedules, not synchronously with the `input` event — the same settle every other
  // "type then click" step in this file needs. Polled for, not a fixed wait: a wait long enough to
  // outlast this render on one measured run is not the same as one that outlasts it under load.
  const enabled = typedSetup.ok
    ? await poll(
      () =>
        devtools.evaluate<boolean>(`(() => {
          const apply = globalThis.__verifyPickerTime?.panel
            ?.querySelector('[data-e2e="date-range-apply"]') ?? null
          return apply !== null && apply.disabled === false
        })()`),
      3_000,
    )
    : false
  if (enabled) {
    await devtools.evaluate<null>(
      `(globalThis.__verifyPickerTime?.panel
        ?.querySelector('[data-e2e="date-range-apply"]')?.click(), null)`,
    )
  }
  const typedClosed = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.open === false`),
    3_000,
  )
  const typedReturned = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.onTrigger === true`),
    3_000,
  )
  const typedAfter = await devtools.evaluate<PickerTimeState & { controlled: string }>(`(() => ({
    ...${PICKER_TIME_STATE},
    controlled: (globalThis.__verifyPickerTime?.controlled?.textContent ?? "").trim(),
  }))()`)

  check(
    "typing into withTime's two fields and applying carries those exact times to onChange",
    typedSetup.ok && enabled && typedSetup.controlledBefore !== typedAfter.controlled &&
      typedAfter.controlled === EXPECTED_TYPED && typedClosed && typedReturned &&
      typedAfter.onTrigger,
    !typedSetup.ok
      ? "the withTime card is missing its from field, to field, apply control or controlled-value " +
        "readout"
      : !enabled
      ? "Apply never became enabled 3s after typing a complete range into both fields"
      : typedSetup.controlledBefore === typedAfter.controlled
      ? `the readout stayed "${typedAfter.controlled}", so Apply never reached the caller's onChange`
      : typedAfter.controlled !== EXPECTED_TYPED
      ? `the caller's onChange received "${typedAfter.controlled}", not the times typed into the ` +
        `fields`
      : !typedClosed
      ? "the panel stayed open after Apply"
      : !typedReturned || !typedAfter.onTrigger
      ? "the panel closed but focus did not return to the trigger"
      : `onChange received "${typedAfter.controlled}", the exact times typed into the two fields`,
  )

  const beforeEscape = await openTimePickerPanel(devtools)
  await pressKey(devtools, "Escape")
  const closed = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.open === false`),
    3_000,
  )
  // Closing the panel and returning focus are two separate Preact commits — `isOpen.value = false`,
  // then the effect it schedules — and this deep into a run that has already driven every other
  // package's own checks plus day mode's, the second one measurably lags the first by more than an
  // immediate read after `closed` resolves catches: three full runs of this file's own `verify`
  // reproduced focus landing back on "Last hour" instead of the trigger, reproducibly, with an
  // immediate read; a standalone repro of just open → type → apply → reopen → Escape, with none of
  // this file's other checks run first, never showed it at all. Polled for, the same way `closed`
  // itself is, rather than read once on a guess — a fixed wait chosen to cover one measured run's
  // lag is exactly as reliable as the load that produced that lag, which is to say not reliable.
  const returned = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.onTrigger === true`),
    3_000,
  )
  const afterEscape = await devtools.evaluate<PickerTimeState>(PICKER_TIME_STATE)

  check(
    "a real Escape press closes withTime's panel and hands focus back to its trigger",
    beforeEscape.open && beforeEscape.inPanel && !beforeEscape.onTrigger && closed && returned &&
      afterEscape.onTrigger,
    !beforeEscape.open
      ? "the panel was not open, so this proves nothing about Escape"
      : !beforeEscape.inPanel
      ? `focus was on ${beforeEscape.label}, outside the panel, so the press never came from inside it`
      : !closed
      ? `the panel was still open 3s after a real Escape press from "${beforeEscape.label}"`
      : !returned || !afterEscape.onTrigger
      ? `the panel closed and focus fell to ${afterEscape.label}, so the next Tab starts from ` +
        `somewhere the person never went`
      : `Input.dispatchKeyEvent Escape from "${beforeEscape.label}": the panel is hidden again and ` +
        `focus is on the trigger`,
  )

  await timeReturnPathChecks(devtools)
  await escapeFromOutsideTimeCheck(devtools)
  await outsideClickTimeCheck(devtools)
  await blurActive(devtools)
}

/**
 * The withTime card's own two built-in presets, `Cancel`, and the trigger's second press — the four
 * remaining ways of closing the panel from inside it, alongside Apply and Escape above, that the
 * focus contract this component keeps names. Each entry also says what the controlled-value readout
 * must show afterward: the computed range for the two presets, and the value it already held for
 * `Cancel` and the second press, neither of which commits anything.
 */
interface TimeReturnPath {
  /** Completes the sentence "closing withTime's panel by …". */
  name: string
  /**
   * A page expression run once the panel is open, before `act` — e.g. typing a draft that must not
   * survive the close. Answers `""` when it acted, and otherwise the reason it could not; `act`
   * does not run at all when this does not answer `""`. `undefined` for a path with nothing to set
   * up first.
   */
  setup?: string
  /**
   * A page expression that performs the close. Answers `""` when it acted, and otherwise the
   * reason it could not — a control that is missing is a check this run cannot make, which is a
   * different thing from a component that lost the focus or the value.
   */
  act: string
  /**
   * The controlled-value readout this path must leave behind, computed from the card's own fixed
   * `now` (`2026-02-15T12:00:00Z`) and `timeZone` (`Europe/Paris`). `undefined` for a path that must
   * leave the readout exactly as it found it.
   */
  expectedValue?: string
}

const TIME_RETURN_PATHS: readonly TimeReturnPath[] = [
  {
    name: "choosing Last hour",
    act: `(() => {
      const button = globalThis.__verifyPickerTime?.panel
        ?.querySelector('[data-e2e="date-range-preset-last-hour"]') ?? null
      if (button === null) return "the panel renders no Last hour preset to choose"
      button.click()
      return ""
    })()`,
    expectedValue: "range: 2026-02-15T12:00 → 2026-02-15T13:00",
  },
  {
    name: "choosing Last 24 hours",
    act: `(() => {
      const button = globalThis.__verifyPickerTime?.panel
        ?.querySelector('[data-e2e="date-range-preset-last-24-hours"]') ?? null
      if (button === null) return "the panel renders no Last 24 hours preset to choose"
      button.click()
      return ""
    })()`,
    expectedValue: "range: 2026-02-14T13:00 → 2026-02-15T13:00",
  },
  {
    name: "cancelling the draft",
    // Types a draft that differs from the card's current value before cancelling. Clicking Cancel
    // with nothing typed first cannot tell "Cancel discarded the draft" from "there was nothing to
    // discard, the untouched fields already matched the current value" apart — both leave the
    // readout unchanged either way. A draft that reads nothing like the current value makes the two
    // cases different: a Cancel that wrongly committed it would show up as a changed readout.
    setup: `(() => {
      const panel = globalThis.__verifyPickerTime?.panel ?? null
      const from = panel?.querySelector('[data-e2e="date-range-from"]') ?? null
      const to = panel?.querySelector('[data-e2e="date-range-to"]') ?? null
      if (!from || !to) return "the panel renders no from or to field to type a draft into"
      const type = (el, value) => {
        el.value = value
        el.dispatchEvent(new Event("input", { bubbles: true }))
      }
      type(from, "1999-01-01T00:00")
      type(to, "1999-01-01T01:00")
      return ""
    })()`,
    // Found as the control before apply rather than by its words: the cancel button's text is the
    // caller's copy and may be in any language, while its position beside apply is the component's —
    // the same lookup `RETURN_PATHS`'s own "cancelling the custom draft" entry uses for day mode.
    act: `(() => {
      const apply = globalThis.__verifyPickerTime?.panel
        ?.querySelector('[data-e2e="date-range-apply"]') ?? null
      const button = apply?.previousElementSibling ?? null
      if (button === null || button.tagName !== "BUTTON") {
        return "the panel renders no cancel control beside apply"
      }
      button.click()
      return ""
    })()`,
  },
  {
    name: "pressing the trigger a second time",
    act: `(() => {
      const trigger = globalThis.__verifyPickerTime?.trigger ?? null
      if (trigger === null) return "the card has no trigger to press"
      trigger.click()
      return ""
    })()`,
  },
]

/**
 * The four closes from inside `withTime`'s panel that Apply and Escape are not, proven the same way
 * day mode's own {@link returnPathChecks} proves its four: open fresh, act, and check that focus
 * returns to the trigger — {@link TIME_RETURN_PATHS}'s own doc says what each path also has to leave
 * the controlled-value readout showing.
 *
 * The two preset paths are this loop's own reason to exist, not a rerun of the Apply check above:
 * they are the only proof in this file that choosing "Last hour" or "Last 24 hours" calls the
 * caller's `onChange` with the range the card's fixed `now` and `timeZone` compute, and returns
 * focus — both halves, not just one. A mutation that dropped both from `selectTimePreset` left every
 * other check in this file green; this is what makes that regression visible.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function timeReturnPathChecks(devtools: Devtools): Promise<void> {
  for (const path of TIME_RETURN_PATHS) {
    const opened = await openTimePickerPanel(devtools)
    const before = await devtools.evaluate<string>(
      `(globalThis.__verifyPickerTime?.controlled?.textContent ?? "").trim()`,
    )
    const setupResult = path.setup === undefined ? "" : await devtools.evaluate<string>(path.setup)
    const refused = setupResult !== "" ? setupResult : await devtools.evaluate<string>(path.act)
    const closed = await poll(
      () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.open === false`),
      3_000,
    )
    const returned = await poll(
      () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.onTrigger === true`),
      3_000,
    )
    const after = await devtools.evaluate<PickerTimeState & { controlled: string }>(`(() => ({
      ...${PICKER_TIME_STATE},
      controlled: (globalThis.__verifyPickerTime?.controlled?.textContent ?? "").trim(),
    }))()`)

    const valueOk = path.expectedValue === undefined
      ? after.controlled === before
      : after.controlled === path.expectedValue && after.controlled !== before

    check(
      `closing withTime's panel by ${path.name} returns focus to its trigger`,
      opened.open && opened.inPanel && !opened.onTrigger && refused === "" && closed && returned &&
        after.onTrigger && valueOk,
      !opened.open
        ? "the panel would not open, so there is nothing to close"
        : !opened.inPanel || opened.onTrigger
        ? `focus was on ${opened.label} rather than inside the panel, so a return to the trigger ` +
          `would prove nothing`
        : refused !== ""
        ? refused
        : !closed
        ? `${path.name} left the panel open 3s later`
        : !returned || !after.onTrigger
        ? `${path.name} closed the panel and focus fell to ${after.label}, so the next Tab starts ` +
          `from somewhere the person never went`
        : path.expectedValue !== undefined && after.controlled !== path.expectedValue
        ? `${path.name} left the readout reading "${after.controlled}", not the computed ` +
          `"${path.expectedValue}"`
        : path.expectedValue === undefined && after.controlled !== before
        ? `${path.name} was expected to leave the value alone, but the readout changed from ` +
          `"${before}" to "${after.controlled}"`
        : `focus "${opened.label}" → the trigger, with the panel hidden again (aria-expanded ` +
          `${opened.expanded} → ${after.expanded})`,
    )
  }
}

/**
 * An Escape press from outside an open `withTime` panel closes it and leaves focus where it is —
 * the `withTime` counterpart of {@link escapeFromOutsideCheck}. See that function's own doc for why
 * this component does not pull focus back for an Escape that did not come from inside it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function escapeFromOutsideTimeCheck(devtools: Devtools): Promise<void> {
  const opened = await openTimePickerPanel(devtools)
  const moved = await devtools.evaluate<{ ok: boolean; took: boolean }>(`(() => {
    const away = globalThis.__verifyPickerTime?.away ?? null
    if (away === null) return { ok: false, took: false }
    away.focus()
    return { ok: true, took: document.activeElement === away }
  })()`)

  await pressKey(devtools, "Escape")
  const closed = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.open === false`),
    3_000,
  )
  // See settledActiveElement's own doc: reading focus immediately once `closed` is true can catch a
  // moment between the panel closing and a wrongly-refocusing effect finishing, which reads as
  // correct by coincidence rather than by the component actually leaving focus alone.
  const settled = await settledActiveElement(devtools)
  const after = await devtools.evaluate<PickerTimeState & { stillAway: boolean }>(`(() => ({
    ...${PICKER_TIME_STATE},
    stillAway: document.activeElement === (globalThis.__verifyPickerTime?.away ?? null),
  }))()`)

  check(
    "a real Escape press from outside an open withTime panel leaves focus where it is",
    opened.open && moved.ok && moved.took && closed && settled && after.stillAway &&
      !after.onTrigger,
    !opened.open
      ? "the panel would not open, so there is nothing to press Escape at"
      : !moved.ok
      ? "the card has no outside control to move focus to"
      : !moved.took
      ? "focus would not leave the panel, so the press did not come from outside it"
      : !closed
      ? "the panel was still open 3s after a real Escape press from outside it"
      : !settled
      ? "focus was still moving 3s after the press, so this proves nothing about where it settled"
      : after.onTrigger
      ? "Escape from outside dragged focus back onto the trigger, which is the defect this " +
        "component was changed to stop, in the mode it was changed for"
      : !after.stillAway
      ? `Escape from outside closed the panel and moved focus to ${after.label} rather than ` +
        `leaving it alone`
      : "focus outside the component → a real Escape press → the panel is hidden and focus has " +
        "not moved at all",
  )
}

/**
 * A real click outside an open `withTime` panel closes it and does not pull focus back onto the
 * trigger — the `withTime` counterpart of {@link outsideClickCheck}, but aimed at a different spot.
 *
 * {@link outsideClickCheck} clicks the card's own "Usage" summary, which does not work here: the
 * `withTime` demo is the last of the three on this catalogue card, its panel is 221px tall, and
 * `position: absolute` puts that panel on top of whatever sits below it in the document rather than
 * pushing it down — measured directly against this catalogue's own build, where the open panel
 * covers the Usage summary that follows it. Aimed at the corner {@link pointerToCorner} already
 * parks the pointer in instead: nothing this catalogue renders ever reaches a fixed page corner
 * clear above the sticky header, so there is nothing for any card's panel to grow into and cover.
 * The corner is not a focusable control, so this checks the same fact
 * {@link outsideClickCheck} does — the click closes the panel without dragging focus back onto the
 * trigger — by reading where focus actually goes (`document.body`, per how a browser resolves focus
 * for a plain click with no focusable target) rather than by asserting it landed on the thing
 * clicked.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function outsideClickTimeCheck(devtools: Devtools): Promise<void> {
  const opened = await openTimePickerPanel(devtools)
  const corner = await pointerToCorner(devtools)
  await clickAtPoint(devtools, corner)
  const closed = await poll(
    () => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.open === false`),
    3_000,
  )
  // See settledActiveElement's own doc: an immediate read here reported this check as passing
  // against a build with the return-focus bug deliberately reintroduced, because the read landed
  // between the panel closing and the wrongly-refocusing effect completing.
  const settled = await settledActiveElement(devtools)
  const after = await devtools.evaluate<PickerTimeState & { onBody: boolean }>(`(() => ({
    ...${PICKER_TIME_STATE},
    onBody: document.activeElement === document.body,
  }))()`)

  check(
    "a real click outside an open withTime panel closes it without pulling focus back",
    opened.open && opened.inPanel && closed && settled && !after.onTrigger && after.onBody,
    !opened.open || !opened.inPanel
      ? "the panel would not open with focus inside, so there is nothing to click away from"
      : !closed
      ? "the panel was still open 3s after a real click outside it"
      : !settled
      ? "focus was still moving 3s after the click, so this proves nothing about where it settled"
      : after.onTrigger
      ? "the outside click pulled focus back onto the trigger"
      : !after.onBody
      ? `the panel closed but focus went to ${after.label} rather than falling to the page — a ` +
        `stray focusable control at the corner, which proves less than intended`
      : "a real click at the page's own corner: the panel is hidden and focus fell to the page, " +
        "not back on the trigger",
  )
}

/** One read of the pager being driven: which page it is on, and what its two end controls are. */
interface PagerState {
  /** `false` when the card is missing the nav or one of its controls. */
  ok: boolean
  /** The page marked `aria-current="page"`, or `0` when none is. */
  page: number
  previousDisabled: boolean
  nextDisabled: boolean
  /**
   * `true` when a control carries the **native** `disabled` attribute.
   *
   * Read so that a failure can name the mistake rather than its symptom. Chromium takes focus off a
   * focused button the moment that attribute appears, so a component that reached for it would fail
   * these checks with "focus is on the page", which is the reported defect's own message and says
   * nothing about the cause.
   */
  nativelyDisabled: boolean
  onPrevious: boolean
  onNext: boolean
  /**
   * `true` while the two parked controls are still the ones the nav renders, compared by identity.
   * A control Preact unmounted and put back is a different element that a selector would still
   * find, and losing the element is the whole defect.
   */
  sameControls: boolean
  /**
   * The last page the card's `onChange` was asked for, or `0` before it has been asked for any.
   *
   * Read from the card rather than from the pager, and it is the only way to see a request the
   * component then clamped away: asking for page 6 of 5 leaves the pager on page 5, which is
   * exactly where it already was. Removing the guard from the disabled control's handler and
   * rebuilding left every check in this file green until the card started reporting this.
   */
  requested: number
  /** The focused element's text, cut short, for the failure message. */
  label: string
}

/**
 * Park the five-page pager's nav and its two end controls.
 *
 * The controls are the `nav`'s own button children — the page numbers live inside the `ul` between
 * them — so nothing here depends on the card's copy, which is the caller's and may be translated.
 * The nav is picked by its accessible name because the card renders three of them.
 */
const PAGER_SETUP = `(() => {
  const nav = document.querySelector('#demo-Pagination nav[aria-label="Five pages"]')
  const controls = nav === null
    ? []
    : [...nav.children].filter((node) => node.tagName === "BUTTON")
  globalThis.__verifyPager = {
    nav,
    previous: controls[0] ?? null,
    next: controls[1] ?? null,
    readout: document.querySelector('#demo-Pagination [data-e2e="pagination-requested"]'),
  }
  return {
    found: nav !== null,
    controls: controls.length,
    readout: globalThis.__verifyPager.readout !== null,
  }
})()`

/** The pager's page, its two controls' state and where focus is, read in one round trip. */
const PAGER_STATE = `(() => {
  const { nav, previous, next, readout } = globalThis.__verifyPager ?? {}
  if (!nav || !previous || !next) {
    return {
      ok: false, page: 0, previousDisabled: false, nextDisabled: false,
      nativelyDisabled: false, onPrevious: false, onNext: false, sameControls: false,
      requested: -1, label: "",
    }
  }
  const active = document.activeElement
  const current = nav.querySelector('[aria-current="page"]')
  const buttons = [...nav.children].filter((node) => node.tagName === "BUTTON")
  const asked = (readout?.textContent ?? "").match(/onChange: (\\d+)/)
  return {
    ok: true,
    page: current === null ? 0 : Number((current.textContent ?? "").trim()),
    previousDisabled: previous.getAttribute("aria-disabled") === "true",
    nextDisabled: next.getAttribute("aria-disabled") === "true",
    nativelyDisabled: previous.disabled === true || next.disabled === true,
    onPrevious: active === previous,
    onNext: active === next,
    sameControls: buttons.length === 2 && buttons[0] === previous && buttons[1] === next,
    requested: readout === null ? -1 : (asked === null ? 0 : Number(asked[1])),
    label: active === document.body
      ? "the page"
      : (active?.textContent ?? "").trim().slice(0, 40),
  }
})()`

/**
 * Pagination's end controls survive being paged to the end, with the focus that was on them.
 *
 * The defect was that they did not exist there: a control that cannot act was left out of the
 * render, so the last Space press a keyboard user made destroyed the button under their finger and
 * dropped focus to the page. No string-rendering test can see any of this — it needs a focused
 * element, a real key press, and a component that re-renders in between.
 *
 * Two things every reading here insists on beyond the obvious. Focus is compared by **identity**
 * against the element parked before the paging started, because a selector would also match a
 * freshly mounted Next button that never had focus — which is exactly the state the defect leaves
 * behind, minus the focus. And the page number is read from `aria-current="page"` after each press,
 * so a control that kept its focus by never doing anything is a failure rather than a pass.
 *
 * Mostly Space: the walk below presses Space, which still activates a button carrying
 * `aria-disabled` — which is why the component guards its own handler, and why one of the checks
 * below presses a disabled control and asserts nothing happened. A real Enter press is proven
 * separately, once, on Next: Space alone would not catch a handler that called `preventDefault()`
 * on Enter specifically, which the Dropdown and Modal checks elsewhere in this file do not stand in
 * for here.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function paginationChecks(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const found = await devtools.evaluate<{ found: boolean; controls: number; readout: boolean }>(
    PAGER_SETUP,
  )

  const toEnd = await walkPager(devtools, "next", 4)
  check(
    "paging a Pagination to its last page leaves Next focused and disabled",
    found.found && found.controls === 2 && found.readout && toEnd.ok && toEnd.start.page === 1 &&
      !toEnd.beforeLast.nextDisabled && toEnd.beforeLast.onNext && toEnd.beforeLast.page === 4 &&
      toEnd.after.page === 5 && toEnd.after.nextDisabled && toEnd.after.onNext &&
      toEnd.after.sameControls,
    !found.found
      ? "there is no five-page Pagination on the card to drive"
      : found.controls !== 2
      ? `the nav renders ${found.controls} end controls, not the two this check drives`
      : !found.readout
      ? "the card reports no page it was asked for, so the check below it could not tell a " +
        "request the component clamped from no request at all"
      : toEnd.start.page !== 1
      ? `the pager started on page ${toEnd.start.page} rather than page 1, so this proves nothing`
      : !toEnd.ok
      ? toEnd.note
      : !toEnd.beforeLast.onNext
      ? `focus was on ${toEnd.beforeLast.label} before the last press, not on Next`
      : toEnd.beforeLast.nextDisabled
      ? "Next was already disabled on page 4, so the last press was never a real one"
      : toEnd.after.page !== 5
      ? `the last Space press left the pager on page ${toEnd.after.page}, so it never reached the end`
      : toEnd.after.nativelyDisabled
      ? `Next carries the native disabled attribute at the last page, so Chromium took focus off ` +
        `it — focus is on ${toEnd.after.label}. That is the reported defect by another route; ` +
        `aria-disabled says the same thing to a screen reader and leaves focus alone`
      : !toEnd.after.nextDisabled
      ? "the pager is on its last page and Next still says it can act"
      : !toEnd.after.onNext
      ? `Next lost focus on reaching the last page — it went to ${toEnd.after.label}, which is the ` +
        `defect this check exists for`
      : `Space from page 1: ${toEnd.pages.join(" → ")}, and on the last press Next went from ` +
        `enabled to disabled while staying the same element with focus`,
  )

  // The page number alone cannot answer this one. `Pagination` clamps what it is given, so a
  // disabled Next whose handler still ran would ask the card for page 6 of 5 and the card would
  // render page 5 — the page it was already on. The card reports the page it was *asked* for, and
  // that is the reading with a different answer for the two implementations.
  const dead = await devtools.evaluate<PagerState>(PAGER_STATE)
  // Pressed only once Next is the focused element, for the reason {@link walkPager} gives: a key
  // press with focus somewhere else drives whatever is there and leaves it for a later block.
  if (dead.onNext && dead.nextDisabled) {
    await pressKey(devtools, "Space")
    await poll(
      () => devtools.evaluate<boolean>(`${PAGER_STATE}.requested !== ${dead.requested}`),
      1_000,
    )
  }
  const afterDead = await devtools.evaluate<PagerState>(PAGER_STATE)
  check(
    "a Space press on Pagination's disabled Next asks for no page at all",
    dead.nextDisabled && dead.onNext && dead.requested === 5 &&
      afterDead.requested === dead.requested && afterDead.page === dead.page && afterDead.onNext,
    !dead.nextDisabled || !dead.onNext
      ? "Next was not both focused and disabled before the press, so this proves nothing"
      : dead.requested !== 5
      ? `the card reports ${dead.requested} as the last page it was asked for, not the 5 the walk ` +
        `above asked for, so a further request could not be told from it`
      : afterDead.requested !== dead.requested
      ? `the press asked the card for page ${afterDead.requested} — aria-disabled does not stop ` +
        `the click, and the handler did not either; the pager still reads page ${afterDead.page} ` +
        `only because it clamps what it is given`
      : afterDead.page !== dead.page
      ? `a press on the disabled Next moved the pager from page ${dead.page} to ${afterDead.page}`
      : !afterDead.onNext
      ? `the press took focus off Next, onto ${afterDead.label}`
      : `a real Space press on the disabled Next asked the card for nothing (still page ` +
        `${afterDead.requested}), left the pager on page ${afterDead.page}, and kept focus on it`,
  )

  const toStart = await walkPager(devtools, "previous", 4)
  check(
    "paging a Pagination back to its first page leaves Previous focused and disabled",
    toStart.ok && toStart.start.page === 5 && !toStart.beforeLast.previousDisabled &&
      toStart.beforeLast.onPrevious && toStart.beforeLast.page === 2 && toStart.after.page === 1 &&
      toStart.after.previousDisabled && toStart.after.onPrevious && toStart.after.sameControls,
    toStart.start.page !== 5
      ? `the pager started on page ${toStart.start.page} rather than page 5, so this proves nothing`
      : !toStart.ok
      ? toStart.note
      : !toStart.beforeLast.onPrevious
      ? `focus was on ${toStart.beforeLast.label} before the last press, not on Previous`
      : toStart.after.page !== 1
      ? `the last Space press left the pager on page ${toStart.after.page}, not back at the start`
      : toStart.after.nativelyDisabled
      ? `Previous carries the native disabled attribute at page 1, so Chromium took focus off it ` +
        `— focus is on ${toStart.after.label}; aria-disabled is what keeps it`
      : !toStart.after.previousDisabled
      ? "the pager is on page 1 and Previous still says it can act"
      : !toStart.after.onPrevious
      ? `Previous lost focus on reaching page 1 — it went to ${toStart.after.label}`
      : `Space from page 5: ${toStart.pages.join(" → ")}, and on the last press Previous went ` +
        `from enabled to disabled while staying the same element with focus`,
  )

  // A real Enter press, on its own: everything above walked the pager with Space, which does not
  // prove Enter reaches the same handler — a control that called `preventDefault()` on Enter
  // specifically would still pass every check above it (#261). The pager is on page 1 here, so Next
  // is the enabled control to press it on.
  await devtools.evaluate<null>(`(globalThis.__verifyPager?.next?.focus(), null)`)
  const beforeEnter = await devtools.evaluate<PagerState>(PAGER_STATE)
  await pressKey(devtools, "Enter")
  const movedByEnter = await poll(
    () => devtools.evaluate<boolean>(`${PAGER_STATE}.page !== ${beforeEnter.page}`),
    3_000,
  )
  const afterEnter = await devtools.evaluate<PagerState>(PAGER_STATE)
  check(
    "a real Enter press activates Pagination's Next control",
    beforeEnter.onNext && !beforeEnter.nextDisabled && movedByEnter &&
      afterEnter.page === beforeEnter.page + 1 && afterEnter.onNext,
    !beforeEnter.onNext
      ? `focus was on ${beforeEnter.label}, not Next, so this proves nothing`
      : beforeEnter.nextDisabled
      ? "Next was already disabled, so a press here proves nothing about activation"
      : !movedByEnter
      ? "the pager was still on the same page 3s after a real Enter press"
      : afterEnter.page !== beforeEnter.page + 1
      ? `a real Enter press moved the pager from page ${beforeEnter.page} to ${afterEnter.page}, ` +
        `not to ${beforeEnter.page + 1}`
      : `a real Enter press on Next: page ${beforeEnter.page} → ${afterEnter.page}, focus stayed ` +
        `on Next`,
  )

  // Leave nothing focused. The blocks after this one send their own key presses, and a control
  // still holding focus here would answer one of them.
  await blurActive(devtools)
}

/**
 * Take focus off whatever holds it, so a later block's key press cannot be answered by this one's
 * control.
 *
 * @param devtools The connected session.
 */
async function blurActive(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    return null
  })()`)
}

/** What one walk of the pager from one end to the other saw. */
interface Walk {
  /** `false` when a press did not move the pager; `note` says which one. */
  ok: boolean
  note: string
  /** Where the pager was before the first press. */
  start: PagerState
  /** The state read immediately before the press that reaches the end. */
  beforeLast: PagerState
  /** The state read after that press. */
  after: PagerState
  /** Every page the walk visited, the starting one first. */
  pages: number[]
}

/**
 * Focus one end control and press Space until the pager reaches that end.
 *
 * Each press is followed by a wait for the page number to change rather than a fixed sleep, so a
 * slow render is a slow check instead of a false failure, and a press that genuinely did nothing is
 * reported as the press it was. The reading taken just before the final press is kept separately
 * because that is the half of the transition the checks are about: enabled and focused there,
 * disabled and still focused after.
 *
 * **Nothing is pressed until the control has the focus.** A key press goes wherever the page has
 * focus, so a walk whose control is missing would otherwise send four Space presses at whatever the
 * check before this one left focused — and a mutation run proved that is not theoretical: with the
 * end controls unmounted there was no Next to park, the presses landed on the date range picker's
 * trigger, and a Modal check two blocks later failed for a reason that named neither component.
 *
 * @param devtools The connected session.
 * @param control Which end control to drive.
 * @param presses How many presses reach the end from where the pager is now.
 * @returns The walk, whether or not every press landed.
 */
async function walkPager(
  devtools: Devtools,
  control: "next" | "previous",
  presses: number,
): Promise<Walk> {
  await devtools.evaluate<null>(`(globalThis.__verifyPager?.${control}?.focus(), null)`)
  const start = await devtools.evaluate<PagerState>(PAGER_STATE)

  const focused = control === "next" ? start.onNext : start.onPrevious
  if (!start.ok || !focused) {
    return {
      ok: false,
      note: start.ok
        ? `the ${control} control would not take focus — it stayed on ${start.label}, so nothing ` +
          `was pressed`
        : "the card is missing the nav or one of its end controls, so nothing was pressed",
      start,
      beforeLast: start,
      after: start,
      pages: [start.page],
    }
  }

  const pages = [start.page]
  let beforeLast = start
  let current = start
  let note = ""
  let ok = true

  for (let press = 1; press <= presses; press++) {
    beforeLast = current
    await pressKey(devtools, "Space")
    const moved = await poll(
      () => devtools.evaluate<boolean>(`${PAGER_STATE}.page !== ${current.page}`),
      3_000,
    )
    current = await devtools.evaluate<PagerState>(PAGER_STATE)
    pages.push(current.page)
    if (!moved && ok) {
      ok = false
      note = `press ${press} of ${presses} left the pager on page ${current.page}, with focus on ` +
        `${current.label}`
    }
  }

  return { ok, note, start, beforeLast, after: current, pages }
}

/** Row keys, aria-sort of two headers, the demo's own readout text, and where focus sits. */
interface DataTableState {
  /** `false` when the card or one of the headers this file drives is missing. */
  ok: boolean
  /** `data-row-key` of every row on screen, in document order — see `rowKeyAttribute` in `ui/`. */
  rowKeys: string[]
  /** `aria-sort` of the Merchant column's `<th>`, or `null` when it carries none. */
  merchantAriaSort: string | null
  /** How many `<th>` in the card carry `aria-sort` at all. */
  ariaSortCount: number
  /** The demo's own `data-e2e="data-table-sort"` paragraph, e.g. `"merchant:asc"` or `"none"`. */
  readout: string
  /** `true` when the Merchant header's button holds focus. */
  onMerchant: boolean
}

/** Park references to the DataTable card, its Merchant header button and its pager. */
const DATA_TABLE_SETUP = `(() => {
  const card = document.querySelector('#demo-DataTable')
  const headerButtons = card ? [...card.querySelectorAll('th button')] : []
  const byLabel = (label) =>
    headerButtons.find((button) => button.textContent.includes(label)) ?? null
  const nav = card ? card.querySelector('nav[aria-label="Invoice pages"]') : null
  const controls = nav === null ? [] : [...nav.children].filter((node) => node.tagName === "BUTTON")
  globalThis.__verifyDataTable = {
    card,
    merchant: byLabel("Merchant"),
    readout: card ? card.querySelector('[data-e2e="data-table-sort"]') : null,
    next: controls[1] ?? null,
  }
  return {
    found: card !== null,
    merchantFound: globalThis.__verifyDataTable.merchant !== null,
    readoutFound: globalThis.__verifyDataTable.readout !== null,
    nextFound: globalThis.__verifyDataTable.next !== null,
  }
})()`

/** Row order, the Merchant column's `aria-sort`, the readout text, and whether Merchant is focused. */
const DATA_TABLE_STATE = `(() => {
  const store = globalThis.__verifyDataTable
  if (!store || !store.card) {
    return {
      ok: false, rowKeys: [], merchantAriaSort: null, ariaSortCount: -1, readout: "",
      onMerchant: false,
    }
  }
  const rowKeys = [...store.card.querySelectorAll("[data-row-key]")]
    .map((el) => el.getAttribute("data-row-key"))
  return {
    ok: true,
    rowKeys,
    merchantAriaSort: store.merchant ? store.merchant.closest("th").getAttribute("aria-sort") : null,
    ariaSortCount: store.card.querySelectorAll("[aria-sort]").length,
    readout: (store.readout?.textContent ?? "").trim(),
    onMerchant: document.activeElement === store.merchant,
  }
})()`

/**
 * `DataTable`'s sort-by-header, paging and URL contract: a real `<button>` per sortable header,
 * `aria-sort` on exactly the sorted column, a real mouse click or a Space press both sorting and
 * reversing, a page turn that does not cost the reader their place, and — on the separate,
 * URL-bound instance `pages/src/data-table-sort.tsx` mounts — a header press that round-trips
 * through `?sort=`.
 *
 * The click half and the Space half each drive the same column, Merchant, through the same two
 * transitions — sorted, then reversed — because that is the pair the issue's "Done when" asks for
 * on each input method rather than once for the component. The click half uses a real
 * `Input.dispatchMouseEvent` at the button's own rectangle (`clickMerchantHeader`), and asserts
 * the press landed on the button before trusting anything that followed it — a scripted `.click()`
 * fires with no hit-testing, so it would "click" a button a stray `pointer-events-none` had made
 * unreachable to an actual pointer. The Space half's own third press is a real Enter press instead:
 * {@link modalChecks} and {@link dropdownChecks} already prove `pressKey(devtools, "Enter")`
 * activates a focused native button in general, but only a press on this header's own listener can
 * catch a handler that called `preventDefault()` on Enter specifically (#261).
 *
 * Three presses on Merchant — ascending, descending, off — return the table to the unsorted
 * baseline before the Space half starts, so the two proofs begin from the same state instead of
 * one inheriting whatever the other left behind; the round trip back to the baseline is itself
 * checked, which is what confirms `toggleSort`'s third step (a rule cycles off, not just between
 * the two directions) actually reaches the header, not only the sort state. The Space half's own
 * three presses repeat that round trip with its last press swapped for a real Enter, which is what
 * lets it double as the Enter proof without a fourth press.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dataTableChecks(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const found = await devtools.evaluate<
    { found: boolean; merchantFound: boolean; readoutFound: boolean; nextFound: boolean }
  >(DATA_TABLE_SETUP)

  const baseline = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  check(
    "the DataTable card renders its sortable Merchant header, sort readout and pager",
    found.found && found.merchantFound && found.readoutFound && found.nextFound && baseline.ok,
    !found.found
      ? "there is no #demo-DataTable card to drive"
      : !found.merchantFound
      ? 'no header button whose text includes "Merchant" was found'
      : !found.readoutFound
      ? 'no [data-e2e="data-table-sort"] readout was found'
      : !found.nextFound
      ? "the pager's Next control was not found"
      : !baseline.ok
      ? "the state reader could not read the card it just found"
      : "card, Merchant header, readout and pager all found",
  )
  check(
    "unsorted, the table shows its rows in input order and no header carries aria-sort",
    baseline.rowKeys.join(",") === "inv-1,inv-2,inv-3" && baseline.merchantAriaSort === null &&
      baseline.ariaSortCount === 0 && baseline.readout === "sort: none",
    `rows ${baseline.rowKeys.join(",")}, merchant aria-sort ${
      String(baseline.merchantAriaSort)
    }, ${baseline.ariaSortCount} header(s) sorted, readout "${baseline.readout}"`,
  )

  // Click half: the same column, twice, sorted then reversed — then a third click to confirm the
  // rule cycles off (asc → desc → off) rather than only ever toggling between the two directions.
  // Each click is a real `Input.dispatchMouseEvent` at the button's own rectangle, not a scripted
  // `.click()`, and each check asserts the press actually landed on the button before trusting
  // anything that followed it.
  const clickedOnce = await clickMerchantHeader(devtools)
  check(
    "a real mouse click on a sortable header lands on the button, sorts by it, and changes the row order",
    clickedOnce.onTarget && baseline.rowKeys.join(",") !== clickedOnce.state.rowKeys.join(",") &&
      clickedOnce.state.merchantAriaSort === "ascending" && clickedOnce.state.ariaSortCount === 1,
    !clickedOnce.onTarget
      ? `the press landed on ${clickedOnce.landingTag}, not the Merchant header button`
      : `rows ${baseline.rowKeys.join(",")} → ${clickedOnce.state.rowKeys.join(",")}, aria-sort ` +
        `${String(baseline.merchantAriaSort)} → ${String(clickedOnce.state.merchantAriaSort)}`,
  )

  const clickedTwice = await clickMerchantHeader(devtools)
  check(
    "clicking that header again reverses the sort, and the row order changes again",
    clickedTwice.onTarget &&
      clickedOnce.state.rowKeys.join(",") !== clickedTwice.state.rowKeys.join(",") &&
      clickedTwice.state.merchantAriaSort === "descending" &&
      clickedTwice.state.ariaSortCount === 1,
    !clickedTwice.onTarget
      ? `the press landed on ${clickedTwice.landingTag}, not the Merchant header button`
      : `rows ${clickedOnce.state.rowKeys.join(",")} → ${clickedTwice.state.rowKeys.join(",")}, ` +
        `aria-sort ${String(clickedOnce.state.merchantAriaSort)} → ` +
        `${String(clickedTwice.state.merchantAriaSort)}`,
  )

  const clickedThrice = await clickMerchantHeader(devtools)
  check(
    "a third click on the same header clears its sort, back to the unsorted baseline",
    clickedThrice.onTarget &&
      clickedThrice.state.rowKeys.join(",") === baseline.rowKeys.join(",") &&
      clickedThrice.state.merchantAriaSort === null && clickedThrice.state.ariaSortCount === 0,
    !clickedThrice.onTarget
      ? `the press landed on ${clickedThrice.landingTag}, not the Merchant header button`
      : `rows ${clickedTwice.state.rowKeys.join(",")} → ${
        clickedThrice.state.rowKeys.join(",")
      }, ` +
        `aria-sort ${String(clickedTwice.state.merchantAriaSort)} → ` +
        `${String(clickedThrice.state.merchantAriaSort)}`,
  )

  // Space half: the same two transitions, driven by a real key press on the focused header
  // button rather than a click, starting from the baseline the click half just returned to.
  // Parked first: the click half left the pointer resting on the Merchant button, and a hover
  // style is not part of what this half is proving.
  await pointerToCorner(devtools)
  await devtools.evaluate<null>(`(globalThis.__verifyDataTable?.merchant?.focus(), null)`)
  const pressedOnce = await pressMerchantHeader(devtools)
  check(
    "a real Space press on the focused header sorts by it, and keeps focus on the header",
    baseline.rowKeys.join(",") !== pressedOnce.rowKeys.join(",") &&
      pressedOnce.merchantAriaSort === "ascending" && pressedOnce.onMerchant,
    !pressedOnce.onMerchant
      ? `the press moved focus off the Merchant header`
      : `rows ${baseline.rowKeys.join(",")} → ${pressedOnce.rowKeys.join(",")}, aria-sort ` +
        `${String(baseline.merchantAriaSort)} → ${String(pressedOnce.merchantAriaSort)}`,
  )

  const pressedTwice = await pressMerchantHeader(devtools)
  check(
    "a second Space press reverses the sort again, still without losing focus",
    pressedOnce.rowKeys.join(",") !== pressedTwice.rowKeys.join(",") &&
      pressedTwice.merchantAriaSort === "descending" && pressedTwice.onMerchant,
    !pressedTwice.onMerchant
      ? "the second press moved focus off the Merchant header"
      : `rows ${pressedOnce.rowKeys.join(",")} → ${pressedTwice.rowKeys.join(",")}, aria-sort ` +
        `${String(pressedOnce.merchantAriaSort)} → ${String(pressedTwice.merchantAriaSort)}`,
  )

  // A real Enter press, on its own: the two presses above only prove Space reaches the header's
  // handler — a handler that called `preventDefault()` on Enter specifically would still pass both
  // of them (#261). Reverses the sort a third time, which conveniently is also the "back to
  // unsorted" step the paging check below needs.
  const pressedThrice = await pressMerchantHeader(devtools, "Enter")
  check(
    "a real Enter press on the focused header cycles the sort off again, still keeping focus",
    pressedTwice.rowKeys.join(",") !== pressedThrice.rowKeys.join(",") &&
      pressedThrice.merchantAriaSort === null && pressedThrice.onMerchant,
    !pressedThrice.onMerchant
      ? "the Enter press moved focus off the Merchant header"
      : `rows ${pressedTwice.rowKeys.join(",")} → ${pressedThrice.rowKeys.join(",")}, aria-sort ` +
        `${String(pressedTwice.merchantAriaSort)} → ${String(pressedThrice.merchantAriaSort)}`,
  )
  await blurActive(devtools)

  await dataTablePagingCheck(devtools)
  // The URL-bound demo is the host's own, and it lives on the guide's signals page.
  await openGuidePage(devtools, "signals")
  await dataTableUrlSortCheck(devtools)
  await openGuidePage(devtools, "ui")
}

/** A real mouse click on the Merchant header button, and where it landed. */
interface MerchantClick {
  /** The state once the click has settled. */
  state: DataTableState
  /** `true` when the press landed on the Merchant header button, or something inside it. */
  onTarget: boolean
  /** What the press actually landed on, for the failure message. */
  landingTag: string
}

/** Expression `aimAt`/`clickAt` read the Merchant header button through. */
const MERCHANT_TARGET = "globalThis.__verifyDataTable?.merchant ?? null"

/**
 * Click the Merchant header button with a real `Input.dispatchMouseEvent` at its own rectangle —
 * not a scripted `.click()`, which fires with no hit-testing and would still "click" a button
 * `pointer-events-none` had made unreachable by an actual pointer.
 *
 * Scrolled into view first: the coordinate `aimAt` derives is a viewport point, and the DataTable
 * card sits well down the page, below every check that ran before this file's own — a real click
 * dispatched at a point nothing has scrolled to lands on whatever is visible there instead, not on
 * a button that is currently off-screen.
 */
async function clickMerchantHeader(devtools: Devtools): Promise<MerchantClick> {
  const before = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  await centreInView(devtools, `globalThis.__verifyDataTable?.merchant ?? null`)
  const aim = await aimAt(devtools, MERCHANT_TARGET)
  const landing = await clickAt(devtools, aim, MERCHANT_TARGET)
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_STATE}.readout !== ${JSON.stringify(before.readout)}`,
      ),
    2_000,
  )
  const state = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  return { state, onTarget: landing?.onTarget === true, landingTag: landing?.tag ?? "nothing" }
}

/**
 * Press a key on whatever holds focus (the Merchant header, throughout this file's Space and Enter
 * halves). Defaults to Space, which every existing call site still asks for by name.
 */
async function pressMerchantHeader(
  devtools: Devtools,
  key: "Space" | "Enter" = "Space",
): Promise<DataTableState> {
  const before = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  await pressKey(devtools, key)
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_STATE}.readout !== ${JSON.stringify(before.readout)}`,
      ),
    2_000,
  )
  return await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
}

/**
 * Paging: pressing the pager's Next control moves to the last page and the rows change, and focus
 * stays on Next the same way it does in `paginationChecks` above — `DataTable` renders a real
 * `Pagination`, so this is that same contract, read off the DataTable card instead.
 *
 * @param devtools The connected session, unsorted (the block above leaves it that way) and on the
 *   pager's first page.
 */
async function dataTablePagingCheck(devtools: Devtools): Promise<void> {
  const before = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  await devtools.evaluate<null>(`(globalThis.__verifyDataTable?.next?.focus(), null)`)
  const onNext = await devtools.evaluate<boolean>(
    `document.activeElement === globalThis.__verifyDataTable?.next`,
  )

  await pressKey(devtools, "Space")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `${DATA_TABLE_STATE}.rowKeys.join(",") !== ${JSON.stringify(before.rowKeys.join(","))}`,
      ),
    2_000,
  )
  const after = await devtools.evaluate<DataTableState>(DATA_TABLE_STATE)
  const afterOnNext = await devtools.evaluate<boolean>(
    `document.activeElement === globalThis.__verifyDataTable?.next`,
  )
  const nextDisabled = await devtools.evaluate<string | null>(
    `globalThis.__verifyDataTable?.next?.getAttribute("aria-disabled") ?? null`,
  )

  check(
    "a real Space press on the pager's focused Next control turns the page and its rows change",
    before.rowKeys.join(",") === "inv-1,inv-2,inv-3" && onNext &&
      after.rowKeys.join(",") === "inv-4,inv-5",
    !onNext
      ? "Next never took focus, so nothing was pressed"
      : before.rowKeys.join(",") !== "inv-1,inv-2,inv-3"
      ? `the page did not start on its first, unsorted page: ${before.rowKeys.join(",")}`
      : `rows ${before.rowKeys.join(",")} → ${after.rowKeys.join(",")}`,
  )
  check(
    "turning the page does not lose the reader's place: focus stays on Next",
    afterOnNext,
    afterOnNext ? "focus is still on Next" : "focus moved off Next when the page turned",
  )
  check(
    "Next reports it cannot act once the pager is on its last page",
    nextDisabled === "true",
    `Next's aria-disabled is ${String(nextDisabled)} on a 2-page pager's last page`,
  )
}

/** One read of `pages/src/data-table-sort.tsx`'s own card: its rows and its Customer column. */
interface DataTableUrlState {
  /** `false` when the section this file drives is missing. */
  ok: boolean
  /** `data-row-key` of every row on screen, in document order. */
  rowKeys: string[]
  /** `aria-sort` of the Customer column's `<th>`, or `null` when it carries none. */
  ariaSort: string | null
  /** `location.search`, `?` included. */
  search: string
  /** `history.length`, so one press costs exactly one entry. */
  entries: number
}

/** Park references to the URL-bound demo's section and its Customer header button. */
const DATA_TABLE_URL_SETUP = `(() => {
  const section = document.querySelector('[data-e2e="data-table-sort-url"]')
  const button = section
    ? ([...section.querySelectorAll("th button")].find((b) => b.textContent.includes("Customer")) ?? null)
    : null
  globalThis.__verifyDataTableUrl = { section, button }
  return { found: section !== null, buttonFound: button !== null }
})()`

/** Rows, the Customer column's `aria-sort`, and the address, read in one round trip. */
const DATA_TABLE_URL_STATE = `(() => {
  const store = globalThis.__verifyDataTableUrl
  if (!store || !store.section) {
    return { ok: false, rowKeys: [], ariaSort: null, search: "", entries: -1 }
  }
  const rowKeys = [...store.section.querySelectorAll("[data-row-key]")]
    .map((el) => el.getAttribute("data-row-key"))
  return {
    ok: true,
    rowKeys,
    ariaSort: store.button ? store.button.closest("th").getAttribute("aria-sort") : null,
    search: location.search,
    entries: history.length,
  }
})()`

/**
 * Read the URL-bound demo once it has stopped moving: two identical readings in a row.
 *
 * `useUrlFilters` writes the address from a `useSignalEffect`, a render cycle behind the signal
 * write that also drives `DataTable`'s own re-render — polling on one field alone caught that gap
 * both ways: `search` moved once while `aria-sort` still read the pre-press value, and `aria-sort`
 * moved once while `search` still read the pre-press address. Waiting for the whole reading to
 * repeat itself is what `pages/checks/signals.ts`'s own `settled` does for the same reason, over
 * the same two effects.
 */
async function settledDataTableUrlState(devtools: Devtools): Promise<DataTableUrlState> {
  let previous: DataTableUrlState | null = null
  let steady: DataTableUrlState | null = null
  await poll(async () => {
    const current = await devtools.evaluate<DataTableUrlState>(DATA_TABLE_URL_STATE)
    const same = previous !== null && previous.ok === current.ok &&
      previous.search === current.search && previous.entries === current.entries &&
      previous.ariaSort === current.ariaSort &&
      previous.rowKeys.join(",") === current.rowKeys.join(",")
    previous = current
    if (same) steady = current
    return same
  }, 2_000)
  return steady ?? previous ?? await devtools.evaluate<DataTableUrlState>(DATA_TABLE_URL_STATE)
}

/**
 * The URL half of `DataTable`'s sort contract: `pages/src/data-table-sort.tsx` binds `sort` to
 * `?sort=` through `useUrlFilters`, and this is what proves the binding rather than only the
 * conversion `parseSort`/`serializeSort` do — see that file's own doc comment for why the binding
 * lives there and not on a catalogue card.
 *
 * Run after `dataTableChecks`' own block, on an entirely separate `DataTable` instance mounted
 * lower on the same page; nothing above this function touches `location`, so a stray write here
 * would be this check's own doing. Every assertion is a transition off the address this function
 * itself just read, never an assumption about what the address held before it ran — `signals/`'s
 * own checks, in the package block that runs before this one, restore the address they started
 * from, but this function does not depend on knowing what that was.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function dataTableUrlSortCheck(devtools: Devtools): Promise<void> {
  const found = await devtools.evaluate<{ found: boolean; buttonFound: boolean }>(
    DATA_TABLE_URL_SETUP,
  )
  const before = await settledDataTableUrlState(devtools)
  check(
    "the URL-bound DataTable demo renders its section and a Customer header button",
    found.found && found.buttonFound && before.ok,
    !found.found
      ? 'there is no [data-e2e="data-table-sort-url"] section to drive'
      : !found.buttonFound
      ? 'no header button whose text includes "Customer" was found'
      : !before.ok
      ? "the state reader could not read the section it just found"
      : "section and Customer header button both found",
  )

  await devtools.evaluate<null>(`(globalThis.__verifyDataTableUrl?.button?.click(), null)`)
  const pressed = await settledDataTableUrlState(devtools)

  check(
    "pressing a header on the URL-bound demo writes its sort to the address as ?sort=",
    pressed.search !== before.search &&
      (pressed.search.includes("sort=customer%3Aasc") ||
        pressed.search.includes("sort=customer:asc")),
    `search ${before.search || "(empty)"} → ${pressed.search}`,
  )
  check(
    "that write costs exactly one history entry",
    pressed.entries - before.entries === 1,
    `history.length ${before.entries} → ${pressed.entries}`,
  )
  check(
    "the same press sorts the demo's own rows and marks the column aria-sort=ascending",
    before.rowKeys.join(",") !== pressed.rowKeys.join(",") && pressed.ariaSort === "ascending",
    `rows ${before.rowKeys.join(",")} → ${pressed.rowKeys.join(",")}, aria-sort ` +
      `${String(before.ariaSort)} → ${String(pressed.ariaSort)}`,
  )

  await devtools.evaluate<null>(`(history.back(), null)`)
  const backed = await settledDataTableUrlState(devtools)

  check(
    "one press of Back restores the address, the row order, and drops aria-sort",
    backed.search === before.search && backed.rowKeys.join(",") === before.rowKeys.join(",") &&
      backed.ariaSort === null,
    `search ${pressed.search} → ${backed.search}, rows ${pressed.rowKeys.join(",")} → ` +
      `${backed.rowKeys.join(",")}, aria-sort ${String(pressed.ariaSort)} → ${
        String(backed.ariaSort)
      }`,
  )

  await blurActive(devtools)
}

/**
 * `EnhancedForm`, and the sign-up and contact forms its card builds from it:
 * progressive-enhancement forms proven twice — once hydrated, in the functions below, and once with
 * no script running at all, in {@link enhancedFormsNoScriptChecks}.
 *
 * Every form lives in the `EnhancedForm` card, `ui-guide/sections/enhanced-forms.tsx`, and posts to
 * `form-demo/`, a static page `pages/build.ts` copies into the artefact verbatim. With scripts on,
 * `onSubmit` intercepts every submit below and the page never navigates there — that page only
 * matters to the no-JavaScript check, which reads the method and the body off the recorded network
 * request rather than assuming either: **only the local preview server this file's own `verify` run
 * drives answers a POST there.** The published GitHub Pages copy is a static host and answers one
 * with `405`.
 *
 * **Card lifetimes.** A submit that reaches `"done"` replaces a form's fields with a thank-you
 * message for good.
 *
 * - The primary `EnhancedForm` demo has no way back, so it takes its two failure proofs first
 *   ({@link enhancedFormAsyncFailureCheck}, {@link enhancedFormSynchronousThrowCheck}, both of
 *   which land back on `"idle"`) and its success proof last ({@link enhancedFormResultChecks}).
 * - The sign-up and contact cards hold one form each and a "Start over" button that remounts it.
 *   Every check that submits one of them starts with {@link startOver}, so the order among them
 *   does not matter.
 */

/** One read of a card's live region and its `<fieldset>`. */
interface EnhancedFormReading {
  /** The region's own text. */
  region: string
  /** Whether the region carries `sr-only` — hidden from sighted users because a slot already shows
   * the same result in view; see `EnhancedForm`'s own doc for why. */
  regionSrOnly: boolean
  /** Whether the card's `<fieldset>` is disabled. `false` once no `<fieldset>` is rendered at all,
   * which is what a `done`/`failed` slot without one of its own looks like. */
  disabled: boolean
}

/** Read one card's live region and `<fieldset>` state in one round trip. */
async function enhancedFormReading(devtools: Devtools, card: string): Promise<EnhancedFormReading> {
  return await devtools.evaluate<EnhancedFormReading>(`(() => {
    const c = document.querySelector('${card}')
    const region = c ? c.querySelector('[role="status"]') : null
    const fieldset = c ? c.querySelector('fieldset') : null
    return {
      region: region ? region.textContent : "",
      regionSrOnly: region ? region.className.split(/\\s+/).includes("sr-only") : false,
      disabled: fieldset ? fieldset.disabled : false,
    }
  })()`)
}

/** Whether the card's live region currently holds document focus. */
async function regionHasFocus(devtools: Devtools, card: string): Promise<boolean> {
  return await devtools.evaluate<boolean>(
    `document.activeElement === document.querySelector('${card} [role="status"]')`,
  )
}

/**
 * Mark the card's current live-region node, so a later {@link regionIdentityHeld} can prove it is
 * still the exact same, connected node — not a new one Preact created because an unkeyed `<p>`
 * elsewhere in the same children array matched it by type. See `EnhancedForm`'s own doc for the
 * defect this guards.
 */
async function stashRegionIdentity(devtools: Devtools, card: string): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    globalThis.__verifyRegionIdentity = document.querySelector('${card} [role="status"]')
    return null
  })()`)
}

/** Whether the card's live region is still the exact node {@link stashRegionIdentity} marked. */
async function regionIdentityHeld(devtools: Devtools, card: string): Promise<boolean> {
  return await devtools.evaluate<boolean>(`(() => {
    const current = document.querySelector('${card} [role="status"]')
    return current !== null && current === globalThis.__verifyRegionIdentity && current.isConnected
  })()`)
}

/**
 * Set a checkbox to `checked`, click it only if it is not already there, and read `.checked` back —
 * never assume a click landed. Every toggle in this section's cards goes through this rather than a
 * bare `?.click()`, after a mutation test found that a toggle whose selector stopped matching (a
 * renamed `data-e2e`, say) failed silently: the click was a no-op, the demo's own submit behaved as
 * if the toggle had never been touched, and the check reading the *outcome* of that submit passed or
 * failed for a reason that had nothing to do with what it thought it was testing.
 *
 * @param devtools The connected session.
 * @param selector The checkbox.
 * @param checked The state it must end up in.
 * @returns Whether the checkbox exists and now reads `checked` as asked — `false` for either a
 * missing element or a click that did not take.
 */
async function setToggle(devtools: Devtools, selector: string, checked: boolean): Promise<boolean> {
  return await devtools.evaluate<boolean>(`(() => {
    const el = document.querySelector('${selector}')
    if (!el) return false
    if (el.checked !== ${checked}) el.click()
    return el.checked === ${checked}
  })()`).catch(() => false)
}

/** One read of whether a card is ready to be submitted again — see {@link cardCanSubmit}. */
interface CardReadiness {
  ok: boolean
  reason: string
}

/**
 * Whether a card has a submit button that is not inside a disabled `<fieldset>` — the precondition
 * every check in this section that is about to submit a card checks first, so a card an earlier
 * check left disabled, terminal (its fields replaced by a `done`/`failed` slot with no button at
 * all) or simply missing — the exact shape a renamed `data-e2e` or a mutated component leaves behind
 * — is reported as its own named failure instead of a `null` dereference a few lines further down
 * that would abort every check the rest of this file still has to run.
 *
 * @param devtools The connected session.
 * @param card The card's own selector.
 */
async function cardCanSubmit(devtools: Devtools, card: string): Promise<CardReadiness> {
  return await devtools.evaluate<CardReadiness>(`(() => {
    const root = document.querySelector('${card}')
    if (!root) return { ok: false, reason: "no card found at all" }
    const button = root.querySelector('button[type="submit"]')
    if (!button) return { ok: false, reason: "no submit button — the card may be in its terminal, fields-replaced state" }
    const fieldset = root.querySelector("fieldset")
    if (fieldset && fieldset.disabled) return { ok: false, reason: "the card's fieldset is disabled" }
    return { ok: true, reason: "" }
  })()`).catch(() => ({ ok: false, reason: "the card could not be read at all" }))
}

/**
 * Press a sign-up or contact card's "Start over" button and wait for the fresh form it mounts, then
 * report whether that form is ready to submit, as {@link cardCanSubmit} does.
 *
 * Each of those cards holds one form, and a sent form stays sent, so every check that submits one
 * starts here. The press is a scripted `.click()` on purpose: a real click would move focus to the
 * button, and several checks below are about where focus is, and is not, when a submit lands. The
 * fresh form is recognised by its counter reading 0 and its live region being empty, which is what
 * a remount through `key` and the reset counter leave behind.
 *
 * @param devtools The connected session.
 * @param card The card's own selector, holding a `[data-e2e$="-start-over"]` button.
 */
async function startOver(devtools: Devtools, card: string): Promise<CardReadiness> {
  const pressed = await devtools.evaluate<boolean>(`(() => {
    const button = document.querySelector('${card} [data-e2e$="-start-over"]')
    if (!button) return false
    button.click()
    return true
  })()`)
  if (!pressed) return { ok: false, reason: "the card has no Start over button" }

  const fresh = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const root = document.querySelector('${card}')
        const count = root?.querySelector('[data-e2e$="-subscribes"], [data-e2e$="-leads"]')
        const region = root?.querySelector('[role="status"]')
        return /: 0$/.test(count?.textContent.trim() ?? "") && (region?.textContent ?? "") === ""
      })()`),
    2_000,
  )
  if (!fresh) return { ok: false, reason: "Start over did not bring back a fresh, empty form" }
  return await cardCanSubmit(devtools, card)
}

/**
 * `EnhancedForm`'s own card, failing through a rejected promise — the ordinary async path, and the
 * first of two failure proofs this card runs before the success proof that finally consumes it
 * (see this section's own module doc).
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function enhancedFormAsyncFailureCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="enhanced-form"]'
  const toggle = `${card} [data-e2e="enhanced-form-fail-toggle"]`

  const ready = await cardCanSubmit(devtools, card)
  const toggledOn = ready.ok && await setToggle(devtools, toggle, true)
  check(
    "EnhancedForm's card is ready and its fail toggle switches on",
    ready.ok && toggledOn,
    ready.ok ? `fail toggle switched on: ${toggledOn}` : ready.reason,
  )
  if (!ready.ok || !toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const failed = await poll(
    async () =>
      (await enhancedFormReading(devtools, card)).region ===
        "Something went wrong. Please try again.",
    2_000,
  )
  const after = await enhancedFormReading(devtools, card)

  check(
    'EnhancedForm\'s own card: a rejected promise ends in "failed", with no failed slot given',
    failed && !after.disabled,
    `region reached the default failure text: ${failed} ("${after.region}"); fieldset ` +
      `re-enabled once settled: ${!after.disabled}`,
  )

  // Turn the toggle back off — the synchronous-throw check below reuses this same card.
  const toggledOff = await setToggle(devtools, toggle, false)
  check(
    "EnhancedForm's fail toggle switches back off",
    toggledOff,
    `fail toggle switched off: ${toggledOff}`,
  )
}

/**
 * `EnhancedForm`'s own card again, failing through a throw before `onSubmit` ever returns a
 * promise. `Promise.resolve().then(() => onSubmit(data))` is what folds a synchronous throw into
 * the same `"failed"` path a rejection takes; this is the check that proves the fold rather than
 * assuming it works because the rejection path does.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function enhancedFormSynchronousThrowCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="enhanced-form"]'
  const toggle = `${card} [data-e2e="enhanced-form-throw-sync-toggle"]`

  const ready = await cardCanSubmit(devtools, card)
  const toggledOn = ready.ok && await setToggle(devtools, toggle, true)
  check(
    "EnhancedForm's card is ready and its synchronous-throw toggle switches on",
    ready.ok && toggledOn,
    ready.ok ? `throw-sync toggle switched on: ${toggledOn}` : ready.reason,
  )
  if (!ready.ok || !toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const failed = await poll(
    async () =>
      (await enhancedFormReading(devtools, card)).region ===
        "Something went wrong. Please try again.",
    2_000,
  )
  const after = await enhancedFormReading(devtools, card)

  check(
    'EnhancedForm\'s own card: a synchronous throw from onSubmit also ends in "failed"',
    failed && !after.disabled,
    `region reached the default failure text: ${failed} ("${after.region}"); fieldset ` +
      `re-enabled once settled: ${!after.disabled}`,
  )

  const toggledOff = await setToggle(devtools, toggle, false)
  check(
    "EnhancedForm's synchronous-throw toggle switches back off",
    toggledOff,
    `throw-sync toggle switched off: ${toggledOff}`,
  )
}

/**
 * `EnhancedForm`'s own card, last of its three checks because this is the one that succeeds and
 * consumes it for good (see this section's own module doc): a submit announces `"Sending…"`, then
 * replaces the field with the card's explicit `done` slot and announces `"Sent."` — on the *same*
 * live-region node the page started with, which is what proves the key/wrapper fix actually stops
 * Preact from reusing that node for the slot's own content (see `EnhancedForm`'s own doc). It also
 * proves the region hides itself from sighted users once the slot is showing, and that focus lands
 * on the region rather than being dropped onto `<body>` once the pressed button is gone.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function enhancedFormResultChecks(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="enhanced-form"]'

  const ready = await cardCanSubmit(devtools, card)
  check(
    "EnhancedForm's card is ready to submit before its success check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  const before = await enhancedFormReading(devtools, card)
  await stashRegionIdentity(devtools, card)

  // A real, dispatched click rather than a scripted `.click()`: the focus-restoring effect only
  // acts when focus was inside the form at submit time, which a script-triggered `.click()` does
  // not reliably produce (unlike a real pointer press, `.click()` fires the click event without
  // necessarily moving focus first) — this check's own "focus moves to the region" assertion needs
  // a genuine press for that reason, not only for realism.
  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the click that starts EnhancedForm's success run lands on its own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return
  await clickAtPoint(devtools, point)

  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).region === "Sending…",
    1_000,
  )
  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region === "Sent.",
    3_000,
  )
  const after = await enhancedFormReading(devtools, card)
  const identityHeld = await regionIdentityHeld(devtools, card)
  const doneSlotShown = await devtools.evaluate<boolean>(
    `document.querySelector('${card}').textContent.includes("Done.")`,
  )
  const focusedRegion = await regionHasFocus(devtools, card)

  check(
    'EnhancedForm announces "Sending…", then replaces its field with the done slot and ' +
      'announces "Sent." on the same live-region node the card started this submit with',
    sending && settled && doneSlotShown && identityHeld,
    `region "${before.region}" (leftover from this card's own earlier failure checks) → reached ` +
      `"Sending…": ${sending} → reached "Sent.": ${settled} ("${after.region}"), done slot on ` +
      `screen: ${doneSlotShown}, same connected region node throughout: ${identityHeld}`,
  )
  check(
    "the region hides itself from sighted users once the done slot shows the same result in view",
    after.regionSrOnly,
    `region class ${after.regionSrOnly ? "carries" : "does not carry"} sr-only once done`,
  )
  check(
    "focus moves to the live region once the submit button the visitor pressed is gone",
    focusedRegion,
    focusedRegion
      ? "document.activeElement is the live region"
      : "focus did not land on the region — a keyboard user may have been dropped onto <body>",
  )
}

/** Scroll an element into view, wait for the page to stop moving, then read its centre point. */
/** Scroll an element into view and read its on-screen centre — see {@link elementCenter}. */
interface ElementCenter {
  /** `true` when the element was found, scrolled to and confirmed under its own centre point. */
  ok: boolean
  x: number
  y: number
  /** Why `ok` is `false`, for the caller's own failure detail. */
  reason: string
}

/**
 * Scroll an element into view, wait for the page to stop moving, read its centre point, and confirm
 * with `elementFromPoint` that the point actually lands on the element (or a descendant of it) —
 * before any caller dispatches a real mouse event there. A point derived from a rectangle read a
 * moment too early or too late (mid-animation, or after an unrelated layout shift elsewhere on this
 * considerably tall page) can be a real coordinate that no longer lands where it was aimed, and a
 * click dispatched there proves nothing about the element the caller meant to press.
 *
 * @param devtools The connected session.
 * @param selector The element.
 */
async function elementCenter(devtools: Devtools, selector: string): Promise<ElementCenter> {
  const found = await devtools.evaluate<boolean>(`document.querySelector('${selector}') !== null`)
  if (!found) return { ok: false, x: -1, y: -1, reason: "no such element" }

  await centreInView(devtools, `document.querySelector('${selector}')`)

  return await devtools.evaluate<ElementCenter>(`(() => {
    const el = document.querySelector('${selector}')
    if (!el) return { ok: false, x: -1, y: -1, reason: "element disappeared after settling" }
    const rect = el.getBoundingClientRect()
    const x = Math.round(rect.left + rect.width / 2)
    const y = Math.round(rect.top + rect.height / 2)
    const under = document.elementFromPoint(x, y)
    const onTarget = under !== null && (under === el || el.contains(under))
    return {
      ok: onTarget,
      x,
      y,
      reason: onTarget
        ? ""
        : "elementFromPoint(" + x + ", " + y + ") found " +
          (under ? under.tagName : "nothing") + ", not the target",
    }
  })()`).catch(() => ({ ok: false, x: -1, y: -1, reason: "the page could not be read" }))
}

/**
 * Press and release the left mouse button once at one point, through the browser's own input
 * pipeline. `clickAt` elsewhere in this file does the same for a point derived a different way;
 * this one exists for {@link doubleClickAt}, which needs `clickCount` to genuinely increment the
 * way a person's second press does rather than reusing one dispatch twice.
 *
 * @param clickCount `1` for an ordinary click, `2` for the second half of a double click —
 * `MouseEvent.detail`'s own meaning, which is what lets {@link doubleClickAt} build one from two
 * calls to this rather than duplicating the dispatch.
 */
async function clickAtPoint(
  devtools: Devtools,
  point: { x: number; y: number },
  clickCount = 1,
): Promise<void> {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount,
    })
  }
}

/**
 * Press and release the left mouse button twice at one point, back to back — a real double click,
 * `clickCount` incrementing the way a person's second press does, rather than two scripted
 * `.click()` calls a page's own code could never tell apart from one call made twice.
 */
async function doubleClickAt(devtools: Devtools, point: { x: number; y: number }): Promise<void> {
  await clickAtPoint(devtools, point, 1)
  await clickAtPoint(devtools, point, 2)
}

/**
 * The sign-up form: a real double click on the submit button, dispatched through
 * `Input.dispatchMouseEvent` rather than two scripted `.click()` calls, still calls `onSubmit`
 * once.
 *
 * **This does not isolate the synchronous `busyRef` guard from the disabled `<fieldset>`.** A real
 * double click carries the round trip a `Runtime.evaluate` call to dispatch each press costs, and
 * that gap was measured to be enough for Preact to have already disabled the fieldset by the time
 * the second press lands — with the guard itself removed, this check stays green, because the
 * disabled button alone already stops the second press from doing anything. What isolates the guard
 * on its own, with no gap for a re-render to close, is {@link signUpFormRequestSubmitGuardCheck}:
 * two `form.requestSubmit()` calls made in the same script turn, before either can yield back to the
 * event loop. This check still matters on its own terms — a real double click is closer to what a
 * person actually does than a scripted call ever proves — it just proves a different thing.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function signUpFormDoubleClickCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const counter = `${card} [data-e2e="signup-form-subscribes"]`

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's primary card is ready to submit before the double click",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    return null
  })()`)

  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the double click's aim lands on the sign-up form's own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return

  await doubleClickAt(devtools, point)

  // `onSubmit`'s own increment runs before its 300ms delay, so the counter settles almost at once;
  // the region only reaches "done" once that delay elapses. Reading the counter at both moments is
  // what catches a second call whose increment landed late, after the first read below.
  const reachedOne = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${counter}')?.textContent.includes("subscribes: 1") ?? false`,
      ),
    500,
  )
  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  const final = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "a real double click on the sign-up form's submit button calls onSubmit once",
    reachedOne && settled && final.includes("subscribes: 1"),
    `counter reached "subscribes: 1" shortly after the double click: ${reachedOne}; region ` +
      `reached "You're subscribed…": ${settled}; counter once settled: "${final.trim()}"`,
  )
}

/**
 * The sign-up form: two `form.requestSubmit()` calls made in the same script turn,
 * with no real click and so no focus ever placed anywhere in the form.
 *
 * This is what isolates `EnhancedForm`'s synchronous busy guard from the disabled `<fieldset>` a
 * slower, real double click is also stopped by (see {@link signUpFormDoubleClickCheck}'s own
 * doc for the measurement) — `requestSubmit()` calls the form's submit algorithm directly, twice,
 * before either call yields back to the event loop for Preact to re-render anything. Only the ref
 * checked synchronously inside `handleSubmit`, before either branch runs, can catch that.
 *
 * The same run also proves the focus-theft fix: since nothing here ever focuses the form, the
 * region must never take focus once the (single, guarded) submit resolves, and the page must not
 * scroll — both of which the earlier version of this component did, for any submit that happened to
 * settle while `document.activeElement` was `<body>`, whether or not a visitor was ever engaging
 * with this particular form.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function signUpFormRequestSubmitGuardCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const counter = `${card} [data-e2e="signup-form-subscribes"]`

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's request-submit card is ready to submit before this check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  // Blurred explicitly, rather than assumed: whatever an earlier check left focused (the live
  // region from `enhancedFormResultChecks`, say) must not still be inside this card by accident,
  // since this check's whole point is that nothing here ever focuses anything.
  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    document.activeElement?.blur?.()
    return null
  })()`)

  const scrollBefore = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")
    .catch(() => -1)
  const focusedBefore = await devtools.evaluate<string>(
    `document.activeElement === document.body ? "body" : document.activeElement.tagName`,
  ).catch(() => "unreadable")

  await devtools.evaluate<null>(`(() => {
    const form = document.querySelector('${card} form')
    if (form) {
      form.requestSubmit()
      form.requestSubmit()
    }
    return null
  })()`)

  const reachedOne = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${counter}')?.textContent.includes("subscribes: 1") ?? false`,
      ),
    1_000,
  )
  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  const final = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "two form.requestSubmit() calls in the same script turn call onSubmit once",
    focusedBefore === "body" && reachedOne && settled && final.includes("subscribes: 1"),
    focusedBefore !== "body"
      ? `focus was not on <body> before this check even started (${focusedBefore}), so it proves ` +
        "nothing about a submit nobody focused"
      : `counter reached "subscribes: 1" shortly after both calls: ${reachedOne}; region reached ` +
        `"You're subscribed…": ${settled}; counter once settled: "${final.trim()}"`,
  )

  const focusedRegionAfter = await regionHasFocus(devtools, card)
  const scrollAfter = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")
    .catch(() => -2)

  check(
    "a submit nobody focused never steals focus or scrolls the page once it settles",
    !focusedRegionAfter && Math.abs(scrollAfter - scrollBefore) < 5,
    `region focused after settling: ${focusedRegionAfter}; scrollY ${scrollBefore} → ${scrollAfter}`,
  )
}

/**
 * The sign-up form: a real click on the submit button — focus genuinely lands
 * there, unlike {@link signUpFormRequestSubmitGuardCheck}'s `requestSubmit()` calls — and then,
 * while the 150ms submit is still outstanding, focus is moved to an unrelated element elsewhere on
 * the page, standing in for a visitor who submitted and then clicked or tabbed to read something
 * else entirely before the result came back.
 *
 * This is the second half of the focus-theft fix: focus being inside the form *at submit time* is
 * only one of the two conditions `EnhancedForm`'s effect checks. Once the result lands, focus must
 * still be sitting on `<body>` — the state disabling or removing the pressed control actually
 * produces — for the region to take it. A visitor who has since put focus somewhere specific of
 * their own accord is left exactly there, which is what this check asserts by aiming the dummy
 * element it creates for the purpose.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function signUpFormFocusElsewhereCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const dummyId = "verify-focus-elsewhere-dummy"

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's focus-elsewhere card is ready to submit before this check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    return null
  })()`)

  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the click that starts this check lands on its own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return
  await clickAtPoint(devtools, point)

  // Moved away as soon as the submit is confirmed outstanding — a real visitor could not click
  // anywhere before the browser had actually disabled the button, and this check should not either.
  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  // The dummy control's whole lifetime — creating it, reading it back once settled — sits inside
  // this `try`, and removing it again sits inside the matching `finally`, so a throw in between
  // (a stalled poll, a page exception) does not leave a stray element behind on a page every check
  // after this one in the same run still shares.
  let movedAway = false
  let settled = false
  let stillOnDummy = false
  try {
    movedAway = await devtools.evaluate<boolean>(`(() => {
      const dummy = document.createElement("button")
      dummy.type = "button"
      dummy.id = ${JSON.stringify(dummyId)}
      dummy.textContent = "unrelated control"
      dummy.style.cssText = "position:fixed;top:0;left:0"
      document.body.appendChild(dummy)
      dummy.focus()
      return document.activeElement === dummy
    })()`).catch(() => false)

    settled = await poll(
      async () =>
        (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
      2_000,
    )
    stillOnDummy = await devtools.evaluate<boolean>(
      `document.activeElement === document.getElementById(${JSON.stringify(dummyId)})`,
    ).catch(() => false)
  } finally {
    await devtools.evaluate<null>(`(() => {
      document.getElementById(${JSON.stringify(dummyId)})?.remove()
      return null
    })()`).catch(() => null)
  }

  check(
    "a visitor who moved focus elsewhere mid-submit keeps it there once the result lands",
    sending && movedAway && settled && stillOnDummy,
    !sending
      ? "the fieldset never disabled — the click may not have started a real submit"
      : !movedAway
      ? "could not move focus to the dummy control"
      : `settled: ${settled}; focus still on the dummy control once it did: ${stillOnDummy}`,
  )
}

/**
 * The sign-up form: a real click on the submit button, then a blur to `<body>` —
 * not to a specific other control, {@link signUpFormFocusElsewhereCheck}'s own case — while the
 * submit is still outstanding, together with a scroll back to the top of the page.
 *
 * This is the one case the previous round's fix did not cover, because it is not a visitor whose
 * focus was never in the form ({@link signUpFormRequestSubmitGuardCheck}'s case): disabling the
 * fieldset for `"sending"` already drops focus to `<body>` in this browser, so the focus-restoring
 * effect recovers it there — correctly, the first time — before this same submit ever reaches
 * `"done"`. Without clearing the flag that let that first recovery happen, the effect's second run,
 * on the transition to `"done"`, would see the flag still set and `document.activeElement` back on
 * `<body>` — exactly what a visitor clicking on plain text and reading elsewhere also produces — and
 * pull focus back a second time for a visitor this component had already, correctly, let go of.
 *
 * **`#249`: two changes from how this check used to read the page.** First, it waits for the
 * component's own one-time recovery to land — the region holding focus — *before* it does its own
 * blur, rather than racing it: blurring to `<body>` while that recovery is still outstanding would
 * hand the still-set flag exactly the state (`<body>` focused) it treats as its own cue to recover
 * into, for a visitor this check had not yet finished setting up. Second, the blur, the scroll and
 * the first reading of both happen inside one `Runtime.evaluate`, before this check waits on
 * anything else — a separate, later read (the previous shape) can be a read of the *result's* own
 * effects if the submit happens to settle in between, which is a check reading its own setup after
 * the thing it means to guard against has already run. The scroll is `behavior: "instant"` for the
 * same reason `pages/verify.ts`'s own doc gives for `resetAfterThrow`'s identical call:
 * `pages/styles.css` sets `scroll-behavior: smooth` on the document, so a plain `scrollTo(0, 0)`
 * starts an animation still running when this reads `scrollY` right back — instant is what makes
 * that same-evaluate reading the settled position rather than a frame of the animation.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function signUpFormBlurWhileSendingCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const region = `${card} [role="status"]`

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's blur-while-sending card is ready to submit before this check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    return null
  })()`)

  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the click that starts this check lands on its own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return
  await clickAtPoint(devtools, point)

  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  // Wait out the component's own one-time recovery before this check does its own blur — see the
  // JSDoc above. Not a formality: without this, the check's blur can land before that recovery has,
  // and the still-set flag then reads the check's own blur as its cue to recover into.
  const recovered = await poll(() => regionHasFocus(devtools, card), 2_000)

  // Blur, scroll and the first reading of both, in the one evaluate — before this waits on
  // anything else. `behavior: "instant"` is what makes `scrollY` already the settled value here
  // rather than a frame of a smooth-scroll animation still in flight.
  const scrollTarget = await devtools.evaluate<{ blurred: boolean; scrollY: number }>(`(() => {
    document.activeElement?.blur?.()
    globalThis.scrollTo({ top: 0, left: 0, behavior: "instant" })
    return {
      blurred: document.activeElement === document.body,
      scrollY: Math.round(globalThis.scrollY),
    }
  })()`).catch(() => ({ blurred: false, scrollY: -1 }))

  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  await settledScroll(devtools)
  const after = await devtools.evaluate<{ onBody: boolean; onRegion: boolean; scrollY: number }>(
    `(() => ({
      onBody: document.activeElement === document.body,
      onRegion: document.activeElement === document.querySelector('${region}'),
      scrollY: Math.round(globalThis.scrollY),
    }))()`,
  ).catch(() => ({ onBody: false, onRegion: false, scrollY: -2 }))

  check(
    "a visitor who blurs to <body> and scrolls away while sending is not pulled back once it settles",
    sending && recovered && scrollTarget.blurred && settled && after.onBody &&
      after.scrollY === scrollTarget.scrollY,
    !sending
      ? "the fieldset never disabled — the click may not have started a real submit"
      : !recovered
      ? "the component's own one-time recovery never moved focus onto the live region before " +
        "this check blurred, so the blur below cannot be told apart from that recovery's own moment"
      : !scrollTarget.blurred
      ? "could not blur back to <body> — read in the same evaluate as the blur itself"
      : !settled
      ? "the card never reached its 'You're subscribed' result"
      : !after.onBody
      ? after.onRegion
        ? "the result pulled focus back onto the live region after this check had already, " +
          "deliberately, blurred to <body> — a visitor who had moved on to reading something " +
          "else would be dragged back to the form"
        : "focus left <body> for something other than the live region once the result landed"
      : `settled: ${settled}; scrollY ${scrollTarget.scrollY} → ${after.scrollY}`,
  )
}

/** `name` of the honeypot field `ui/honeypot.tsx` exports as `HONEYPOT_FIELD_NAME`. */
const HONEYPOT_INPUT_SELECTOR = 'input[name="hp-field"]'

/**
 * The sign-up form, whose honeypot is on. Two things, both about the same off-screen field:
 *
 * 1. Its computed style, not the literal absence of `display:none` in the markup (a render-to-string
 *    unit test can only show that much, and `ui/honeypot.test.tsx` says so): a real `getComputedStyle`
 *    read proves the field is not `display: none` and is nonetheless invisible, clipped to a
 *    fraction of a pixel.
 * 2. Filling it and submitting: `onSubmit`'s own counter must stay at zero while the card still
 *    reaches its ordinary success text, since a bot that filled the trap is told nothing different
 *    from a person who did not.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function enhancedFormsHoneypotChecks(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const counter = `${card} [data-e2e="signup-form-subscribes"]`

  const ready = await startOver(devtools, card)

  const style = await devtools.evaluate<
    { display: string; wrapperDisplay: string; width: number; height: number } | null
  >(`(() => {
    const input = document.querySelector('${card} ${HONEYPOT_INPUT_SELECTOR}')
    if (!input) return null
    const wrapper = input.closest("div")
    const inputStyle = getComputedStyle(input)
    const wrapperStyle = getComputedStyle(wrapper)
    const rect = wrapper.getBoundingClientRect()
    return {
      display: inputStyle.display,
      wrapperDisplay: wrapperStyle.display,
      width: rect.width,
      height: rect.height,
    }
  })()`)

  check(
    "the honeypot field is hidden by layout, not by display:none — read from its computed style",
    style !== null && style.display !== "none" && style.wrapperDisplay !== "none" &&
      style.width <= 1 && style.height <= 1,
    style === null
      ? "no honeypot field found on the card"
      : `input display: "${style.display}", wrapper display: "${style.wrapperDisplay}", ` +
        `wrapper size ${style.width}×${style.height}px`,
  )

  check("the sign-up form's honeypot card is ready to submit", ready.ok, ready.reason)
  if (!ready.ok) return

  // The email field is required: an empty one fails the browser's own constraint validation and
  // blocks the submit before it ever fires, silently — this card's honeypot proof needs a form
  // that would otherwise submit cleanly, so a bot filling only the trap still has to fill the
  // field a bot filling everything would.
  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    const hp = document.querySelector('${card} ${HONEYPOT_INPUT_SELECTOR}')
    if (email) email.value = "bot@example.com"
    if (hp) hp.value = "http://spam.example"
    return null
  })()`)

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  const calls = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "a filled honeypot resolves as a success without ever calling onSubmit",
    settled && calls.includes("subscribes: 0"),
    `region reached "You're subscribed…": ${settled} even though onSubmit's own counter reads ` +
      `"${calls.trim()}"`,
  )
}

/**
 * The contact form — the same proof {@link enhancedFormsHoneypotChecks}
 * runs against the sign-up form, on the three-field form instead: a filled honeypot resolves as a
 * success without ever calling `onSubmit`.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function contactFormHoneypotCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'
  const counter = `${card} [data-e2e="contact-form-leads"]`

  const ready = await startOver(devtools, card)
  check("the contact form's honeypot card is ready to submit", ready.ok, ready.reason)
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const name = document.querySelector('${card} input[name="name"]')
    const email = document.querySelector('${card} input[name="email"]')
    const message = document.querySelector('${card} textarea[name="message"]')
    const hp = document.querySelector('${card} ${HONEYPOT_INPUT_SELECTOR}')
    if (name) name.value = "Bot Botson"
    if (email) email.value = "bot@example.com"
    if (message) message.value = "Automated message."
    if (hp) hp.value = "http://spam.example"
    return null
  })()`)

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("Thanks"),
    2_000,
  )
  const calls = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "the contact form: a filled honeypot resolves as a success without ever calling onSubmit",
    settled && calls.includes("leads: 0"),
    `region reached "Thanks…": ${settled} even though onSubmit's own counter reads "${calls.trim()}"`,
  )
}

/** Fill the contact form's three fields on the given card. */
async function fillContact(devtools: Devtools, card: string): Promise<void> {
  // Guarded rather than assumed present: a check that runs after an earlier one left the card in
  // its terminal, fields-replaced "done" state has nothing here to fill, and should report that as
  // an ordinary failed check further down — not as an uncaught page exception that takes the rest
  // of this file's checks down with it.
  await devtools.evaluate<null>(`(() => {
    const c = document.querySelector('${card}')
    const name = c?.querySelector('input[name="name"]')
    const email = c?.querySelector('input[name="email"]')
    const message = c?.querySelector('textarea[name="message"]')
    if (name) name.value = "Ada Lovelace"
    if (email) email.value = "ada@example.com"
    if (message) message.value = "Hello there."
    return null
  })()`)
}

/**
 * The contact form's card, submitted normally (no failure, no hang) and reset via a synthetic
 * `pageshow` while its 200ms submit is still outstanding.
 *
 * This is *not* a proof that a genuine back/forward-cache restore fires `pageshow` — that proof is
 * {@link enhancedFormBackForwardCacheCheck}, which drives a real one. This check needs a
 * deterministic, precisely-timed trigger for a narrower thing: does a promise that settles *after*
 * a reset get ignored, rather than resurrecting a status the reset already moved past. A dispatched
 * event is the right tool for that — it tests this component's own listener reacting to the event
 * it is written to handle, not whether the browser's bfcache genuinely produces one, which is a
 * platform contract and not this library's to prove.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function contactFormStaleSubmitCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'

  const ready = await startOver(devtools, card)
  check(
    "the contact form's card is ready to submit before the stale-submit check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await fillContact(devtools, card)
  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  await devtools.evaluate<null>(
    `(globalThis.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })), null)`,
  )
  const resetToIdle = await poll(async () => {
    const reading = await enhancedFormReading(devtools, card)
    return !reading.disabled && reading.region === ""
  }, 1_000)

  // The demo's own submit resolves after 200ms; wait past it so the now-stale promise has settled.
  await new Promise((resolve) => setTimeout(resolve, 500))
  const stillIdle = await enhancedFormReading(devtools, card)

  check(
    "a submit that settles after a pageshow reset does not resurrect the sending state",
    sending && resetToIdle && stillIdle.region === "" && !stillIdle.disabled,
    `fieldset disabled while pending: ${sending}; reset to idle: ${resetToIdle}; half a second ` +
      `after the reset, region reads "${stillIdle.region}" and fieldset disabled: ` +
      `${stillIdle.disabled}`,
  )
}

/** One entry of `Page.getNavigationHistory`'s own list. */
interface HistoryEntry {
  id: number
  url: string
}

/**
 * The contact form's card, stuck `"sending"` forever (the hang toggle) and recovered by a genuine
 * back/forward-cache restore: `Page.navigate` away to `form-demo/`, then
 * `Page.navigateToHistoryEntry` back to the catalogue's own entry — a real round trip through the
 * browser's own history, not `history.back()` run through page script and not a synthetic event.
 * Standalone: it fills and readies the card itself rather than assuming an earlier check in the
 * same run already left it filled.
 *
 * **`Page.frameNavigated`'s own `type` field, checked for the literal `"BackForwardCacheRestore"`,
 * is what decides this check** — see the comment beside where it is asserted, further down, for why
 * a held `performance.getEntriesByType("navigation")` entry (kept as corroborating evidence, along
 * with `PerformanceObserver`'s own `back-forward-cache-restoration` entry when this repository's
 * Chromium build implements it, which measured it does not) is not strong enough evidence on its
 * own: it is ambiguous about a fresh reload of a previously-`"reload"`-typed page, and this exact
 * check happened to only ever exercise the case where that ambiguity does not arise.
 *
 * **Everything from the navigation away onward runs inside a `try`, and restoring runs inside the
 * matching `finally`** — the same shape {@link enhancedFormsNoScriptChecks} and `system/`'s
 * `authFormNoScriptChecks` use, for the same reason: a throw or a stalled navigation partway
 * through must not leave every check after this one running against the wrong page.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function enhancedFormBackForwardCacheCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'
  const toggle = `${card} [data-e2e="contact-form-hang-toggle"]`
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  // Standalone: this check fills the card itself rather than assuming an earlier one in the same
  // run left it filled, and confirms it is actually ready before touching anything.
  const ready = await startOver(devtools, card)
  check(
    "the contact form's card is ready to submit before the back/forward-cache check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await fillContact(devtools, card)
  const toggledOn = await setToggle(devtools, toggle, true)
  check(
    "the contact form's hang toggle switches on",
    toggledOn,
    `hang toggle switched on: ${toggledOn}`,
  )
  if (!toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )
  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  let restored = false
  let genuineRestore = false
  let frameNavigatedType = "(never fired)"
  let bfcacheObserverFired = false
  let recovered = false

  let beforeNav = { type: "", count: -1 }
  let afterNav = { type: "", count: -1 }

  try {
    // Registered on *this* document, before it is frozen, so both survive a genuine back/forward
    // resume the same way the rest of this page's JS state does. Neither is what this check's
    // pass/fail rests on — see the note further down for why — but both are read back as
    // corroborating evidence.
    await devtools.evaluate<null>(`(() => {
      globalThis.__verifyBfcacheRestorations = []
      try {
        new PerformanceObserver((list) => {
          globalThis.__verifyBfcacheRestorations.push(...list.getEntries())
        }).observe({ type: "back-forward-cache-restoration", buffered: true })
      } catch {
        // Not every Chromium build implements this observer entry type at all.
      }
      return null
    })()`).catch(() => null)

    beforeNav = await devtools.evaluate<{ type: string; count: number }>(`(() => {
      const entries = performance.getEntriesByType("navigation")
      return { type: entries[0] ? entries[0].type : "", count: entries.length }
    })()`).catch(() => beforeNav)

    const away = new URL(restoreUrl)
    away.hash = ""
    const formDemoUrl = new URL("form-demo/", away).href
    await devtools.send("Page.navigate", { url: formDemoUrl })
    await waitForNavigation(devtools)

    const history = await devtools.send<{ currentIndex: number; entries: HistoryEntry[] }>(
      "Page.getNavigationHistory",
    )
    const previous = history.entries[history.currentIndex - 1]

    if (previous) {
      // Registered before the navigation it is meant to observe — a waiter only sees events that
      // arrive after it starts listening, so this has to be armed before `navigateToHistoryEntry`,
      // not read after the fact the way the navigation-timing comparison below can be.
      const frameNavigatedPromise = devtools.once<{ type?: string }>(
        "Page.frameNavigated",
        8_000,
      ).then((event) => event.type ?? "(no type field)").catch(() => "(the event never arrived)")

      await devtools.send("Page.navigateToHistoryEntry", { entryId: previous.id })
      frameNavigatedType = await frameNavigatedPromise
      genuineRestore = frameNavigatedType === "BackForwardCacheRestore"

      restored = await poll(
        () =>
          devtools.evaluate<boolean>(`document.querySelector('${card}') !== null`)
            .catch(() => false),
        5_000,
      )
    }

    afterNav = restored
      ? await devtools.evaluate<{ type: string; count: number }>(`(() => {
        const entries = performance.getEntriesByType("navigation")
        return { type: entries[0] ? entries[0].type : "", count: entries.length }
      })()`).catch(() => afterNav)
      : afterNav

    bfcacheObserverFired = restored &&
      await devtools.evaluate<boolean>(
        `(globalThis.__verifyBfcacheRestorations ?? []).length > 0`,
      ).catch(() => false)

    recovered = restored && await poll(async () => {
      const reading = await enhancedFormReading(devtools, card)
      return !reading.disabled && reading.region === ""
    }, 2_000)
  } finally {
    const strayed = await devtools.evaluate<boolean>(
      `location.href !== ${JSON.stringify(restoreUrl)}`,
    ).catch(() => true)
    if (strayed) {
      await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
      await waitForNavigation(devtools)
    }
    await settledScroll(devtools)

    // Leave the hang toggle as it was found, whether or not the round trip above succeeded.
    const toggledOff = await setToggle(devtools, toggle, false)
    check(
      "the contact form's hang toggle switches back off",
      toggledOff,
      `hang toggle switched off: ${toggledOff}`,
    )
  }

  // **`Page.frameNavigated`'s own `type` field — checked for the literal value
  // `"BackForwardCacheRestore"` — is what decides this check, not the navigation-timing comparison
  // below.** That comparison only works because the entry type this exact run happens to start
  // with is one a fresh, non-cached history fetch would also produce under some circumstances (a
  // "reload"-typed entry survives a same-document restore exactly as a "navigate"-typed one does,
  // but a *fresh* load reachable by reloading first would also read "reload", making the comparison
  // alone ambiguous about which one actually happened); `frameNavigated`'s `type` names the
  // outcome directly, from the browser's own navigation state machine, regardless of what the
  // previous entry happened to be. `PerformanceObserver`'s own `back-forward-cache-restoration`
  // entry is read too, and would be stronger evidence than the timing comparison if this repository's
  // Chromium build implemented it — measured: `PerformanceObserver.supportedEntryTypes` does not
  // list it at all — so it is kept only as corroborating evidence, never required.
  const timingHeld = restored && afterNav.count === 1 && beforeNav.count === 1 &&
    afterNav.type === beforeNav.type

  check(
    "a real back/forward-cache restore ends a sending state whose promise will never settle",
    sending && restored && genuineRestore && recovered,
    `fieldset disabled while the promise was pending: ${sending}; landed back on the catalogue: ` +
      `${restored}; Page.frameNavigated reported "${frameNavigatedType}"` +
      `; recovered to idle: ${recovered} — corroborating evidence: navigation-timing entry held ` +
      `(${beforeNav.count} "${beforeNav.type}" → ${afterNav.count} "${afterNav.type}"): ` +
      `${timingHeld}, PerformanceObserver fired: ${bfcacheObserverFired}`,
  )
}

/**
 * The contact form's card: a rejected submit ends the sending state and leaves every field on
 * screen, still holding what the visitor typed, and then an actual second submit — the failure
 * toggle turned off, the same fields resubmitted rather than refilled — proves "leaves the fields
 * for a retry" is true of a real retry, not only of what happens to still be on screen a moment
 * after the first submit failed.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function contactFormFailureRetryChecks(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'
  const toggle = `${card} [data-e2e="contact-form-fail-toggle"]`

  const ready = await startOver(devtools, card)
  check(
    "the contact form's card is ready to submit before the failure-retry check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await fillContact(devtools, card)
  const toggledOn = await setToggle(devtools, toggle, true)
  check(
    "the contact form's fail toggle switches on",
    toggledOn,
    `fail toggle switched on: ${toggledOn}`,
  )
  if (!toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const failed = await poll(
    async () =>
      (await enhancedFormReading(devtools, card)).region ===
        "Something went wrong. Please try again.",
    2_000,
  )
  const afterFailure = await enhancedFormReading(devtools, card)
  const nameKept = await devtools.evaluate<string>(
    `document.querySelector('${card} input[name="name"]')?.value ?? ""`,
  ).catch(() => "")

  check(
    "a rejected contact-form submit ends the sending state and leaves the fields on screen",
    failed && !afterFailure.disabled && nameKept === "Ada Lovelace",
    `region reached the failure text: ${failed} ("${afterFailure.region}"); fieldset disabled ` +
      `once settled: ${afterFailure.disabled}; name field kept "${nameKept}"`,
  )

  const toggledOff = await setToggle(devtools, toggle, false)
  check(
    "the contact form's fail toggle switches back off",
    toggledOff,
    `fail toggle switched off: ${toggledOff}`,
  )
  if (!toggledOff) return

  // The actual retry: the same fields, submitted again, with no refill.
  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )
  const succeeded = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("Thanks"),
    2_000,
  )
  const doneShown = await devtools.evaluate<boolean>(
    `document.querySelector('${card}')?.textContent.includes("Thanks") ?? false`,
  ).catch(() => false)

  check(
    "turning the failure off and pressing submit again — the actual retry — succeeds",
    succeeded && doneShown,
    `region reached "Thanks…": ${succeeded}; the done slot is on screen: ${doneShown}`,
  )
}

/** Wait for the next full navigation, without throwing — see `system/`'s own copy for why. */
async function waitForNavigation(devtools: Devtools, timeoutMs = 20_000): Promise<boolean> {
  try {
    await devtools.next("Page.loadEventFired", timeoutMs)
    return true
  } catch {
    return false
  }
}

/** One card driven by {@link enhancedFormsNoScriptChecks}: its selector and the fields to fill. */
interface NoScriptTarget {
  label: string
  card: string
  fields: ReadonlyArray<{ selector: string; value: string }>
}

const NO_SCRIPT_TARGETS: readonly NoScriptTarget[] = [
  {
    label: "the sign-up form",
    card: '#demo-EnhancedForm [data-e2e="signup-form"]',
    fields: [{ selector: 'input[name="email"]', value: "ada@example.com" }],
  },
  {
    label: "the contact form",
    card: '#demo-EnhancedForm [data-e2e="contact-form"]',
    fields: [
      { selector: 'input[name="name"]', value: "Ada Lovelace" },
      { selector: 'input[name="email"]', value: "ada@example.com" },
      { selector: 'textarea[name="message"]', value: "Hello there." },
    ],
  },
]

/** What this file reads off one captured `Network.requestWillBeSent` event. */
interface CapturedRequest {
  requestId: string
  method: string
  postData?: string
  hasPostData?: boolean
}

/**
 * Wait for the next request whose URL contains `urlIncludes`, ignoring any other traffic in
 * between.
 *
 * Registered *before* the action expected to trigger it: a waiter only sees events that arrive
 * after it starts listening, so calling this after the click would race whichever request the
 * click produced.
 *
 * @param devtools The connected session.
 * @param urlIncludes Substring the request's URL must contain.
 * @param timeoutMs Budget across every non-matching event this has to skip past.
 */
async function waitForRequest(
  devtools: Devtools,
  urlIncludes: string,
  timeoutMs: number,
): Promise<CapturedRequest | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const event = await devtools.once<
        {
          requestId: string
          request: { url: string; method: string; postData?: string; hasPostData?: boolean }
        }
      >("Network.requestWillBeSent", Math.max(deadline - Date.now(), 1))
      if (event.request.url.includes(urlIncludes)) {
        return {
          requestId: event.requestId,
          method: event.request.method,
          postData: event.request.postData,
          hasPostData: event.request.hasPostData,
        }
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * The submitted body of a captured request — inline on the event when Chromium included it, or
 * fetched separately when it only said one was there.
 */
async function requestBody(devtools: Devtools, request: CapturedRequest): Promise<string> {
  if (request.postData !== undefined) return request.postData
  if (!request.hasPostData) return ""

  try {
    const body = await devtools.send<{ postData: string }>("Network.getRequestPostData", {
      requestId: request.requestId,
    })
    return body.postData
  } catch {
    return ""
  }
}

/**
 * The sign-up form and the contact form, submitted on a page where no script has run at all —
 * `Emulation.setScriptExecutionDisabled` before a reload buys that, the same way `system/`'s
 * `authFormNoScriptChecks` does, and for the same reason: every other check in this file runs
 * against Preact's own hydrated submit handler, and this is the one behaviour that needs a page
 * that never ran the bundle. `Runtime.evaluate` keeps working the whole time — DevTools reads and
 * writes the page through its own privileged channel — so this can still fill fields and read
 * `location.href` even though nothing the page itself authored can run; the submit button itself is
 * pressed with a real, dispatched pointer, because a `.click()` run through `Runtime.evaluate` is
 * script executing on the page's behalf where genuinely none should be able to.
 *
 * **What "the server's answer shows" is checked against, twice.** The landed-on page's own marker
 * is read the same way the earlier version of this check did. On top of that, this reads the
 * *network request itself* — `Network.requestWillBeSent`, captured before the click so nothing is
 * missed — and asserts its method is `POST` and its body carries the field this target filled in.
 * That is the one proof in this file that does not merely observe where the browser ended up: it
 * observes what the browser actually sent, which is what a caller integrating a real backend cares
 * about. Only the local preview server answers that POST with content; see this section's own
 * module doc for why nothing here claims the published site does.
 *
 * **Everything from disabling script execution onward runs inside a `try`, and re-enabling it,
 * navigating back and waiting for rehydration all run inside the matching `finally`.** A throw or a
 * stalled navigation partway through must not leave every check after this one running against an
 * unhydrated page — and if the first restoring navigation does not rehydrate the page either, a
 * second attempt with `Page.reload({ ignoreCache: true })` is what keeps a single flaky navigation
 * from cascading into the Modal checks that run right after this file's own.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function enhancedFormsNoScriptChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })

    for (const [index, target] of NO_SCRIPT_TARGETS.entries()) {
      if (index === 0) {
        await devtools.send("Page.reload", { ignoreCache: true })
      } else {
        // A fresh, still-unhydrated load of the catalogue itself, not a reload of wherever the
        // previous target's submit landed — `Page.reload` at that point would reload `form-demo/`.
        await devtools.send("Page.navigate", { url: restoreUrl })
      }
      const loaded = await waitForNavigation(devtools)
      const unhydrated = loaded &&
        await devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated !== "true"`)
          .catch(() => false)

      for (const field of target.fields) {
        await devtools.evaluate<null>(`(() => {
          const card = document.querySelector('${target.card}')
          const el = card ? card.querySelector('${field.selector}') : null
          if (el) el.value = ${JSON.stringify(field.value)}
          return null
        })()`).catch(() => null)
      }

      const buttonPoint = await elementCenter(devtools, `${target.card} form button[type="submit"]`)

      const requestPromise = waitForRequest(devtools, "form-demo", 10_000)
      if (buttonPoint.ok) {
        for (const type of ["mousePressed", "mouseReleased"]) {
          await devtools.send("Input.dispatchMouseEvent", {
            type,
            x: buttonPoint.x,
            y: buttonPoint.y,
            button: "left",
            buttons: type === "mousePressed" ? 1 : 0,
            clickCount: 1,
          })
        }
      }

      const request = buttonPoint.ok ? await requestPromise : null
      const navigated = await waitForNavigation(devtools)
      const answer = navigated
        ? await devtools.evaluate<string>(
          `document.querySelector('[data-e2e="form-demo-answer"]')?.textContent ?? ""`,
        ).catch(() => "")
        : ""

      check(
        `${target.label} submits with no script running, and the server's answer shows`,
        unhydrated && buttonPoint.ok && navigated && answer.includes("Thanks"),
        !unhydrated
          ? "the fresh load still hydrated, so this proves nothing about a visitor without the bundle"
          : !buttonPoint.ok
          ? `no submit button found or aimed at on the unhydrated, prerendered ${target.label} ` +
            `card: ${buttonPoint.reason}`
          : !navigated
          ? "the submit never navigated anywhere within the timeout"
          : `landed on a page whose own marker reads ${JSON.stringify(answer.slice(0, 60))}`,
      )

      const firstField = target.fields[0]
      const expectedPair = `${
        encodeURIComponent(firstField.selector.match(/name="([^"]+)"/)?.[1] ?? "")
      }=`
      const body = request ? await requestBody(devtools, request) : ""

      check(
        `${target.label}'s no-script submit is recorded as a real POST carrying its fields`,
        request !== null && request.method === "POST" && body.includes(expectedPair),
        request === null
          ? "no network request to form-demo/ was captured"
          : `method "${request.method}", body ${JSON.stringify(body.slice(0, 120))}`,
      )
    }
  } finally {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})

    await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
    await waitForNavigation(devtools)
    let rehydrated = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      10_000,
    )

    // One restoring navigation was occasionally not enough on its own — a second, harder attempt
    // before giving up is what keeps a single flaky one from taking the Modal checks with it.
    if (!rehydrated) {
      await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
      await waitForNavigation(devtools)
      rehydrated = await poll(
        () =>
          devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
            .catch(() => false),
        10_000,
      )
    }

    check(
      "the page rehydrates once script execution is re-enabled again",
      rehydrated,
      rehydrated
        ? "data-hydrated set again after the restoring navigation"
        : "the page never rehydrated after script execution was re-enabled, even after a retry",
    )

    await settledScroll(devtools)
  }
}

/** `MoneyInput`'s card: `Field`-wired, `EUR`, German locale, `name="guide-money-amount"`. */
const MONEY_INPUT_CARD = "#demo-MoneyInput"

/** One typed-then-read snapshot from {@link moneyInputChecks}'s first, single-`evaluate` pass. */
interface MoneyInputReading {
  initialEcho: string
  groupedParseEcho: string
  groupedHiddenValue: string
  invalidEcho: string
  invalidMessage: string
  invalidAriaInvalid: string | null
  invalidDescribedBy: string
  invalidHiddenValue: string
  invalidCheckValidity: boolean
  invalidValidationMessage: string
  clearedEcho: string
  clearedMessage: string
  clearedAriaInvalid: string | null
}

/**
 * `MoneyInput`'s behaviour that only a real browser can prove: a genuine grouping mark parses into
 * the smallest-unit integer the demo echoes, unparsable text leaves that integer unchanged while
 * announcing a message through the live region present since the first render and blocking a real
 * form submit through `setCustomValidity`, a real blur (`Tab`, not a dispatched `blur` event) keeps
 * the typed text and the message rather than reverting them, an external change to `value` re-syncs
 * the shown text while the field is not focused, and a real click on the demo's own submit button
 * is refused while the field is invalid and succeeds once it is fixed, posting the parsed integer.
 */
async function moneyInputChecks(devtools: Devtools): Promise<void> {
  const cardPresent = await devtools.evaluate<boolean>(
    `document.querySelector('${MONEY_INPUT_CARD}') !== null`,
  )
  check("the MoneyInput card is on the page", cardPresent)
  if (!cardPresent) return

  const read = await devtools.evaluate<MoneyInputReading>(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 30))
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const hidden = card.querySelector('input[type=hidden][name="guide-money-amount"]')
    const status = card.querySelector('#guide-money-input-status')
    const echo = () => card.querySelector('[data-e2e="controlled-value"]').textContent.trim()
    const setValue = (el, text) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      setter.call(el, text)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }

    const initialEcho = echo()

    // A real thousands separator, not just a decimal mark — proves grouping is understood, not
    // only decoded.
    setValue(input, "1.234,56")
    await settle()
    const groupedParseEcho = echo()
    const groupedHiddenValue = hidden.value

    setValue(input, "abc")
    await settle()
    const invalidEcho = echo()
    const invalidMessage = status.textContent.trim()
    const invalidAriaInvalid = input.getAttribute("aria-invalid")
    const invalidDescribedBy = input.getAttribute("aria-describedby") ?? ""
    const invalidHiddenValue = hidden.value
    const invalidCheckValidity = input.checkValidity()
    const invalidValidationMessage = input.validationMessage

    setValue(input, "")
    await settle()
    const clearedEcho = echo()
    const clearedMessage = status.textContent.trim()
    const clearedAriaInvalid = input.getAttribute("aria-invalid")

    return {
      initialEcho,
      groupedParseEcho,
      groupedHiddenValue,
      invalidEcho,
      invalidMessage,
      invalidAriaInvalid,
      invalidDescribedBy,
      invalidHiddenValue,
      invalidCheckValidity,
      invalidValidationMessage,
      clearedEcho,
      clearedMessage,
      clearedAriaInvalid,
    }
  })()`)

  check(
    "starts from the demo's own initial amount",
    read.initialEcho.includes("1999"),
    read.initialEcho,
  )
  check(
    "typing '1.234,56' in the German demo parses to 123456, a real grouping mark understood too",
    read.groupedParseEcho.includes("123456") && read.groupedHiddenValue === "123456",
    `echo "${read.groupedParseEcho}", hidden value "${read.groupedHiddenValue}"`,
  )
  check(
    "typing letters leaves the posted integer unchanged and shows the invalid message",
    read.invalidEcho.includes("123456") && read.invalidHiddenValue === "123456" &&
      read.invalidMessage === "Enter a valid amount",
    `echo "${read.invalidEcho}", hidden value "${read.invalidHiddenValue}", message "${read.invalidMessage}"`,
  )
  check(
    "marks the control invalid and describes it by the live region while the message stands",
    read.invalidAriaInvalid === "true" &&
      read.invalidDescribedBy.includes("guide-money-input-status"),
    `aria-invalid="${read.invalidAriaInvalid}" aria-describedby="${read.invalidDescribedBy}"`,
  )
  check(
    "sets the visible control's own custom validity to the message, so a real submit would be refused",
    read.invalidCheckValidity === false && read.invalidValidationMessage === "Enter a valid amount",
    `checkValidity()=${read.invalidCheckValidity}, validationMessage="${read.invalidValidationMessage}"`,
  )
  check(
    "clearing the field posts nothing and drops the message",
    read.clearedEcho.includes("(empty)") && read.clearedMessage === "" &&
      read.clearedAriaInvalid === null,
    `echo "${read.clearedEcho}", message "${read.clearedMessage}", aria-invalid="${read.clearedAriaInvalid}"`,
  )
  // A real click focuses the field — through the browser's own input pipeline, not a scripted
  // `.focus()` call — so the Tab press right after this has something real to blur away from.
  const fieldPoint = await elementCenter(devtools, `${MONEY_INPUT_CARD} #guide-money-input`)
  check(
    "the field itself is reachable for a real click",
    fieldPoint.ok,
    fieldPoint.ok ? `(${fieldPoint.x}, ${fieldPoint.y})` : fieldPoint.reason,
  )
  if (!fieldPoint.ok) return
  await clickAtPoint(devtools, fieldPoint)

  const typed = await devtools.evaluate<
    {
      beforeUnresolvedEcho: string
      beforeUnresolvedValue: string
      midEditValue: string
      midEditMessage: string
    }
  >(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 30))
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const status = card.querySelector('#guide-money-input-status')
    const echo = () => card.querySelector('[data-e2e="controlled-value"]').textContent.trim()
    const setValue = (el, text) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      setter.call(el, text)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }

    setValue(input, "3,50")
    await settle()
    const beforeUnresolvedEcho = echo()
    const beforeUnresolvedValue = input.value

    setValue(input, "not a number")
    await settle()
    const midEditValue = input.value
    const midEditMessage = status.textContent.trim()

    return { beforeUnresolvedEcho, beforeUnresolvedValue, midEditValue, midEditMessage }
  })()`)
  check(
    "an unresolved edit still shows its own typed text right up to the blur",
    typed.beforeUnresolvedEcho.includes("350") && typed.midEditValue === "not a number" &&
      typed.midEditMessage === "Enter a valid amount",
    `before blur echo "${typed.beforeUnresolvedEcho}" "${typed.beforeUnresolvedValue}", mid-edit "${typed.midEditValue}" message "${typed.midEditMessage}"`,
  )

  // A real blur — Tab through the browser's own input pipeline, not a dispatched `blur` event —
  // while the field's text is still refused. Text and message must stay exactly as they are.
  // `onBlur` runs synchronously on the DOM's own blur event, but the re-render it triggers is not
  // synchronous with it — a short settle avoids reading the DOM before that render has landed.
  await pressKey(devtools, "Tab")
  await new Promise((resolve) => setTimeout(resolve, 60))
  const afterRealBlur = await devtools.evaluate<{
    value: string
    message: string
    ariaInvalid: string | null
    stillFocused: boolean
  }>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const status = card.querySelector('#guide-money-input-status')
    return {
      value: input.value,
      message: status.textContent.trim(),
      ariaInvalid: input.getAttribute("aria-invalid"),
      stillFocused: document.activeElement === input,
    }
  })()`)
  check(
    "a real blur (Tab) keeps the typed text and the message instead of silently reverting them",
    afterRealBlur.value === "not a number" && afterRealBlur.message === "Enter a valid amount" &&
      afterRealBlur.ariaInvalid === "true" && !afterRealBlur.stillFocused,
    `after Tab: value "${afterRealBlur.value}", message "${afterRealBlur.message}", ` +
      `aria-invalid="${afterRealBlur.ariaInvalid}", still focused=${afterRealBlur.stillFocused}`,
  )

  // Fix the field, blur it for real again, then change `value` from outside the field entirely
  // (the demo's own "Add 5.00" button) — the shown text must re-sync while unfocused.
  await devtools.evaluate<null>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, "10,00")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return null
  })()`)
  await pressKey(devtools, "Tab")
  await new Promise((resolve) => setTimeout(resolve, 60))

  const beforeAdd = await devtools.evaluate<string>(
    `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
  )
  const addPoint = await elementCenter(
    devtools,
    `${MONEY_INPUT_CARD} [data-e2e="money-input-add-five"]`,
  )
  check(
    "the demo's Add 5.00 button is reachable for a real click",
    addPoint.ok,
    addPoint.ok ? `(${addPoint.x}, ${addPoint.y})` : addPoint.reason,
  )
  if (addPoint.ok) {
    await clickAtPoint(devtools, addPoint)
    const afterAdd = await devtools.evaluate<string>(
      `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
    )
    check(
      "an external change to value re-syncs the shown text while the field is not focused",
      afterAdd === "15,00" && afterAdd !== beforeAdd,
      `before "${beforeAdd}", after a real click on Add 5.00 "${afterAdd}"`,
    )
  }

  // A real form submit — a real click on the demo's own submit button, never a scripted
  // `form.requestSubmit()` or `dispatchEvent(new Event("submit"))`. Refused while the field's own
  // text is invalid; posts the parsed integer once it is fixed.
  await devtools.evaluate<null>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, "abc")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return null
  })()`)

  const submitsSelector = `${MONEY_INPUT_CARD} [data-e2e="money-input-submits"]`
  const beforeBlockedSubmit = await devtools.evaluate<string>(
    `document.querySelector('${submitsSelector}').textContent`,
  )
  const blockedSubmitPoint = await elementCenter(
    devtools,
    `${MONEY_INPUT_CARD} [data-e2e="money-input-submit"]`,
  )
  check(
    "the demo's Save button is reachable for a real click while the field is invalid",
    blockedSubmitPoint.ok,
    blockedSubmitPoint.ok
      ? `(${blockedSubmitPoint.x}, ${blockedSubmitPoint.y})`
      : blockedSubmitPoint.reason,
  )
  if (blockedSubmitPoint.ok) {
    await clickAtPoint(devtools, blockedSubmitPoint)
    const afterBlockedSubmit = await devtools.evaluate<string>(
      `document.querySelector('${submitsSelector}').textContent`,
    )
    check(
      "a real click on Save does not submit the form while the field's text is refused",
      afterBlockedSubmit === beforeBlockedSubmit,
      `before "${beforeBlockedSubmit}", after clicking Save while invalid "${afterBlockedSubmit}"`,
    )
  }

  await devtools.evaluate<null>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, "7,00")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return null
  })()`)
  const fixedSubmitPoint = await elementCenter(
    devtools,
    `${MONEY_INPUT_CARD} [data-e2e="money-input-submit"]`,
  )
  check(
    "the demo's Save button is reachable for a real click once the field is fixed",
    fixedSubmitPoint.ok,
    fixedSubmitPoint.ok
      ? `(${fixedSubmitPoint.x}, ${fixedSubmitPoint.y})`
      : fixedSubmitPoint.reason,
  )
  if (fixedSubmitPoint.ok) {
    await clickAtPoint(devtools, fixedSubmitPoint)
    const afterFixedSubmit = await devtools.evaluate<string>(
      `document.querySelector('${submitsSelector}').textContent`,
    )
    check(
      "a real click on Save submits once the field's text is fixed, posting the parsed integer",
      afterFixedSubmit.trim() === "submits: 1, posted: 700",
      `after fixing and clicking Save: "${afterFixedSubmit.trim()}"`,
    )
  }
}

/**
 * The bug review found: Preact does not overwrite an input's `value` while hydrating, so text typed
 * into `MoneyInput` before its bundle has even finished loading stays exactly where a visitor left
 * it, while `draft`, `value` and the hidden amount input all still carry whatever the server
 * rendered. A form submitted in that gap used to post the stale server amount, silently. The fix is
 * a mount effect that parses whatever text is already in the field and a hidden input that stays
 * `disabled` — dropped from `FormData` entirely — until that effect has run; this proves both
 * halves against a real, unhydrated load rather than a scripted `dispatchEvent`.
 *
 * The bundle is held back with `Fetch.enable` on `resourceType: "Script"`, not
 * `Emulation.setScriptExecutionDisabled` the way `enhancedFormsNoScriptChecks` above holds a whole
 * page back: that flag skips a blocked `<script>` permanently, so re-enabling it cannot retroactively
 * run one already parsed past, and the restoring navigation those checks use to get a hydrated page
 * back would also throw away whatever was typed. `Fetch.requestPaused` instead leaves the request
 * outstanding — the document still parses and renders fully around it — so continuing it later runs
 * the very bundle this check needs, against the very DOM the typing already changed. Chromium's
 * preload scanner can dispatch that request before the parser has reached the field's own markup, so
 * this polls for the field rather than waiting on a `Page` lifecycle event, and the pause is
 * registered before the reload that triggers it — a promise started after the click that is meant to
 * produce it would race whatever the click actually produced, the same hazard `waitForRequest`'s own
 * doc above states.
 *
 * Runs on the shared page, like `system/`'s `authFormNoScriptChecks`, and restores it the same way:
 * `Fetch.disable` and a restoring navigation, both inside a `finally` so a throw partway through
 * cannot leave every check after this one running against an unhydrated page, with a second, harder
 * attempt if the first restoring navigation does not rehydrate, and a wait for the route's own scroll
 * to settle before returning.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function moneyInputPreHydrationChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  let fieldReady = false
  let unhydratedWhileTyping = false
  let typedValue = "(page unreadable)"
  let hiddenDisabledWhileTyping: boolean | null = null
  let rehydrated = false
  let submitResult = "(not read)"
  let continuedValue = "(not read)"

  try {
    await devtools.send("Fetch.enable", {
      patterns: [{
        urlPattern: "*/assets/main.*.js",
        resourceType: "Script",
        requestStage: "Request",
      }],
    })
    const paused = devtools.once<{ requestId: string }>("Fetch.requestPaused", 20_000)
    await devtools.send("Page.reload", { ignoreCache: true })
    const { requestId } = await paused

    fieldReady = await poll(
      () =>
        devtools.evaluate<boolean>(
          `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input') !== null`,
        ).catch(() => false),
      10_000,
    )

    if (fieldReady) {
      unhydratedWhileTyping = await devtools.evaluate<boolean>(
        `document.documentElement.dataset.hydrated !== "true"`,
      ).catch(() => false)

      const fieldPoint = await elementCenter(devtools, `${MONEY_INPUT_CARD} #guide-money-input`)
      if (fieldPoint.ok) {
        await clickAtPoint(devtools, fieldPoint)
        // A native, JS-free selection — the field carries no listener at all yet — so the
        // insertion right after it replaces the server-rendered text rather than appending to it.
        await devtools.evaluate<null>(`(() => {
          document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').select()
          return null
        })()`)
        await typeInto(devtools, "12")
      }

      typedValue = await devtools.evaluate<string>(
        `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
      ).catch(() => "(unreadable)")
      hiddenDisabledWhileTyping = await devtools.evaluate<boolean>(
        `document.querySelector(
          '${MONEY_INPUT_CARD} input[type=hidden][name="guide-money-amount"]',
        ).disabled`,
      ).catch(() => null)
    }

    // Release the bundle — the document already carries whatever was typed above, untouched.
    await devtools.send("Fetch.continueRequest", { requestId }).catch(() => {})

    rehydrated = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      15_000,
    )

    if (rehydrated) {
      // The visitor keeps typing after the bundle has run, focus still where they put it before
      // hydration. The component must treat the field as focused and leave the text alone. One
      // character at a time, as a person types: sent as one insertion, "3,45" re-formats to itself.
      for (const character of "3,45") await typeInto(devtools, character)
      continuedValue = await devtools.evaluate<string>(
        `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
      ).catch(() => "(unreadable)")
      const submitPoint = await elementCenter(
        devtools,
        `${MONEY_INPUT_CARD} [data-e2e="money-input-submit"]`,
      )
      if (submitPoint.ok) {
        await clickAtPoint(devtools, submitPoint)
        await new Promise((resolve) => setTimeout(resolve, 60))
        submitResult = await devtools.evaluate<string>(
          `document.querySelector(
            '${MONEY_INPUT_CARD} [data-e2e="money-input-submits"]',
          ).textContent.trim()`,
        ).catch(() => "(unreadable)")
      }
    }
  } finally {
    await devtools.send("Fetch.disable", {}).catch(() => {})

    await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
    let restored = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      15_000,
    )
    if (!restored) {
      await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
      restored = await poll(
        () =>
          devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
            .catch(() => false),
        15_000,
      )
    }
    check(
      "the page rehydrates once the pre-hydration MoneyInput check restores it",
      restored,
      restored
        ? "data-hydrated set again after the restoring navigation"
        : "the page never rehydrated after the restoring navigation, even after a retry",
    )
    await settledScroll(devtools)
  }

  check(
    "text typed before the bundle has even loaded sits in the field unparsed, and the hidden amount stays disabled",
    fieldReady && unhydratedWhileTyping && typedValue === "12" &&
      hiddenDisabledWhileTyping === true,
    `field ready: ${fieldReady}, unhydrated while typing: ${unhydratedWhileTyping}, ` +
      `field value "${typedValue}", hidden input disabled: ${hiddenDisabledWhileTyping}`,
  )
  check(
    "the field hydrates once the held-back bundle is released",
    rehydrated,
    rehydrated ? "data-hydrated set" : "never hydrated after the bundle was released",
  )
  check(
    "typing that starts before hydration and continues after it is left as typed, not re-formatted",
    continuedValue === "123,45",
    `"12" typed before hydration, "3,45" after: field shows "${continuedValue}"`,
  )
  check(
    "a real submit after hydration posts what was typed before and after the bundle loaded, never the stale server amount",
    submitResult === "submits: 1, posted: 12345",
    `after a real click on Save: "${submitResult}"`,
  )
}

/** Card and element selectors {@link fileInputChecks} drives. */
const FILE_INPUT_CARD = "#demo-FileInput"
const FILE_INPUT_ID = "guide-file-input"
const FILE_INPUT_SELECTOR = `${FILE_INPUT_CARD} #${FILE_INPUT_ID}`
const FILE_INPUT_ZONE_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-zone"]`
const FILE_INPUT_CHOSEN_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-chosen"]`
const FILE_INPUT_REFUSED_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-refused"]`
const FILE_INPUT_TOGGLE_SELECTOR = `${FILE_INPUT_CARD} [data-e2e="file-input-toggle-mount"]`
const FILE_INPUT_FORM_ID = "guide-file-input-form"
const FILE_INPUT_SINGLE_ID = "guide-file-input-single"
const FILE_INPUT_SINGLE_REFUSED_SELECTOR =
  `${FILE_INPUT_CARD} [data-e2e="file-input-single-refused"]`
const FILE_INPUT_FIELD_ID = "guide-file-input-field"

/** The real, on-disk files {@link fileInputChecks} feeds through `DOM.setFileInputFiles` or a drop. */
interface FileInputFixture {
  /** Small, accepted PNG — the happy path for a click-driven selection and for the plain form post. */
  ok: string
  /** A second, distinct accepted PNG, used for the drop so its name proves the drop is what added it. */
  drop: string
  /** Larger than the demo's own 2 MB `maxSize`, otherwise accepted by `accept`. */
  tooLarge: string
  /** A plain text file, refused by `accept="image/png,image/jpeg"`. */
  wrongType: string
}

/**
 * Write the handful of real files {@link fileInputChecks} needs into a fresh `mktemp` directory.
 *
 * `DOM.setFileInputFiles` and a drop's `Input.dispatchDragEvent` both take real, on-disk paths —
 * neither can be satisfied by a `Blob` built inside the page. Nothing here is a real image: the
 * component never decodes the bytes, only its extension and size, so arbitrary bytes under a `.png`
 * name exercise exactly what `matchesAccept` and `maxSize` check. Not committed as binaries —
 * written at check time and removed by the caller's own `finally`, the same lifetime
 * `pages/verify.ts`'s own Chromium profile directory has.
 */
async function writeFileInputFixtures(): Promise<{ dir: string; files: FileInputFixture }> {
  const dir = await Deno.makeTempDir({ prefix: "file-input-check-" })
  const files: FileInputFixture = {
    ok: `${dir}/ok.png`,
    drop: `${dir}/dropped.png`,
    tooLarge: `${dir}/too-large.png`,
    wrongType: `${dir}/notes.txt`,
  }
  await Deno.writeFile(files.ok, new Uint8Array(64))
  await Deno.writeFile(files.drop, new Uint8Array(64))
  await Deno.writeFile(files.tooLarge, new Uint8Array(3 * 1024 * 1024))
  await Deno.writeFile(files.wrongType, new Uint8Array(16))
  return { dir, files }
}

/**
 * `DOM.setFileInputFiles`' own `nodeId`, for one selector — re-read on every call rather than
 * cached: the input `FileInput` wraps is never replaced across these checks, but re-querying costs
 * one round trip and avoids ever trusting a `nodeId` a prior DOM mutation elsewhere on this long
 * page might have invalidated.
 *
 * @param devtools The connected session.
 * @param selector The element to resolve.
 * @returns Its `nodeId`, or `null` when nothing matches.
 */
async function domNodeId(devtools: Devtools, selector: string): Promise<number | null> {
  await devtools.send("DOM.enable")
  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: 0,
  })
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  })
  return nodeId || null
}

/** What the primary `FileInput` demo's own `onFiles`/`onReject` echo reads, right now. */
async function fileInputReport(devtools: Devtools): Promise<{ chosen: string; refused: string }> {
  return await devtools.evaluate<{ chosen: string; refused: string }>(`(() => ({
    chosen: document.querySelector('${FILE_INPUT_CHOSEN_SELECTOR}')?.textContent ?? "",
    refused: document.querySelector('${FILE_INPUT_REFUSED_SELECTOR}')?.textContent ?? "",
  }))()`)
}

/**
 * Tab reaches the native input, and a real Space or a real Enter press each open the file chooser —
 * `Page.setInterceptFileChooserDialog` replaces the native dialog with a `Page.fileChooserOpened`
 * event rather than a modal the check would otherwise have to dismiss, and the interception is
 * turned back off in a `finally` so it cannot affect anything that runs after this.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function fileInputKeyboardChecks(devtools: Devtools): Promise<void> {
  // The element immediately before the input in tab order, computed rather than guessed: the
  // catalogue's own card chrome (a copy-snippet button, a disclosure) sits ahead of every demo's
  // markup, so the previous *card's* last control is not necessarily the previous *tab stop* —
  // measured in review, where guessing `#guide-toggle-error` landed on the FileInput card's own
  // copy-snippet button instead and failed this check for a reason that had nothing to do with
  // `FileInput`.
  const staged = await devtools.evaluate<boolean>(`(() => {
    const target = document.querySelector('${FILE_INPUT_SELECTOR}')
    if (!target) return false
    const focusable = [...document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]',
    )].filter((el) => {
      const tabIndex = el.getAttribute('tabindex')
      if (tabIndex !== null && parseInt(tabIndex, 10) < 0) return false
      const style = getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
    const index = focusable.indexOf(target)
    if (index <= 0) return false
    const previous = focusable[index - 1]
    previous.focus()
    return document.activeElement === previous
  })()`)
  check(
    "the element immediately before FileInput in tab order can receive focus, so Tab proves something",
    staged,
  )
  if (staged) {
    // The native input the browser actually focuses is clipped to 1px (`sr-only`), so its own
    // `:focus-visible` paints nothing a sighted keyboard user could see. The visible drop zone
    // reads that state off its descendant with `has-[:focus-visible]:ring-*`, so it is the zone's
    // own computed `boxShadow` (a Tailwind ring is implemented as one) that has to change, not the
    // input's.
    const zoneBefore = await devtools.evaluate<string>(
      `getComputedStyle(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}'))?.boxShadow ?? ""`,
    )

    await pressKey(devtools, "Tab")
    const landed = await devtools.evaluate<boolean>(
      `document.activeElement === document.querySelector('${FILE_INPUT_SELECTOR}')`,
    )
    check("the FileInput native input is reachable with Tab", landed)

    if (landed) {
      const zoneAfter = await devtools.evaluate<string>(
        `getComputedStyle(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}'))?.boxShadow ?? ""`,
      )
      check(
        "tabbing to the native input changes the visible drop zone's computed style, so keyboard " +
          "focus is shown somewhere a sighted user can see it",
        zoneAfter !== zoneBefore,
        `unfocused boxShadow: ${JSON.stringify(zoneBefore)}, focused: ${JSON.stringify(zoneAfter)}`,
      )
    }
  }

  const focused = await devtools.evaluate<boolean>(`(() => {
    const el = document.querySelector('${FILE_INPUT_SELECTOR}')
    if (!el) return false
    el.focus()
    return document.activeElement === el
  })()`)
  check("the FileInput native input can receive focus directly", focused)
  if (!focused) return

  await devtools.send("Page.setInterceptFileChooserDialog", { enabled: true })
  try {
    for (const keyName of ["Enter", "Space"] as const) {
      await devtools.evaluate<null>(`(() => {
        document.querySelector('${FILE_INPUT_SELECTOR}')?.focus()
        return null
      })()`)
      const chooserPromise = devtools.once("Page.fileChooserOpened", 5_000)
      await pressKey(devtools, keyName)
      const opened = await chooserPromise.then(() => true).catch(() => false)
      check(`a real ${keyName} press on the focused FileInput opens the file chooser`, opened)
    }
  } finally {
    await devtools.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {})
  }
}

/**
 * A file set with `DOM.setFileInputFiles` — the CDP-level equivalent of picking one through the
 * chooser {@link fileInputKeyboardChecks} opened — reaches `onFiles` and is rendered in the
 * component's own list, with a remove button named after it.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputSelectionCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const nodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
  check("the FileInput native input is found for DOM.setFileInputFiles", nodeId !== null)
  if (nodeId === null) return

  await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId })
  const settled = await poll(
    async () => (await fileInputReport(devtools)).chosen.includes("ok.png"),
    5_000,
  )
  const report = await fileInputReport(devtools)
  check(
    "a file set with DOM.setFileInputFiles reaches onFiles",
    settled,
    `chosen: "${report.chosen.trim()}"`,
  )

  const named = await devtools.evaluate<boolean>(
    `document.querySelector('${FILE_INPUT_CARD} button[aria-label="Remove ok.png"]') !== null`,
  )
  check(
    "the chosen file is rendered in FileInput's own list, with a remove button naming it",
    named,
  )
}

/**
 * A drop through `Input.dispatchDragEvent` — real mouse-driven drag events carrying real file paths
 * in their `data.files`, the one part of a drop `DOM.setFileInputFiles` cannot stand in for — adds
 * its file the same way a click-driven selection does, and the drop zone marks itself while a drag
 * is over it and clears the mark once the drop lands.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputDropCheck(devtools: Devtools, fixture: FileInputFixture): Promise<void> {
  const point = await elementCenter(devtools, FILE_INPUT_ZONE_SELECTOR)
  check("the FileInput drop zone can be aimed at", point.ok, point.reason)
  if (!point.ok) return

  const dragData = { items: [], files: [fixture.drop], dragOperationsMask: 1 }
  await devtools.send("Input.dispatchDragEvent", {
    type: "dragEnter",
    x: point.x,
    y: point.y,
    data: dragData,
  })
  const markedWhileDragging = await devtools.evaluate<boolean>(
    `(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}')?.className ?? "")
      .includes("border-blue-500")`,
  )
  check("the drop zone marks itself while a drag is over it", markedWhileDragging)

  await devtools.send("Input.dispatchDragEvent", {
    type: "drop",
    x: point.x,
    y: point.y,
    data: dragData,
  })
  const settled = await poll(
    async () => (await fileInputReport(devtools)).chosen.includes("dropped.png"),
    5_000,
  )
  const report = await fileInputReport(devtools)
  check(
    "dropping a file through Input.dispatchDragEvent adds it via the input's own DataTransfer",
    settled,
    `chosen: "${report.chosen.trim()}"`,
  )

  const markCleared = await devtools.evaluate<boolean>(
    `!(document.querySelector('${FILE_INPUT_ZONE_SELECTOR}')?.className ?? "").includes("border-blue-500")`,
  )
  check("the drop zone's dragging mark clears once the drop lands", markCleared)
}

/**
 * A file over `maxSize` and a file `accept` does not match are both refused: neither reaches
 * `onFiles`, both are reported through `onReject`, and each refusal's text lands in `FileInput`'s
 * own `role="status"` live region — the one that is present, empty, before either happens.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputRefusalChecks(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const tooLargeNodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
  check("the FileInput native input is found for the too-large refusal", tooLargeNodeId !== null)
  if (tooLargeNodeId !== null) {
    await devtools.send("DOM.setFileInputFiles", {
      files: [fixture.tooLarge],
      nodeId: tooLargeNodeId,
    })
    const settled = await poll(
      async () => (await fileInputReport(devtools)).refused.includes("too-large"),
      5_000,
    )
    const report = await fileInputReport(devtools)
    check(
      "a file over maxSize is refused with reason too-large, reported through onReject",
      settled,
      `refused: "${report.refused.trim()}"`,
    )
    const region = await devtools.evaluate<string>(
      `document.querySelector('#${FILE_INPUT_ID}-rejection')?.textContent ?? ""`,
    )
    check(
      "the too-large refusal is announced in FileInput's own live region",
      region.includes("larger than"),
      `"${region}"`,
    )
  }

  const wrongTypeNodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
  check("the FileInput native input is found for the wrong-type refusal", wrongTypeNodeId !== null)
  if (wrongTypeNodeId !== null) {
    await devtools.send("DOM.setFileInputFiles", {
      files: [fixture.wrongType],
      nodeId: wrongTypeNodeId,
    })
    const settled = await poll(
      async () => (await fileInputReport(devtools)).refused.includes("wrong-type"),
      5_000,
    )
    const report = await fileInputReport(devtools)
    check(
      "a file accept does not match is refused with reason wrong-type, reported through onReject",
      settled,
      `refused: "${report.refused.trim()}"`,
    )
    const region = await devtools.evaluate<string>(
      `document.querySelector('#${FILE_INPUT_ID}-rejection')?.textContent ?? ""`,
    )
    check(
      "the wrong-type refusal is announced in FileInput's own live region",
      region.includes("not an accepted file type"),
      `"${region}"`,
    )
  }
}

/**
 * Without `multiple`, a second file offered alongside the first is refused with reason `"too-many"`
 * and announced, rather than silently dropped — the "Single file only" card in `FileInputDemo` has
 * no `multiple`.
 *
 * This has to arrive as a drop, not a `DOM.setFileInputFiles` selection: `handleChange` reads
 * `event.currentTarget.files`, and a real browser truncates a non-`multiple` file input's own
 * `FileList` to the last file before the `change` event ever fires — `DOM.setFileInputFiles` goes
 * through that same input-element semantics, so a non-`multiple` input never sees a second file
 * that way regardless of what this component does with it, and a check built on it would prove
 * nothing about the refusal path. `handleDrop` instead reads `event.dataTransfer.files` straight off
 * the drag event, which is never gated by the `multiple` attribute, so a two-file drop is the one
 * real interaction that actually offers this component more than one file at once with `multiple`
 * absent — the same drag mechanics {@link fileInputDropCheck} already proves add a single file.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputTooManyRefusalCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const inputSelector = `${FILE_INPUT_CARD} #${FILE_INPUT_SINGLE_ID}`
  const zoneSelector =
    `${FILE_INPUT_CARD} [data-e2e="file-input-zone"]:has(#${FILE_INPUT_SINGLE_ID})`
  const found = await devtools.evaluate<boolean>(
    `document.querySelector('${inputSelector}') !== null`,
  )
  check("the single-file FileInput's native input is found", found)
  if (!found) return

  const point = await elementCenter(devtools, zoneSelector)
  check("the single-file FileInput's drop zone can be aimed at", point.ok, point.reason)
  if (!point.ok) return

  const dragData = { items: [], files: [fixture.ok, fixture.drop], dragOperationsMask: 1 }
  await devtools.send("Input.dispatchDragEvent", {
    type: "dragEnter",
    x: point.x,
    y: point.y,
    data: dragData,
  })
  await devtools.send("Input.dispatchDragEvent", {
    type: "drop",
    x: point.x,
    y: point.y,
    data: dragData,
  })

  const readRefused = () =>
    devtools.evaluate<string>(
      `document.querySelector('${FILE_INPUT_SINGLE_REFUSED_SELECTOR}')?.textContent ?? ""`,
    )
  const settled = await poll(async () => (await readRefused()).includes("too-many"), 5_000)
  const refused = await readRefused()
  check(
    "dropping two files onto a non-multiple FileInput refuses the second with reason " +
      "too-many, reported through onReject",
    settled,
    `refused: "${refused.trim()}"`,
  )

  const region = await devtools.evaluate<string>(
    `document.querySelector('#${FILE_INPUT_SINGLE_ID}-rejection')?.textContent ?? ""`,
  )
  // This card's own `labels.tooMany` override reads "un seul fichier est autorisé" instead of the
  // default English "only one file is allowed" — asserting the override's own text here, rather
  // than the default, is what proves `labels` actually reaches the rendered message.
  check(
    "the too-many refusal is announced in FileInput's own live region, in the label override's own text",
    region.includes("un seul fichier est autorisé"),
    `"${region}"`,
  )

  const keptCount = await devtools.evaluate<number>(
    `document.querySelector('${inputSelector}')?.files?.length ?? -1`,
  )
  check(
    "only the first file is kept on the input's own files list, the rest refused rather than added",
    keptCount === 1,
    `input.files.length = ${keptCount}`,
  )
}

/**
 * A refusal on a non-`multiple` `FileInput` must not clear a file already chosen: without
 * `multiple`, `handleFiles` keeps at most one file, and a batch that accepts nothing new used to
 * fall through to an empty list, discarding the earlier valid file along with the refused one.
 *
 * Selects `ok.png` itself, through a fresh `DOM.setFileInputFiles` call, rather than reusing the
 * file {@link fileInputTooManyRefusalCheck} leaves behind: that check sets the native input's own
 * `files` through a real drop, and a `DOM.setFileInputFiles` call right after one of those was
 * observed, in practice, to not reliably redeliver a `change` event on this same node — two
 * `DOM.setFileInputFiles` calls in a row, the shape {@link fileInputRefusalChecks} already relies
 * on, is the reliable one.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputRefusalKeepsPriorFileCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const inputSelector = `${FILE_INPUT_CARD} #${FILE_INPUT_SINGLE_ID}`

  const selectNodeId = await domNodeId(devtools, inputSelector)
  check(
    "the single-file FileInput's native input is found for its own selection",
    selectNodeId !== null,
  )
  if (selectNodeId === null) return

  await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId: selectNodeId })
  const chosen = await poll(async () => {
    const names = await devtools.evaluate<string[]>(
      `Array.from(document.querySelector('${inputSelector}')?.files ?? []).map((f) => f.name)`,
    )
    return names.includes("ok.png")
  }, 5_000)
  check("the single-file card accepts ok.png ahead of this check's own refusal", chosen)
  if (!chosen) return

  const nodeId = await domNodeId(devtools, inputSelector)
  check(
    "the single-file FileInput's native input is found for the wrong-type refusal",
    nodeId !== null,
  )
  if (nodeId === null) return

  await devtools.send("DOM.setFileInputFiles", { files: [fixture.wrongType], nodeId })

  const readRefused = () =>
    devtools.evaluate<string>(
      `document.querySelector('${FILE_INPUT_SINGLE_REFUSED_SELECTOR}')?.textContent ?? ""`,
    )
  const settled = await poll(async () => (await readRefused()).includes("wrong-type"), 5_000)
  const refused = await readRefused()
  check(
    "offering a wrong-type file to the single-file card refuses it instead of accepting it",
    settled,
    `refused: "${refused.trim()}"`,
  )

  // Scoped to the single-file card's own wrapper (the input's zone's parent — the outer <div> a
  // caller's own class lands on), not the whole demo card: the main, `multiple`-carrying card also
  // has ok.png chosen by this point (`fileInputSelectionCheck`), so an unscoped selector would find
  // that card's own remove button and pass even if this card's own list had been cleared by the
  // refusal.
  const afterList = await devtools.evaluate<boolean>(`(() => {
    const input = document.querySelector('${inputSelector}')
    const wrapper = input?.closest('[data-e2e="file-input-zone"]')?.parentElement
    return (wrapper?.querySelector('button[aria-label="Remove ok.png"]') ?? null) !== null
  })()`)
  check(
    "ok.png is still in FileInput's own rendered list after the refusal, not cleared by it",
    afterList,
  )

  const afterFiles = await devtools.evaluate<string[]>(
    `Array.from(document.querySelector('${inputSelector}')?.files ?? []).map((f) => f.name)`,
  )
  check(
    "ok.png is still in the native input's own files after the refusal, and notes.txt was never " +
      "added to it",
    afterFiles.includes("ok.png") && !afterFiles.includes("notes.txt"),
    `input.files: [${afterFiles.join(", ")}]`,
  )
}

/**
 * `FileInput` nested inside `Field` renders exactly one label, naming the real input, and that
 * input is reachable with Tab and readable as the browser's own accessible name — the unit test in
 * `ui/file-input.test.tsx` proves the same shape from the server-rendered string; this proves the
 * hydrated DOM agrees, since a duplicate label or a broken `for`/`id` pairing would still pass a
 * string-matching unit test built the wrong way but fail an accessible-name query here.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function fileInputFieldNestingCheck(devtools: Devtools): Promise<void> {
  const selector = `${FILE_INPUT_CARD} #${FILE_INPUT_FIELD_ID}`
  const found = await devtools.evaluate<boolean>(
    `document.querySelector('${selector}') !== null`,
  )
  check("the Field-nested FileInput's native input is found", found)
  if (!found) return

  const labelCount = await devtools.evaluate<number>(`(() => {
    const card = document.querySelector('${FILE_INPUT_CARD}')
    return card ? card.querySelectorAll('label[for="${FILE_INPUT_FIELD_ID}"]').length : -1
  })()`)
  check(
    "Field's own clone supplies the only label for the nested FileInput, not a second one",
    labelCount === 1,
    `label[for="${FILE_INPUT_FIELD_ID}"] count = ${labelCount}`,
  )

  const describedBy = await devtools.evaluate<string>(
    `document.querySelector('${selector}')?.getAttribute('aria-describedby') ?? ""`,
  )
  check(
    "the nested FileInput's aria-describedby carries both its own rejection id and Field's hint id",
    describedBy.includes(`${FILE_INPUT_FIELD_ID}-rejection`) && describedBy.includes("-hint"),
    `aria-describedby="${describedBy}"`,
  )
}

/**
 * A preview's `URL.createObjectURL` is revoked on two separate occasions, checked here as two
 * separate increases of a patched revoke counter, not as an exact count: once when its own file
 * leaves the list, and again, for whatever is still outstanding, when the whole card unmounts. The
 * same removal also checks the thing a rendered list update cannot prove by itself: that the
 * removed file is genuinely gone from the native input's own `files`, the property a real `<form>`
 * post reads — not only out of the component's own rendered `<li>`.
 *
 * The card's own `data-e2e="file-input-toggle-mount"` button is what supplies the second half: this
 * catalogue never unmounts a card on its own, so proving "on unmount" needs a real Preact unmount
 * somewhere, and clicking that button is the only one this page offers without navigating away and
 * losing the ability to read the patched counter back — see `ui-guide/sections/inputs.tsx`'s own
 * doc on `FileInputDemo` for why the button exists at all.
 *
 * `URL.revokeObjectURL` is patched in place, counted, and restored in a `finally`.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputPreviewRevokeChecks(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    const original = URL.revokeObjectURL.bind(URL)
    globalThis.__fileInputCheck = { original, revokeCount: 0 }
    URL.revokeObjectURL = (url) => {
      globalThis.__fileInputCheck.revokeCount += 1
      return original(url)
    }
    return null
  })()`)

  try {
    const beforeRemove = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
    const removed = await devtools.evaluate<boolean>(`(() => {
      const button = document.querySelector('${FILE_INPUT_CARD} button[aria-label="Remove ok.png"]')
      if (!button) return false
      button.click()
      return true
    })()`)
    check("the ok.png remove button is found", removed)
    if (removed) {
      const revokedOnRemove = await poll(async () => {
        const count = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
        return count > beforeRemove
      }, 5_000)
      check("removing a file with an image preview revokes its object URL", revokedOnRemove)

      const filesAfterRemove = await devtools.evaluate<string[]>(
        `Array.from(document.querySelector('${FILE_INPUT_SELECTOR}')?.files ?? []).map((f) => f.name)`,
      )
      check(
        "removing a file also drops it from the native input's own files, not only the rendered list",
        !filesAfterRemove.includes("ok.png"),
        `input.files: [${filesAfterRemove.join(", ")}]`,
      )
    }

    const nodeId = await domNodeId(devtools, FILE_INPUT_SELECTOR)
    if (nodeId !== null) {
      await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId })
      await poll(async () => (await fileInputReport(devtools)).chosen.includes("ok.png"), 5_000)
    }

    const beforeUnmount = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
    const toggled = await devtools.evaluate<boolean>(`(() => {
      const button = document.querySelector('${FILE_INPUT_TOGGLE_SELECTOR}')
      if (!button) return false
      button.click()
      return true
    })()`)
    check("the card's unmount toggle is found", toggled)
    if (toggled) {
      const revokedOnUnmount = await poll(async () => {
        const count = await devtools.evaluate<number>(`globalThis.__fileInputCheck.revokeCount`)
        return count > beforeUnmount
      }, 5_000)
      check("unmounting the card revokes every preview still outstanding", revokedOnUnmount)
    }
  } finally {
    await devtools.evaluate<null>(`(() => {
      const state = globalThis.__fileInputCheck
      if (state) URL.revokeObjectURL = state.original
      return null
    })()`).catch(() => {})
  }
}

/**
 * A plain `<form method="post" enctype="multipart/form-data">` around its own `FileInput` instance
 * (`ui-guide/sections/inputs.tsx`'s fifth card, `id="guide-file-input-form"`) posts the chosen file
 * with no script running at all — not merely no hydrated `onSubmit` to intercept it, but the whole
 * bundle disabled the way {@link enhancedFormsNoScriptChecks} disables it for the sign-up form and
 * the contact form, via `Emulation.setScriptExecutionDisabled` before a reload. That is what
 * "without JavaScript doing anything" in #145's own done-when box means: a hydrated hander that
 * happens not to call `preventDefault` still proves nothing about a visitor whose script never ran
 * in the first place, and only a page that genuinely never executed the bundle does.
 *
 * Three things are checked against that unhydrated page, in order: the native input is still found
 * by `DOM.setFileInputFiles`, and its computed `display` is still not `none` — the one property this
 * check reads back, not the full `sr-only` technique — proving the input never depends on the bundle
 * having run to stay reachable; the submit still produces a real `POST` whose multipart body carries
 * the chosen file, read the same way {@link enhancedFormsNoScriptChecks} reads its captured request; and
 * the landed-on page carries the server's own marker, so the second check does not merely tell a
 * real POST from a client-side navigation without also confirming where it actually went.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param fixture Real files on disk, from {@link writeFileInputFixtures}.
 */
async function fileInputFormPostCheck(
  devtools: Devtools,
  fixture: FileInputFixture,
): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })
    await devtools.send("Page.reload", { ignoreCache: true })
    const loaded = await waitForNavigation(devtools)
    const unhydrated = loaded &&
      await devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated !== "true"`)
        .catch(() => false)
    check(
      "the fresh reload for this check never ran the bundle",
      unhydrated,
      unhydrated
        ? "data-hydrated absent, as expected"
        : "the page hydrated despite the disabled flag",
    )
    if (!unhydrated) return

    const nodeId = await domNodeId(devtools, `#${FILE_INPUT_FORM_ID}`)
    check(
      "the plain-form FileInput's native input is reachable with no script running",
      nodeId !== null,
    )
    if (nodeId === null) return

    const stillVisuallyHidden = await devtools.evaluate<boolean>(`(() => {
      const el = document.querySelector('#${FILE_INPUT_FORM_ID}')
      if (!el) return false
      const style = getComputedStyle(el)
      return style.display !== "none" && el.type === "file"
    })()`).catch(() => false)
    check(
      "the unhydrated native input still has display !== none, not the full sr-only technique",
      stillVisuallyHidden,
    )

    await devtools.send("DOM.setFileInputFiles", { files: [fixture.ok], nodeId })

    const buttonPoint = await elementCenter(
      devtools,
      `${FILE_INPUT_CARD} form button[type="submit"]`,
    )
    check(
      "the plain form's submit button can be aimed at with no script running",
      buttonPoint.ok,
      buttonPoint.reason,
    )
    if (!buttonPoint.ok) return

    const requestPromise = waitForRequest(devtools, "form-demo", 10_000)
    for (const type of ["mousePressed", "mouseReleased"]) {
      await devtools.send("Input.dispatchMouseEvent", {
        type,
        x: buttonPoint.x,
        y: buttonPoint.y,
        button: "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: 1,
      })
    }

    const request = await requestPromise
    const navigated = await waitForNavigation(devtools)
    const answer = navigated
      ? await devtools.evaluate<string>(
        `document.querySelector('[data-e2e="form-demo-answer"]')?.textContent ?? ""`,
      ).catch(() => "")
      : ""
    const body = request ? await requestBody(devtools, request) : ""

    // Landing on the server's own marker is a sanity check on the local preview server's
    // form-demo/ route, not proof of anything FileInput itself does — the component's contract
    // ends at handing the browser a real multipart POST, which the check right after this one
    // verifies directly from the captured request body.
    check(
      "the preview server's form-demo/ route answers the plain-form post with its own marker",
      navigated && answer.includes("Thanks"),
      navigated
        ? `landed on a page whose own marker reads ${JSON.stringify(answer.slice(0, 60))}`
        : "the submit never navigated anywhere within the timeout",
    )
    check(
      "the post is a real multipart/form-data request carrying the chosen file under its field " +
        "name, with no script running",
      request !== null && request.method === "POST" && body.includes('name="attachment"') &&
        body.includes('filename="ok.png"'),
      request === null
        ? "no network request to form-demo/ was captured"
        : `method "${request.method}", body ${JSON.stringify(body.slice(0, 200))}`,
    )
  } finally {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})
    await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
    await waitForNavigation(devtools)
    let rehydrated = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      10_000,
    )
    if (!rehydrated) {
      await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
      await waitForNavigation(devtools)
      rehydrated = await poll(
        () =>
          devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
            .catch(() => false),
        10_000,
      )
    }
    check("the catalogue rehydrates once FileInput's plain-form post navigates back", rehydrated)
    await settledScroll(devtools)
  }
}

/**
 * `FileInput`'s own mechanics, none of which a render-to-string unit test can see: Tab and a real
 * Space/Enter press opening the file chooser, a file chosen through `DOM.setFileInputFiles`, one
 * dropped through `Input.dispatchDragEvent`, the `maxSize`/`accept` refusals and their live region,
 * an image preview revoked on removal and on a real unmount, and a plain `<form>` post that reaches
 * a server with no script preventing it.
 *
 * Runs after the `MoneyInput` checks and before `modalChecks`, the same place `uiChecks` calls it:
 * {@link fileInputFormPostCheck} navigates the page away and back, and every check after this one
 * has to run against a page that has fully rehydrated again, which its own last check confirms.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function fileInputChecks(devtools: Devtools): Promise<void> {
  const cardPresent = await devtools.evaluate<boolean>(
    `document.querySelector('${FILE_INPUT_CARD}') !== null`,
  )
  check("the FileInput card is on the page", cardPresent)
  if (!cardPresent) return

  const { dir, files: fixture } = await writeFileInputFixtures()
  try {
    await fileInputKeyboardChecks(devtools)
    await fileInputSelectionCheck(devtools, fixture)
    await fileInputDropCheck(devtools, fixture)
    await fileInputRefusalChecks(devtools, fixture)
    await fileInputTooManyRefusalCheck(devtools, fixture)
    await fileInputRefusalKeepsPriorFileCheck(devtools, fixture)
    await fileInputFieldNestingCheck(devtools)
    await fileInputPreviewRevokeChecks(devtools, fixture)
    await fileInputFormPostCheck(devtools, fixture)
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {})
  }
}
