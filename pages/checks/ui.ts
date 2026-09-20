import { check, type Devtools, poll, pressKey } from "./harness.ts"

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
 * `Field`, Toastr, and — last — Modal's keyboard and focus contract.
 *
 * This file runs last of every package's, and Modal's checks run last inside it, for the same
 * reason: Modal opens a real modal dialog, and a dialog that refused to close would sit in the top
 * layer above every check that ran after it. See `pages/verify.ts`'s `interactionChecks` for where
 * the run order across every package is fixed.
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

  const toasts = await devtools.evaluate<{ pushed: boolean; text: string }>(
    `(async () => {
      const card = document.querySelector("#demo-Toastr")
      const button = [...card.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "success")
      button.click()
      await new Promise((done) => setTimeout(done, 50))
      return { pushed: document.body.textContent.includes("pushed by the demo stack"), text: button.textContent.trim() }
    })()`,
  )
  check("Toastr pushes a toast from the demo stack", toasts.pushed, `clicked "${toasts.text}"`)

  // Last on purpose: a Modal that refuses to close would sit in the top layer over everything, so a
  // failure here cannot take an unrelated check down with it.
  await modalChecks(devtools)
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
 * `.click()` stands in for activation in five places: the open-and-close check presses the trigger
 * twice, the focus-move check presses it once, {@link reopen} presses it once per reopening, and
 * the pointer half of item activation presses an item. The reason is one measurement, made twice:
 * a real **Enter** press on a focused button does not become an activation click in headless
 * Chromium. The Modal checks found that on a trigger, and a probe run of this file found it again
 * on a focused `role="menuitem"` button, which stayed at `aria-expanded="true"` with focus on the
 * item.
 *
 * **Space is different, and it is the key to reach for.** A real Space press through the same
 * helper *does* activate a focused menu item: the menu closes and focus goes back to the trigger,
 * which is what the Space check below asserts. So the honest statement of what is unproven here is
 * narrow — Enter as this helper sends it, on a button, in this browser — and not "keyboard
 * activation". Every other key this issue is about, the arrows with Home and End, Escape and Tab,
 * is proven by a real press.
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

  const openedByClick = await devtools.evaluate<{ before: DropdownState; after: DropdownState }>(
    `(async () => {
      const state = () => ${DROPDOWN_STATE}
      globalThis.__verifyDropdown.trigger.focus()
      const before = state()
      globalThis.__verifyDropdown.trigger.click()
      await new Promise((done) => setTimeout(done, 80))
      return { before, after: state() }
    })()`,
  )
  check(
    "activating Dropdown's trigger opens the menu and moves focus to its first item",
    openedByClick.before.onTrigger && openedByClick.before.expanded === "false" &&
      openedByClick.after.expanded === "true" && openedByClick.after.inPanel &&
      openedByClick.after.label === shape.labels[0],
    `focus ${openedByClick.before.onTrigger ? "on the trigger" : openedByClick.before.label} → ` +
      `"${openedByClick.after.label}", aria-expanded ${openedByClick.before.expanded} → ` +
      openedByClick.after.expanded,
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
    openedByClick.after.inPanel && walk.join(" → ") === expected.join(" → "),
    openedByClick.after.inPanel
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
    // rest of the run down with it.
    items[items.length - 1]?.click()
    await new Promise((done) => setTimeout(done, 80))
    return ${DROPDOWN_STATE}
  })()`)
  check(
    "activating a Dropdown item closes the menu and returns focus to the trigger",
    beforeActivate.expanded === "true" && afterActivate.hidden && afterActivate.onTrigger,
    beforeActivate.expanded === "true"
      ? `clicked "${shape.labels[shape.labels.length - 1]}", aria-expanded ` +
        `${beforeActivate.expanded} → ${afterActivate.expanded}, focus on ` +
        (afterActivate.onTrigger ? "the trigger" : `"${afterActivate.label}"`)
      : "the menu was never open, so activating an item proves nothing",
  )

  // The keyboard half of the same thing, and the last key in the issue's table that nothing else
  // here proves. Space and Enter are not interchangeable in this browser: a real Space press on a
  // focused button produces the activation click, a real Enter press does not — measured both
  // ways, and the reason the checks above reach for `.click()`.
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
  await triggerNameCheck(devtools)
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
 * Wait until the page has stopped scrolling.
 *
 * The click point is computed in one protocol round trip and dispatched in the next, so anything
 * that moves the page in between turns a correct measurement into a click that lands elsewhere.
 * `focus()` scrolls an element into view when it has to, and this component moves focus from an
 * effect and from a deferred read, so a scroll can arrive later than the call that caused it.
 *
 * @param devtools The connected session.
 */
async function settledScroll(devtools: Devtools): Promise<void> {
  let previous = Number.NaN
  await poll(async () => {
    const current = await devtools.evaluate<number>(`Math.round(globalThis.scrollY)`)
    const settled = current === previous
    previous = current
    return settled
  }, 3_000)
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
  await devtools.evaluate<null>(
    `(globalThis.__verifyDropdown.panel.scrollIntoView({ block: "center" }), null)`,
  )
  await settledScroll(devtools)

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
 * of the `CrudList` demo, and the `RowActions` card's own.
 *
 * A card that gains or loses a dropdown turns the check red until this table is updated with it,
 * which is one line and is visible in review. That is the intended cost.
 */
const DROPDOWN_TRIGGERS_PER_CARD: Record<string, number> = {
  "demo-Dropdown": 4,
  "demo-CrudList": 3,
  "demo-RowActions": 1,
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
  await devtools.evaluate<null>(`(globalThis.__verifyDropdown.trigger.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${DROPDOWN_STATE}.inPanel === true`), 3_000)

  return await devtools.evaluate<DropdownState>(DROPDOWN_STATE)
}

/**
 * Modal's keyboard and focus contract, driven in the browser that owns it.
 *
 * Three facts that no string-rendering test can reach: the element really enters the top layer, a
 * real Escape press closes it, and focus goes back to the button that opened it. All three live
 * behind an effect, a ref and a listener, which is exactly the shape this repository's unit tests
 * cannot execute.
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

  // `.click()` rather than a real Enter press, and measured rather than assumed: with Enter sent
  // through `Input.dispatchKeyEvent` on the focused trigger this run read `dialog.open=false` —
  // headless Chromium does not turn that key press into the activation click a person's Enter
  // produces. The Escape press below *is* a real key event, because that is the path under test.
  await devtools.evaluate<null>(`(globalThis.__verifyModalTrigger.click(), null)`)
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
  // experiences; it cannot tell the component's restore from the platform's.
  check(
    "closing the Modal returns focus to the button that opened it",
    opened.focusInside && restored,
    opened.focusInside
      ? `trigger "${trigger.label}" — document.activeElement is ${active}`
      : "focus never moved into the dialog, so a restore proves nothing",
  )
}
