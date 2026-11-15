import { guidePages } from "@spy4x/preact-ui-guide/registry"
import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  openGuidePage,
  PAGE_UNTIL,
  pointerToCorner,
  poll,
  pressKey,
  samePixel,
  settledScroll,
} from "../harness.ts"
import { describeLinkOutcome, pressLink } from "./shared-links.ts"

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
export async function dropdownChecks(devtools: Devtools): Promise<void> {
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
      const until = ${PAGE_UNTIL}
      const before = state()
      trigger.click()
      await until(() => state().expanded === "true" && !state().hidden)
      const open = state()
      trigger.click()
      await until(() => state().hidden)
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
    await ${PAGE_UNTIL}(() => {
      const state = ${DROPDOWN_STATE}
      return state.hidden && state.onTrigger
    })
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
  // The table below counts triggers on cards of three packages, so it reads every page in turn.
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

/** Where an opened `Dropdown` panel sits relative to its trigger, in viewport pixels. */
interface DropdownPlacement {
  /** `true` when the panel is open: `aria-expanded` and no `hidden`. */
  open: boolean
  triggerTop: number
  triggerBottom: number
  panelTop: number
  panelBottom: number
  /** The viewport's height. */
  viewport: number
}

/**
 * A `Dropdown` left at its default `vertical="auto"` opens upward near the bottom of the viewport
 * and downward near the top.
 *
 * This drives the card's "Text trigger" dropdown, the one with the tallest menu and no `vertical`
 * of its own. The page is scrolled so the trigger sits just above the viewport's bottom edge, the
 * menu is opened with a real Enter press, and its box has to end above the trigger and start inside
 * the viewport. Then the trigger is scrolled near the top, and the same menu has to open below it.
 * Each half first asserts the room it set up, below the trigger against the panel's height and
 * its 8px gap, so a scroll that landed elsewhere fails rather than proves nothing.
 * The pair is what proves the choice: a menu that always opened up passes the first half, one that
 * always opened down passes the second, and only a menu that measures passes both. The measurement
 * runs in a layout effect, so no string render can reach it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function dropdownAutoDirectionChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    const panel = document.querySelector('#demo-Dropdown [role="menu"][aria-label="Bulk actions"]')
    const root = panel.parentElement
    globalThis.__verifyAutoDropdown = {
      panel,
      root,
      trigger: root.querySelector("button[aria-haspopup]"),
    }
    return null
  })()`)
  const placement = `(() => {
    const { trigger, panel } = globalThis.__verifyAutoDropdown
    const t = trigger.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    return {
      open: trigger.getAttribute("aria-expanded") === "true" && !panel.classList.contains("hidden"),
      triggerTop: Math.round(t.top),
      triggerBottom: Math.round(t.bottom),
      panelTop: Math.round(p.top),
      panelBottom: Math.round(p.bottom),
      viewport: document.documentElement.clientHeight,
    }
  })()`

  // Scrolls so the trigger's top sits `fromTop` pixels below the viewport's top, or its bottom
  // `fromBottom` pixels above the viewport's bottom, then opens the menu with a real Enter press.
  const openAt = async (edge: "fromTop" | "fromBottom", gap: number) => {
    const target = await devtools.evaluate<number>(`(() => {
      const box = globalThis.__verifyAutoDropdown.trigger.getBoundingClientRect()
      const viewport = document.documentElement.clientHeight
      const offset = ${edge === "fromTop"} ? box.top - ${gap} : box.bottom - viewport + ${gap}
      const top = Math.round(globalThis.scrollY + offset)
      globalThis.scrollTo({ top, behavior: "instant" })
      return top
    })()`)
    await settledScroll(devtools, { target })
    await devtools.evaluate<null>(`(globalThis.__verifyAutoDropdown.trigger.focus(), null)`)
    await pressKey(devtools, "Enter")
    await poll(
      () =>
        devtools.evaluate<boolean>(
          `globalThis.__verifyAutoDropdown.panel.contains(document.activeElement)`,
        ),
      2_000,
    )
    return await devtools.evaluate<DropdownPlacement>(placement)
  }
  const close = async () => {
    await pressKey(devtools, "Escape")
    await poll(
      () =>
        devtools.evaluate<boolean>(
          `globalThis.__verifyAutoDropdown.panel.classList.contains("hidden")`,
        ),
      2_000,
    )
  }

  const low = await openAt("fromBottom", 16)
  await close()
  check(
    "a Dropdown with vertical auto opens upward when there is no room below its trigger",
    low.open && low.viewport - low.triggerBottom < low.panelBottom - low.panelTop + 8 &&
      low.panelBottom <= low.triggerTop && low.panelTop >= 0,
    `trigger ${low.triggerTop}–${low.triggerBottom} in a ${low.viewport}px viewport, ` +
      `panel ${low.panelTop}–${low.panelBottom}${low.open ? "" : ", never opened"}`,
  )

  const high = await openAt("fromTop", 120)
  await close()
  check(
    "the same Dropdown opens downward when there is room below its trigger",
    high.open && high.viewport - high.triggerBottom >= high.panelBottom - high.panelTop + 8 &&
      high.panelTop >= high.triggerBottom && high.panelBottom <= high.viewport,
    `trigger ${high.triggerTop}–${high.triggerBottom} in a ${high.viewport}px viewport, ` +
      `panel ${high.panelTop}–${high.panelBottom}${high.open ? "" : ", never opened"}`,
  )
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
  // The workspace switcher and AccountMenu, each drawn for the rail and the overlay.
  "demo-RailShell": 4,
  // AccountMenu in the rail; the phone sheet lists the account's entries without a dropdown.
  "demo-AppShell": 1,
  "demo-AccountMenu": 1,
  "demo-PageHeader": 2,
  "demo-MoreMenu": 1,
  "demo-DropdownItem": 2,
  // The widget's "Actions for …" menu.
  "demo-WidgetCard": 1,
  // One "Actions for …" menu per widget of the demo dashboard behind the dialog.
  "demo-LayoutCustomiser": 3,
  // Its Tags and Author menus and the sort.
  "demo-FilterBar": 3,
  // One "Actions for …" menu per ready file: tickets.png, the booking PDF and beach.jpg.
  "demo-AttachmentList": 3,
  // The header language menu.
  "demo-LanguagePicker": 1,
  // The language menu in the second header's actions.
  "demo-SiteHeader": 1,
}

/** The part of a Chromium accessibility node the trigger check reads. */
interface AxNode {
  name?: { value?: string }
  ignoredReasons?: Array<{ name: string }>
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

  // The triggers sit on cards of three packages, and the guide shows one package's page at a
  // time, so every page is read in turn.
  const cards: string[] = []
  const unnamed: string[] = []
  const named: string[] = []
  const hidden: string[] = []
  let triggers = 0
  for (const page of guidePages) {
    await openGuidePage(devtools, page.id)
    const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
      depth: 1,
    })
    const { nodeIds } = await devtools.send<{ nodeIds: number[] }>("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector,
    })
    const onPage = await devtools.evaluate<string[]>(
      `[...document.querySelectorAll('${selector}')]
        .map((trigger) => trigger.closest("[id^=demo-]")?.id ?? "outside any card")`,
    )
    cards.push(...onPage)
    triggers += nodeIds.length

    for (const [index, nodeId] of nodeIds.entries()) {
      const { nodes } = await devtools.send<{ nodes: AxNode[] }>(
        "Accessibility.getPartialAXTree",
        { nodeId, fetchRelatives: false },
      )
      const name = (nodes[0]?.name?.value ?? "").trim()
      const where = onPage[index] ?? `${page.id} trigger ${index + 1}`
      // A trigger the page does not render at this width (RailShell draws each slot once per
      // place, and hides two of the three) is not announced at all, so it has no name to check.
      // It still counts toward the tally above.
      if (nodes[0]?.ignoredReasons?.some((reason) => reason.name === "notRendered")) {
        hidden.push(where)
      } else if (name === "") unnamed.push(where)
      else named.push(`${where}: "${name}"`)
    }
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
    miscounted.length === 0 && triggers === expectedTotal &&
      triggers === cards.length && unnamed.length === 0,
    miscounted.length > 0 || triggers !== expectedTotal
      ? `the catalogue renders ${triggers} dropdown triggers, not the ${expectedTotal} it ` +
        `should — ${miscounted.join("; ")}`
      : unnamed.length > 0
      ? `${unnamed.length} of ${triggers} announce as an unnamed button: ${unnamed.join(", ")}`
      : `all ${triggers - hidden.length} rendered triggers named by Chromium — ` +
        `${named.join(", ")}; ${hidden.length} not rendered at this width`,
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

/** The `DropdownItem` card's routed link item, its two disabled items and its `navigate` counter. */
const DROPDOWN_ITEM_CARD = "#demo-DropdownItem"

const DROPDOWN_ITEM_ROUTED = `${DROPDOWN_ITEM_CARD} [data-e2e="dropdown-item-routed"]`

const DROPDOWN_ITEM_COUNTER = `${DROPDOWN_ITEM_CARD} [data-e2e="dropdown-item-navigated"]`

/** The card's link item to another site, given the same `navigate` port as the routed one. */
const DROPDOWN_ITEM_FOREIGN = `${DROPDOWN_ITEM_CARD} [data-e2e="dropdown-item-foreign"]`

/**
 * A `DropdownItem` link with a `navigate` port hands a plain click to it and cancels the page load,
 * and leaves a Ctrl click to the browser. Each is one real press; {@link pressLink} keeps the page
 * from really following the link.
 *
 * @param devtools The connected session, on the `ui` page.
 */
export async function dropdownItemRouteChecks(devtools: Devtools): Promise<void> {
  const routed = await pressLink(
    devtools,
    DROPDOWN_ITEM_ROUTED,
    { name: "a plain click", button: "left", modifiers: 0 },
    DROPDOWN_ITEM_COUNTER,
  )
  check(
    "a plain click on a DropdownItem link with navigate calls navigate instead of loading the page",
    routed.aimed && routed.type === "click" && routed.prevented === true &&
      routed.navigations === 1 && !routed.navigated,
    describeLinkOutcome(routed),
  )

  const ctrl = await pressLink(
    devtools,
    DROPDOWN_ITEM_ROUTED,
    { name: "a Ctrl click", button: "left", modifiers: 2 },
    DROPDOWN_ITEM_COUNTER,
  )
  check(
    "a Ctrl click on a DropdownItem link with navigate is left to the browser",
    ctrl.aimed && ctrl.type === "click" && ctrl.prevented === false && ctrl.navigations === 0 &&
      !ctrl.navigated,
    describeLinkOutcome(ctrl),
  )

  const foreign = await pressLink(
    devtools,
    DROPDOWN_ITEM_FOREIGN,
    { name: "a plain click", button: "left", modifiers: 0 },
    DROPDOWN_ITEM_COUNTER,
  )
  check(
    "a plain click on a DropdownItem link with navigate to another origin is left to the browser",
    foreign.aimed && foreign.type === "click" && foreign.prevented === false &&
      foreign.navigations === 0 && !foreign.navigated,
    describeLinkOutcome(foreign),
  )
  await pointerToCorner(devtools)
}

/** One palette's reading of the `DropdownItem` card's disabled items, as `seen` composites them. */
interface DisabledItemReading {
  /** Both disabled items and an enabled button item were found. */
  found: boolean
  /** The text colour a reader sees on the disabled danger item, `[r, g, b]`. */
  danger: number[]
  /** The text colour a reader sees on the plain disabled item. */
  plain: number[]
  /** Contrast of the plain disabled item's text on its ground. */
  disabledRatio: number
  /** Contrast of an enabled button item's text on its ground. */
  enabledRatio: number
}

/**
 * A disabled `DropdownItem` with `danger` looks like any disabled item, in both palettes: the text
 * a reader sees on it is the same colour as on the plain disabled item, not red. And both are
 * dimmed: the disabled text stands lower off its ground than an enabled item's does.
 *
 * @param devtools The connected session, on the `ui` page.
 */
export async function dropdownItemDisabledDangerCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const reading = await devtools.evaluate<Record<"light" | "dark", DisabledItemReading>>(
    `(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const card = document.querySelector('${DROPDOWN_ITEM_CARD}')
    const danger = card?.querySelector('[data-e2e="dropdown-item-disabled-danger"]')
    const plain = card?.querySelector('[data-e2e="dropdown-item-disabled"]')
    const enabled = [...(card?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent.trim() === "A button, because it has none")
    const settle = () => Promise.all(
      [danger, plain, enabled].flatMap((element) =>
        element ? element.getAnimations().map((animation) => animation.finished.catch(() => {})) : []
      ),
    )
    const measure = () => danger && plain && enabled
      ? {
        found: true,
        danger: seen(danger).text,
        plain: seen(plain).text,
        disabledRatio: seenRatio(plain),
        enabledRatio: seenRatio(enabled),
      }
      : { found: false, danger: [], plain: [], disabledRatio: 0, enabledRatio: 0 }
    try {
      root.classList.remove("dark")
      await settle()
      const light = measure()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      return { light, dark }
    } finally {
      root.classList.toggle("dark", wasDark)
    }
  })()`,
  )
  for (const palette of ["light", "dark"] as const) {
    const read = reading[palette]
    check(
      `in the ${palette} palette a disabled danger DropdownItem draws the same text as a plain ` +
        "disabled item, dimmed below an enabled one",
      read.found && samePixel(read.danger, read.plain) && read.disabledRatio < read.enabledRatio,
      !read.found
        ? `the DropdownItem card is missing a disabled, a disabled danger or an enabled item`
        : `danger text rgb(${read.danger}), plain disabled rgb(${read.plain}); disabled ` +
          `${read.disabledRatio.toFixed(2)}:1, enabled ${read.enabledRatio.toFixed(2)}:1`,
    )
  }
}
