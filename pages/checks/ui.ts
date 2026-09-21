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
 * `Field`, Tooltip, Combobox, Toastr, and — last — Modal's keyboard and focus contract.
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

  await tooltipChecks(devtools)
  await comboboxChecks(devtools)
  await toastrChecks(devtools)

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
    extend: card?.querySelector('[data-e2e="toast-extend"]') ?? null,
    clear: card?.querySelector('[data-e2e="toast-clear"]') ?? null,
    success: card?.querySelector('[data-e2e="toast-success"]') ?? null,
  }
  return null
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
 * message saying which one, because an exception ends the browser phase and silently drops every
 * package whose file runs after this one.
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

  // Leave the card as it was found, for whatever reads the page next.
  await devtools.evaluate<null>(`(globalThis.__verifyToastr?.clear?.click(), null)`)
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
  const out = await devtools.evaluate<{ ok: boolean; outside: boolean }>(`(() => {
    const parked = globalThis.__verifyToastr ?? {}
    if (!parked.clear || !parked.region) return { ok: false, outside: false }
    parked.clear.focus()
    return { ok: true, outside: !parked.region.contains(document.activeElement) }
  })()`)
  const resumed = await goneWithin(devtools, ran.duration * 4)

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
    "focus inside the Toastr stack holds its timer, and leaving resumes it",
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
  await devtools.evaluate<null>(
    `(globalThis.__verifyToastr?.region?.scrollIntoView({ block: "center" }), null)`,
  )
  await settledScroll(devtools)

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
    "the pointer over the Toastr stack holds its timer, and leaving resumes it",
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
      ok: false, visibility: "", opacity: "", boxed: false, hover: false, surfaceHover: false,
      described: null, focused: false, text: "",
    }
  }
  const style = getComputedStyle(surface)
  return {
    ok: true,
    visibility: style.visibility,
    opacity: style.opacity,
    boxed: surface.getClientRects().length > 0,
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
 * press against a `keydown` listener the component registers only while the trigger is engaged,
 * and the hoverable half is the browser's own hit testing — the thing `pointer-events-none` used
 * to fail, and which nothing in rendered markup can answer.
 *
 * **What this browser cannot show, measured rather than assumed.** Tailwind v4 compiles every
 * hover style — `hover:`, `group-hover:` — inside `@media (hover: hover)`, and this headless
 * Chromium answers `(hover: none)` and `(pointer: none)`, so no hover style of any kind applies in
 * it. `Emulation.setEmulatedMedia` does not cover those two features — tried, with and without a
 * `media` string, and `matchMedia("(hover: hover)")` still answered false — and neither does a
 * device metrics override. The lever is a Chromium launch flag, and the launcher is not this
 * file's to change. So the reveal-on-hover itself, the `visibility` flip, is not observable here
 * and no check below claims it: the reveal is proven through focus instead, which this browser
 * does run, and what the pointer checks assert is the property the fix actually changed — that the
 * pointer reaches the hint at all, and that the trigger stays `:hover` while it rests there,
 * because the hint is a descendant of the trigger and that is the state the reveal rule keys on.
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
 * Nothing here throws. A missing row is a failed check naming what is missing, because an
 * exception would end the browser phase and silently drop every package whose file runs after
 * this one.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function tooltipChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(TOOLTIP_SETUP)
  await devtools.evaluate<null>(
    `(globalThis.__verifyTooltip?.row?.scrollIntoView({ block: "center" }), null)`,
  )
  await settledScroll(devtools)
  // The Dropdown checks above leave the pointer at viewport coordinates, and viewport coordinates
  // do not scroll with the page: without parking it first, the pointer can be resting on this very
  // trigger while the check reads the trigger "at rest".
  await pointerToCorner(devtools)
  const atRest = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  // The hint is revealed by focus, because focus is the reveal this browser runs — see the note on
  // hover styles above. A hidden element is not hit-testable at all, so without a hint on screen
  // there would be nothing for a pointer to reach and the two readings below would be about
  // nothing.
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
  await pointerToCorner(devtools)
  const left = await poll(
    () =>
      devtools.evaluate<boolean>(
        `!${TOOLTIP_HOVERED} && !(globalThis.__verifyTooltip?.surface?.matches(":hover") ?? false)`,
      ),
    3_000,
  )
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
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
        `bubble's, so whatever separates the two is not part of the hint`
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
  await tooltipNameCheck(devtools)
}

/**
 * Escape dismisses the hint the pointer is on, takes its description with it, and moves no focus.
 *
 * The dismissal has to work while the pointer is on the trigger and focus is somewhere else
 * entirely, which is why the component listens on `document` rather than on the trigger: a hint
 * revealed by a pointer has no focus of its own to catch the key.
 *
 * Three transitions, and none of them is the paint — a dismissed hint loses its box and its id, so
 * this check reads what the `hidden` attribute and `aria-describedby` do, which this browser runs
 * whatever it thinks of hover.
 *
 * The first press is a control: with the pointer in the corner nothing is engaged, the component
 * has no listener registered at all, and that press must change nothing. The last step hovers
 * again, and it is not a formality either — "the hint is gone" is also true of a component that
 * broke itself on the key press, and only a hint that comes back has been dismissed rather than
 * destroyed.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function escapeOverPointerCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const beforeIdle = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)
  await pressKey(devtools, "Escape")
  const idle = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  const hovering = await hoverTrigger(devtools)
  await devtools.evaluate<null>(`(globalThis.__verifyFocusBefore = document.activeElement, null)`)
  const before = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  await pressKey(devtools, "Escape")
  const gone = await poll(() => devtools.evaluate<boolean>(TOOLTIP_DISMISSED), 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)
  const focusHeld = await devtools.evaluate<boolean>(
    `document.activeElement === globalThis.__verifyFocusBefore`,
  )
  const focusName = await devtools.evaluate<string>(
    `document.activeElement === document.body ? "the page" : document.activeElement.tagName`,
  )

  await pointerToCorner(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_HOVERED}`), 3_000)
  const again = await hoverTrigger(devtools)
  const back = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "a real Escape press dismisses the Tooltip under the pointer, without moving focus",
    beforeIdle.ok && beforeIdle.boxed && idle.boxed && idle.described !== null &&
      hovering.hovering && before.boxed && before.described !== null && gone && !after.boxed &&
      after.described === null && focusHeld && again.hovering && back.boxed &&
      back.described !== null,
    !beforeIdle.ok
      ? "the Tooltip card has no live row to dismiss"
      : !beforeIdle.boxed
      ? "the hint had already been dismissed before this check started, so there was nothing to " +
        "dismiss"
      : !idle.boxed || idle.described === null
      ? "an Escape press with the pointer nowhere near the trigger dismissed the hint anyway, so " +
        "the component listens for the key whether or not anybody is looking at the hint"
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
      : `Escape with the pointer in the corner: nothing changed → pointer onto the trigger, ` +
        `Input.dispatchKeyEvent Escape: the hint lost its box and the trigger dropped ` +
        `aria-describedby="${before.described}", with focus still on ${focusName} → pointer away ` +
        `and back: the hint has its box and its description again`,
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
  await pointerToCorner(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.focus(), null)`)
  const revealed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)
  const focused = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  await pressKey(devtools, "Escape")
  const gone = await poll(() => devtools.evaluate<boolean>(TOOLTIP_DISMISSED), 3_000)
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
  await pointerToCorner(devtools)
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

/**
 * Park the pointer in the viewport's top-left corner, clear of any card.
 *
 * Viewport coordinates do not scroll with the page, so a pointer left over one card ends up
 * resting on another as soon as the next check scrolls to it.
 *
 * @param devtools The connected session.
 */
async function pointerToCorner(devtools: Devtools): Promise<void> {
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 2,
    y: 2,
    button: "none",
    buttons: 0,
  })
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
  describedBy: string | null
  /** The status element's role, or `null` when the component renders no status at all. */
  statusRole: string | null
  statusLive: string | null
  statusText: string
  inputValue: string
  /** The popup's scroll position and box, which is where a highlight goes to get lost. */
  scrollTop: number
  clientHeight: number
  scrollHeight: number
  /** `true` when the highlighted row's own box lies inside the popup's visible band. */
  activeInView: boolean
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
 * The parked combobox's list, highlight, status element and popup geometry, in one round trip.
 *
 * The status element is looked up by the id the component derives rather than by `role="status"`:
 * the whole point of the first check below is that on an untouched field there is no such element
 * to find, and a reading has to be able to say "there is none" without a selector coming back
 * empty for some unrelated reason.
 */
const COMBOBOX_STATE = `(() => {
  const { id, input, list } = globalThis.__verifyCombobox ?? {}
  if (!input || !list) {
    return {
      ok: false, expanded: null, listHidden: false, options: -1, active: null, activeText: "",
      describedBy: null, statusRole: null, statusLive: null, statusText: "", inputValue: "",
      scrollTop: -1, clientHeight: -1, scrollHeight: -1, activeInView: false,
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
    describedBy: input.getAttribute("aria-describedby"),
    statusRole: status?.getAttribute("role") ?? null,
    statusLive: status?.getAttribute("aria-live") ?? null,
    statusText: (status?.textContent ?? "").trim().slice(0, 40),
    inputValue: input.value,
    scrollTop: Math.round(list.scrollTop),
    clientHeight: Math.round(list.clientHeight),
    scrollHeight: Math.round(list.scrollHeight),
    activeInView: row !== null && row.offsetTop >= list.scrollTop - 1 &&
      row.offsetTop + row.offsetHeight <= list.scrollTop + list.clientHeight + 1,
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
  await untouchedComboboxCheck(devtools)
  await highlightChecks(devtools)
  await reopenCheck(devtools)
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

  const silent = (reading: ComboboxReading) =>
    reading.statusRole === null && reading.describedBy === null
  check(
    "a Combobox with no options says nothing until it is opened, and answers only then",
    untouched.ok && untouched.expanded === "false" && untouched.options === 0 &&
      silent(untouched) && aim.onTarget && landing?.onTarget === true &&
      opened.expanded === "true" && opened.statusRole === "status" &&
      opened.statusLive === "polite" && opened.statusText.length > 0 &&
      opened.describedBy === "guide-combobox-empty-status" && silent(closed),
    !untouched.ok
      ? "the Combobox card has no field with id guide-combobox-empty"
      : untouched.options !== 0
      ? `the field under test renders ${untouched.options} options, so it is not the empty one ` +
        `this check is about`
      : !silent(untouched)
      ? `an untouched, closed field renders a ${untouched.statusRole} reading ` +
        `"${untouched.statusText}"${
          untouched.describedBy === null ? "" : `, and the input describes itself by it`
        } — nobody has asked it anything`
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
      : opened.describedBy !== "guide-combobox-empty-status"
      ? `opened, the input describes itself by ${opened.describedBy} rather than by its own ` +
        `status element`
      : !silent(closed)
      ? `closing the field left the ${closed.statusRole} on screen reading ` +
        `"${closed.statusText}", so once touched it never goes quiet again`
      : `untouched: no status, no aria-describedby → opened by a real click at (${landing.x}, ` +
        `${landing.y}): a polite status reading "${opened.statusText}", pointed at by ` +
        `aria-describedby → closed with Escape: quiet again`,
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
  for (let press = 0; press < steps; press++) await pressKey(devtools, "ArrowDown")
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
 * What the row under the pointer *looks* like cannot be read here. Tailwind gates `hover:` styles
 * behind `@media (hover: hover)` and this browser reports a pointer that cannot hover, so the
 * row's `hover:bg-gray-50` never applies in it; the `:hover` state the rule keys on is what the
 * check asserts, and both backgrounds go into the message so the gap is visible rather than
 * implied.
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
      !painted.plain,
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
      : `the pointer landed on ${landing.tag} at (${landing.x}, ${landing.y}) and the browser put ` +
        `that row, and only that row, into :hover, while aria-activedescendant stayed on ` +
        `${after.active}. The paint itself is Tailwind's \`hover:bg-gray-50\`, which this ` +
        `browser leaves unapplied — it reports a pointer that cannot hover, so every hover style ` +
        `is gated out (row backgrounds read ${painted.hoveredBackground} and ` +
        `${painted.plainBackground})`,
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
      narrowed.options < selected.options && reopened.options === selected.options &&
      reopened.activeText === chosen,
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
      : `selected "${chosen}" → narrowed to ${narrowed.options} of ${selected.options} rows with ` +
        `the query "${narrowed.inputValue}" → Tab abandoned it → focusing the field again ` +
        `restored all ${reopened.options} rows and highlighted "${reopened.activeText}" ` +
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
  await devtools.evaluate<null>(
    `(globalThis.__verifyCombobox?.input?.scrollIntoView({ block: "center" }), null)`,
  )
  await settledScroll(devtools)
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
