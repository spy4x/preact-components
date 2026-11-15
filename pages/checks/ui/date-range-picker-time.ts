import { centreInView, check, type Devtools, pointerToCorner, poll, pressKey } from "../harness.ts"
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
import { clickAtPoint } from "./shared-forms.ts"

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
export async function dateRangeTimeChecks(devtools: Devtools): Promise<void> {
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
  await escapeFromPageCheck(devtools, TIME_PICKER)
  await outsideClickTimeCheck(devtools)
  await tabThroughPanelChecks(devtools, TIME_PICKER)
  await inWideViewport(devtools, async () => {
    await nativePickerCheck(devtools, TIME_PICKER)
    await darkDateIconCheck(devtools, TIME_PICKER)
  })
  await repeatedHourCheck(devtools)
  await keyboardPassCheck(devtools)
  await skippedHourCheck(devtools)
  await blurActive(devtools)
}

/** A page expression for one element inside the parked `withTime` panel, by its `data-e2e` hook. */
function inTimePanel(hook: string): string {
  return `(globalThis.__verifyPickerTime?.panel?.querySelector('[data-e2e="${hook}"]') ?? null)`
}

/**
 * Type a value into one of the parked `withTime` panel's two fields, the way the typing check above
 * does: set the value and dispatch one `input` event.
 */
async function typeTimeField(devtools: Devtools, hook: string, value: string): Promise<boolean> {
  return await devtools.evaluate<boolean>(`(() => {
    const field = ${inTimePanel(hook)}
    if (field === null) return false
    field.value = ${JSON.stringify(value)}
    field.dispatchEvent(new Event("input", { bubbles: true }))
    return true
  })()`)
}

/** Whether the parked `withTime` panel's Apply is there and enabled. */
function timeApplyEnabled(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const apply = ${inTimePanel("date-range-apply")}
    return apply !== null && apply.disabled === false
  })()`)
}

/** The text of the withTime card's readout with `data-e2e="<hook>"`, next to the picker. */
function timeReadout(devtools: Devtools, hook: string): Promise<string> {
  return devtools.evaluate<string>(`(() => {
    const trigger = globalThis.__verifyPickerTime?.trigger ?? null
    const readout = trigger
      ?.closest(':has(> [data-e2e="${hook}"])')
      ?.querySelector(':scope > [data-e2e="${hook}"]') ?? null
    return (readout?.textContent ?? "").trim()
  })()`)
}

/** What the browser's accessibility tree computes for one element: its name and description. */
interface TimeAX {
  found: boolean
  name: string
  description: string
}

/**
 * Read one element in the parked `withTime` panel from the browser's own accessibility tree —
 * `Accessibility.getPartialAXTree`, the name and description a screen reader is given — rather
 * than from its attributes, so a broken `aria-describedby` target or a label that no longer
 * resolves reads as what it is: nothing. The same approach as `pages/checks/map.ts`, one fresh
 * document root per read and never two reads at once, for the reason given there.
 */
async function timePanelAX(devtools: Devtools, hook: string): Promise<TimeAX> {
  const selector = await devtools.evaluate<string>(`(() => {
    const panel = globalThis.__verifyPickerTime?.panel ?? null
    return panel === null ? "" : "#" + CSS.escape(panel.id) + ' [data-e2e="${hook}"]'
  })()`)
  if (selector === "") return { found: false, name: "", description: "" }
  await devtools.send("Accessibility.enable", {})
  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: -1,
    pierce: true,
  })
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  })
  if (!nodeId) return { found: false, name: "", description: "" }
  const { nodes } = await devtools.send<
    { nodes: Array<{ name?: { value?: string }; description?: { value?: string } }> }
  >("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false })
  return {
    found: true,
    name: String(nodes[0]?.name?.value ?? "").trim(),
    description: String(nodes[0]?.description?.value ?? "").trim(),
  }
}

/**
 * Bring a radio in the parked panel into view and press it with a real mouse click, then wait
 * until it reads checked.
 *
 * @returns An empty string on success, or what went wrong.
 */
async function clickTimeRadio(devtools: Devtools, hook: string): Promise<string> {
  const target = inTimePanel(hook)
  if (!await centreInView(devtools, target)) return `the ${hook} radio never came to rest in view`
  const aim = await aimAt(devtools, target)
  if (!aim.onTarget) return `the ${hook} radio is covered by ${aim.tag} at its own centre`
  const landing = await clickAt(devtools, aim, target)
  if (landing === null || !landing.onTarget) {
    return `the click aimed at ${hook} landed on ${landing?.tag ?? "nothing"}`
  }
  const checked = await poll(
    () => devtools.evaluate<boolean>(`${target}?.checked === true`),
    3_000,
  )
  return checked ? "" : `the ${hook} radio was clicked and never read checked`
}

/**
 * The hour Paris repeats when its clocks go back, driven by a person (#264).
 *
 * `2026-10-25T02:30` and `02:45` each happen twice in Europe/Paris. Typing them must make both
 * fields ask which pass is meant; a real click on From's "Second" must disable Apply, because the
 * second 02:30 comes after the first 02:45; clicking back to From's "First" and then To's "Second"
 * must enable it, and Apply must hand `onChange` the first 02:30 (00:30Z) through the second 02:45
 * (01:45Z) — seventy-five real minutes, not the fifteen both strings read as.
 */
async function repeatedHourCheck(devtools: Devtools): Promise<void> {
  await closeTimePanelIfOpen(devtools)
  const EXPECTED = "instants: 2026-10-25T00:30:00.000Z → 2026-10-25T01:45:00.000Z"
  await pointerToCorner(devtools)
  const opened = await openTimePickerPanel(devtools)
  const typed = opened.open &&
    await typeTimeField(devtools, "date-range-from", "2026-10-25T02:30") &&
    await typeTimeField(devtools, "date-range-to", "2026-10-25T02:45")
  const asked = typed && await poll(
    () =>
      devtools.evaluate<boolean>(
        `${inTimePanel("date-range-from-occurrence")} !== null && ` +
          `${inTimePanel("date-range-to-occurrence")} !== null`,
      ),
    3_000,
  )
  const firstChecked = asked && await devtools.evaluate<boolean>(
    `${inTimePanel("date-range-from-earlier")}?.checked === true && ` +
      `${inTimePanel("date-range-to-earlier")}?.checked === true`,
  )

  const REPEATED = "This time happens twice that day"
  const fromGroup = await timePanelAX(devtools, "date-range-from-occurrence")
  const toGroup = await timePanelAX(devtools, "date-range-to-occurrence")
  const fromField = await timePanelAX(devtools, "date-range-from")
  const toField = await timePanelAX(devtools, "date-range-to")
  // Chromium describes a field by a fieldset through the fieldset's legend.
  const describes = (field: TimeAX) => field.description === REPEATED
  check(
    "each field's choice of pass is named after that field, and is the field's own accessible description",
    asked && fromGroup.name === `From ${REPEATED}` && toGroup.name === `To ${REPEATED}` &&
      describes(fromField) && describes(toField),
    !asked
      ? "there was no choice of pass on the page to read"
      : `groups named "${fromGroup.name}" / "${toGroup.name}"; From described as ` +
        `"${fromField.description}", To as "${toField.description}"`,
  )

  const fromLater = asked ? await clickTimeRadio(devtools, "date-range-from-later") : "not asked"
  // Wait for the render that follows the click to reach Apply, then require it to stay disabled.
  const disabledWhenReversed = fromLater === "" &&
    await poll(async () => !(await timeApplyEnabled(devtools)), 3_000)

  const fromEarlier = fromLater === ""
    ? await clickTimeRadio(devtools, "date-range-from-earlier")
    : "skipped"
  const toLater = fromEarlier === ""
    ? await clickTimeRadio(devtools, "date-range-to-later")
    : "skipped"
  const enabled = toLater === "" && await poll(() => timeApplyEnabled(devtools), 3_000)
  if (enabled) {
    await devtools.evaluate<null>(`(${inTimePanel("date-range-apply")}?.click(), null)`)
  }
  const applied = enabled && await poll(
    async () => (await timeReadout(devtools, "controlled-instants")) === EXPECTED,
    3_000,
  )
  const readout = await timeReadout(devtools, "controlled-instants")
  await pointerToCorner(devtools)

  check(
    "a repeated hour asks which pass each field means, and a real click on the second one decides the instant onChange receives",
    opened.open && typed && asked && firstChecked && disabledWhenReversed && applied,
    !opened.open
      ? "the withTime panel never opened"
      : !typed
      ? "the withTime panel has no From or To field to type into"
      : !asked
      ? "typing 2026-10-25T02:30 and 02:45 in Europe/Paris never showed both fields' choice of pass"
      : !firstChecked
      ? "the choice did not start on the first pass for both fields"
      : fromLater !== ""
      ? fromLater
      : !disabledWhenReversed
      ? "Apply stayed enabled with From on the second 02:30 and To on the first 02:45, which is " +
        "forty-five minutes backwards"
      : fromEarlier !== ""
      ? fromEarlier
      : toLater !== ""
      ? toLater
      : !enabled
      ? "Apply never enabled for the first 02:30 through the second 02:45"
      : !applied
      ? `onChange received "${readout}", not "${EXPECTED}"`
      : `From "Second" disabled Apply; From "First" and To "Second" applied "${readout}"`,
  )
}

/**
 * Close the parked `withTime` panel if a check that failed part-way left it open, so the next check
 * starts from a closed panel and its own opening press opens it rather than closing it.
 */
async function closeTimePanelIfOpen(devtools: Devtools): Promise<void> {
  if (!(await devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.open`))) return
  await devtools.evaluate<null>(
    `(${inTimePanel("date-range-preset-last-hour")}?.focus(), null)`,
  )
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`${PICKER_TIME_STATE}.open === false`), 3_000)
}

/** Whether the parked panel's radio `hook` is checked and has focus. */
function radioFocusedAndChecked(devtools: Devtools, hook: string): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const radio = ${inTimePanel(hook)}
    return radio !== null && radio.checked === true && document.activeElement === radio
  })()`)
}

/**
 * The same repeated hour, driven by keyboard alone once focus is on a radio: real ArrowDown and
 * ArrowUp presses move between the two passes of one field — and only that field's, which is what
 * the radios' shared `name` gives them — and Apply follows each move. A click then only puts focus
 * on To's first pass (a `datetime-local` field lies between the groups, and Tab walks its segments),
 * ArrowDown picks To's second pass, a second ArrowDown wraps to To's first (never into From's
 * pair) and a third comes back, and Tab, Tab, Enter applies the first 02:30 through the second
 * 02:45.
 */
async function keyboardPassCheck(devtools: Devtools): Promise<void> {
  await closeTimePanelIfOpen(devtools)
  const EXPECTED = "instants: 2026-10-25T00:30:00.000Z → 2026-10-25T01:45:00.000Z"
  await pointerToCorner(devtools)
  const opened = await openTimePickerPanel(devtools)
  const typed = opened.open &&
    await typeTimeField(devtools, "date-range-from", "2026-10-25T02:30") &&
    await typeTimeField(devtools, "date-range-to", "2026-10-25T02:45")
  const asked = typed && await poll(
    () => devtools.evaluate<boolean>(`${inTimePanel("date-range-from-earlier")} !== null`),
    3_000,
  )
  // The panel reopens on the passes the last applied range named, so To is first set to its first
  // pass by a click; then a click on From's first pass puts focus there, and the rest is keys.
  const toFirst = asked ? await clickTimeRadio(devtools, "date-range-to-earlier") : "not asked"
  const focusedFrom = toFirst === ""
    ? await clickTimeRadio(devtools, "date-range-from-earlier")
    : toFirst
  await pointerToCorner(devtools)

  let step = focusedFrom
  if (step === "") {
    await pressKey(devtools, "ArrowDown")
    const moved = await poll(() => radioFocusedAndChecked(devtools, "date-range-from-later"), 3_000)
    const off = moved && await poll(async () => !(await timeApplyEnabled(devtools)), 3_000)
    const toUntouched = await devtools.evaluate<boolean>(
      `${inTimePanel("date-range-to-earlier")}?.checked === true`,
    )
    step = !moved
      ? "ArrowDown on From's first pass did not check and focus From's second pass"
      : !toUntouched
      ? "ArrowDown in From's group changed To's choice"
      : !off
      ? "Apply stayed enabled with From on the second 02:30, after To's first 02:45"
      : ""
  }
  if (step === "") {
    await pressKey(devtools, "ArrowUp")
    const back = await poll(
      () => radioFocusedAndChecked(devtools, "date-range-from-earlier"),
      3_000,
    )
    const on = back && await poll(() => timeApplyEnabled(devtools), 3_000)
    step = !back
      ? "ArrowUp did not bring From back to its first pass"
      : !on
      ? "Apply did not come back on with From on its first pass"
      : ""
  }
  if (step === "") {
    // Into To's group by a click on its already-checked first pass: a `datetime-local` field sits
    // between the two groups, and Tab walks through that field's own date and time segments.
    const clicked = await clickTimeRadio(devtools, "date-range-to-earlier")
    await pointerToCorner(devtools)
    const inTo = await poll(() => radioFocusedAndChecked(devtools, "date-range-to-earlier"), 3_000)
    if (inTo) await pressKey(devtools, "ArrowDown")
    const toLater = inTo &&
      await poll(() => radioFocusedAndChecked(devtools, "date-range-to-later"), 3_000)
    step = clicked !== ""
      ? clicked
      : !inTo
      ? "a click on To's first pass did not leave focus on it"
      : !toLater
      ? "ArrowDown in To's group did not check and focus To's second pass"
      : ""
  }
  if (step === "") {
    // From To's last radio, ArrowDown has to wrap to To's first — the two radios of one field share
    // a name the other field's radios do not. Without that, it walks on into From's pair and
    // silently changes the other field's pass.
    await pressKey(devtools, "ArrowDown")
    const wrapped = await poll(
      () => radioFocusedAndChecked(devtools, "date-range-to-earlier"),
      3_000,
    )
    const fromKept = await devtools.evaluate<boolean>(
      `${inTimePanel("date-range-from-earlier")}?.checked === true`,
    )
    const landed = await devtools.evaluate<string>(
      `document.activeElement?.getAttribute?.("data-e2e") ?? document.activeElement?.tagName ?? ""`,
    )
    if (wrapped && fromKept) await pressKey(devtools, "ArrowDown")
    const againLater = wrapped && fromKept &&
      await poll(() => radioFocusedAndChecked(devtools, "date-range-to-later"), 3_000)
    step = !wrapped
      ? `a second ArrowDown from To's second pass went to "${landed}", not back to To's first`
      : !fromKept
      ? "a second ArrowDown in To's group changed From's choice"
      : !againLater
      ? "a third ArrowDown in To's group did not come back to To's second pass"
      : ""
  }
  let readout = ""
  if (step === "") {
    // Past To's group: Cancel, then Apply.
    await pressKey(devtools, "Tab")
    await pressKey(devtools, "Tab")
    const onApply = await poll(
      () =>
        devtools.evaluate<boolean>(`document.activeElement === ${inTimePanel("date-range-apply")}`),
      3_000,
    )
    if (onApply) await pressKey(devtools, "Enter")
    const applied = onApply && await poll(
      async () => (await timeReadout(devtools, "controlled-instants")) === EXPECTED,
      3_000,
    )
    readout = await timeReadout(devtools, "controlled-instants")
    step = !onApply
      ? "two Tabs from To's group did not reach Apply"
      : !applied
      ? `Enter on Apply handed onChange "${readout}", not "${EXPECTED}"`
      : ""
  }

  check(
    "the choice of pass works by keyboard: arrows move within one field's pair, and Apply follows",
    opened.open && typed && asked && step === "",
    !opened.open
      ? "the withTime panel never opened"
      : !typed
      ? "the withTime panel has no From or To field to type into"
      : !asked
      ? "typing 2026-10-25T02:30 in Europe/Paris never showed From's choice of pass"
      : step !== ""
      ? step
      : `ArrowDown/ArrowUp in From; ArrowDown, a wrap to the first pass and back in To; then Enter on Apply: "${readout}"`,
  )
}

/**
 * The hour Paris skips when its clocks go forward, typed by a person (#264): `2026-03-29T02:30`
 * never happens there, so the field says it is read as 03:30, and Apply hands `onChange` 03:30 in
 * both the string and the instant (01:30Z).
 */
async function skippedHourCheck(devtools: Devtools): Promise<void> {
  await closeTimePanelIfOpen(devtools)
  const EXPECTED_RANGE = "range: 2026-03-29T03:30 → 2026-03-29T04:00"
  const EXPECTED_INSTANTS = "instants: 2026-03-29T01:30:00.000Z → 2026-03-29T02:00:00.000Z"
  await pointerToCorner(devtools)
  const opened = await openTimePickerPanel(devtools)
  // First a To that the skipped From is read past: 02:30 becomes 03:30, after 03:10.
  const typedReversed = opened.open &&
    await typeTimeField(devtools, "date-range-from", "2026-03-29T02:30") &&
    await typeTimeField(devtools, "date-range-to", "2026-03-29T03:10")
  const ORDER = "The From date is after the To date. Change one of them to apply."
  const SKIPPED = "The clocks skip this time that day, so we'll use 2026-03-29 03:30."
  const orderShown = typedReversed && await poll(
    () =>
      devtools.evaluate<boolean>(
        `(${inTimePanel("date-range-order")}?.textContent ?? "").trim() === ${
          JSON.stringify(ORDER)
        }`,
      ),
    3_000,
  )
  const reversedApplyDisabled = orderShown && !(await timeApplyEnabled(devtools))
  const reversedApply = await timePanelAX(devtools, "date-range-apply")
  const reversedFrom = await timePanelAX(devtools, "date-range-from")
  check(
    "a skipped From read past To says so, and the field and Apply are described by why",
    orderShown && reversedApplyDisabled && reversedApply.description === ORDER &&
      reversedFrom.description === `${SKIPPED} ${ORDER}`,
    !typedReversed
      ? "the withTime panel has no From or To field to type into"
      : !orderShown
      ? "typing 2026-03-29T02:30 → 03:10 in Europe/Paris showed no note that From comes after To"
      : !reversedApplyDisabled
      ? "Apply stayed enabled for a From read as 03:30 and a To of 03:10"
      : `Apply described as "${reversedApply.description}", From as "${reversedFrom.description}"`,
  )

  const typed = typedReversed &&
    await typeTimeField(devtools, "date-range-to", "2026-03-29T04:00")
  const noted = typed && await poll(
    () =>
      devtools.evaluate<boolean>(
        `(${inTimePanel("date-range-from-skipped")}?.textContent ?? "").includes("03:30")`,
      ),
    3_000,
  )
  const enabled = noted && await poll(() => timeApplyEnabled(devtools), 3_000)
  const skippedFrom = await timePanelAX(devtools, "date-range-from")
  const skippedTo = await timePanelAX(devtools, "date-range-to")
  check(
    "a skipped From is described, to a screen reader, by the note that says what it is read as",
    noted && skippedFrom.description === SKIPPED && skippedTo.description === "",
    !noted
      ? "there was no skipped-time note on the page to read"
      : `From described as "${skippedFrom.description}", To as "${skippedTo.description}"`,
  )
  if (enabled) {
    await devtools.evaluate<null>(`(${inTimePanel("date-range-apply")}?.click(), null)`)
  }
  const applied = enabled && await poll(
    async () =>
      (await timeReadout(devtools, "controlled-value")) === EXPECTED_RANGE &&
      (await timeReadout(devtools, "controlled-instants")) === EXPECTED_INSTANTS,
    3_000,
  )
  const range = await timeReadout(devtools, "controlled-value")
  const instants = await timeReadout(devtools, "controlled-instants")

  check(
    "a typed time the clocks skip says what it is read as, and Apply hands back that reading and its instant",
    opened.open && typed && noted && enabled && applied,
    !opened.open
      ? "the withTime panel never opened"
      : !typed
      ? "the withTime panel has no From or To field to type into"
      : !noted
      ? "typing 2026-03-29T02:30 in Europe/Paris showed no note that it is read as 03:30"
      : !enabled
      ? "Apply never enabled for a skipped From"
      : !applied
      ? `onChange received "${range}" / "${instants}", not "${EXPECTED_RANGE}" / ` +
        `"${EXPECTED_INSTANTS}"`
      : `the note named 03:30, and onChange received "${range}" / "${instants}"`,
  )
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

const TIME_PICKER: PickerMode = {
  subject: "withTime panel",
  parked: "__verifyPickerTime",
  open: openTimePickerPanel,
}
