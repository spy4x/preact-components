import {
  centreInView,
  check,
  type Devtools,
  PAGE_UNTIL,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import {
  darkDateIconCheck,
  escapeFromPageCheck,
  inWideViewport,
  nativePickerCheck,
  type PickerMode,
  settledActiveElement,
  tabThroughPanelChecks,
} from "./date-range-picker-shared.ts"
import { aimAt, blurActive, clickAt } from "./shared.ts"

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
export async function dateRangeChecks(devtools: Devtools): Promise<void> {
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
    await ${PAGE_UNTIL}(() => (${PICKER_STATE}).customPressed === "true")
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
  await escapeFromPageCheck(devtools, DAY_PICKER)
  await outsideClickCheck(devtools)
  await tabThroughPanelChecks(devtools, DAY_PICKER)
  await inWideViewport(devtools, async () => {
    await nativePickerCheck(devtools, DAY_PICKER)
    await darkDateIconCheck(devtools, DAY_PICKER)
  })

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

const DAY_PICKER: PickerMode = {
  subject: "DateRangePicker",
  parked: "__verifyPicker",
  open: openPickerPanel,
}
