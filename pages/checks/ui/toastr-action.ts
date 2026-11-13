import { centreInView, check, type Devtools, PAGE_UNTIL, poll, pressKey } from "../harness.ts"
import { pointerAway } from "./toastr-shared.ts"
import { type Box, holdsFor, NARROW_WIDTH } from "./shared.ts"

/** What {@link PUSH_UNDO} reports: the card's Undo toast, pushed alone onto an empty stack. */
interface UndoPushed {
  ok: boolean
  /** What was missing from the card, when `ok` is false. */
  reason: string
  /** The duration the card pushed, read off its button's `data-duration`. */
  duration: number
  /** The action's label, read off its button's `data-label`. */
  label: string
  /** The undo count the card showed before anything was pressed. */
  undone: number
}

/**
 * Clear the Toastr card's stack, push its one toast with an action, and park the toast, its action
 * button and a `MutationObserver` on it in `globalThis.__verifyUndo`.
 *
 * The observer counts every change to the toast's text and children from the moment it arrived.
 * Inside a polite live area such a change is announced again, so a toast whose text moved while it
 * was focused or hovered would be read twice; the checks below require the count to stay at zero.
 * The toast's 300ms entry fade is a CSS transition, which the observer does not see.
 */
const PUSH_UNDO = `(async () => {
  const parked = globalThis.__verifyToastr ?? {}
  const { card, region, clear } = parked
  const undo = card?.querySelector('[data-e2e="toast-undo"]') ?? null
  const count = card?.querySelector('[data-e2e="toast-undo-count"]') ?? null
  const blank = { duration: 0, label: "", undone: -1 }
  const missing = [
    region ? "" : "its live area",
    clear ? "" : 'its clear button (data-e2e="toast-clear")',
    undo === null ? 'its Undo button (data-e2e="toast-undo")' : "",
    count === null ? 'its undo count (data-e2e="toast-undo-count")' : "",
  ].filter(Boolean)
  if (missing.length > 0) {
    return { ...blank, ok: false, reason: "the Toastr card is missing " + missing.join(", ") }
  }
  const duration = Number(undo.dataset.duration ?? 0)
  const label = undo.dataset.label ?? ""
  if (!Number.isFinite(duration) || duration <= 0 || label === "") {
    return {
      ...blank,
      ok: false,
      reason: "the card's Undo button carries no usable data-duration or data-label",
    }
  }
  const until = ${PAGE_UNTIL}
  clear.click()
  await until(() => region.children.length === 0)
  undo.click()
  await until(() => region.querySelector('[data-e2e="guide-toast-undo"]') !== null)
  const toast = region.querySelector('[data-e2e="guide-toast-undo"]')
  if (toast === null || region.children.length !== 1) {
    return {
      ...blank,
      ok: false,
      reason: "pressing the card's Undo button left " + region.children.length +
        " toast(s) on the stack, and none carried data-e2e=\\"guide-toast-undo\\"",
    }
  }
  const action = [...toast.querySelectorAll("button")]
    .find((button) => (button.textContent ?? "").trim() === label) ?? null
  const state = { toast, action, count, mutations: 0 }
  new MutationObserver((records) => { state.mutations += records.length })
    .observe(toast, { childList: true, characterData: true, subtree: true })
  globalThis.__verifyUndo = state
  return { ok: true, reason: "", duration, label, undone: Number(count.textContent) }
})()`

/** Whether the parked Undo toast is still on the stack. */
const UNDO_PRESENT = `(globalThis.__verifyUndo?.toast?.isConnected ?? false) && ` +
  `(globalThis.__verifyToastr?.region?.contains(globalThis.__verifyUndo.toast) ?? false)`

/** What {@link toastrActionNameCheck} reads off the action button. */
interface ActionReading {
  /** Whether a `<button>` whose whole text is the label was found inside the toast. */
  found: boolean
  type: string
  /** The name the browser's accessibility tree gives the button. */
  name: string
  /** `aria-label`, `aria-labelledby` and `title`, joined, so a failure can say which was set. */
  overrides: string
  /** Whether it can be reached by Tab: not disabled, not `tabindex="-1"`, not under `aria-hidden`. */
  reachable: boolean
  /** Whether it sits in the toast's own `status` element, a child of the polite live area. */
  announced: boolean
  /** How many times the label occurs in the toast's text. */
  labelCount: number
  /** Whether the toast's text holds the card's body. */
  hasBody: boolean
  /** Whether the action comes before the dismiss control in document order. */
  beforeDismiss: boolean
}

/**
 * #580: a toast's action. The checks below push the Toastr card's Undo toast through its real
 * `createToastStore` and prove what the issue asked for and what a unit test cannot see: the
 * action is a real button whose accessible name is its label, a screen reader hears the message and
 * the label once, Tab reaches it, focus or the pointer on it holds the timer, Enter runs it, and
 * it runs at most once.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function toastrActionChecks(devtools: Devtools): Promise<void> {
  await pointerAway(devtools)
  await toastrActionNameCheck(devtools)
  await toastrActionKeyboardCheck(devtools)
  await toastrActionPointerCheck(devtools)
  await toastrActionOnceCheck(devtools)
  await toastrActionFocusReturnCheck(devtools, "action")
  await toastrActionFocusReturnCheck(devtools, "dismiss")
  await toastrActionKeepsMovedFocusCheck(devtools)
  await toastrActionNarrowCheck(devtools)
  await toastrActionTargetCheck(devtools)
  await devtools.evaluate<null>(`(globalThis.__verifyToastr?.clear?.click(), null)`)
}

/** One toast's action button, as {@link toastrActionTargetCheck} reads it. */
interface ActionTarget {
  /** The button's `data-e2e`, or `null` when it has no such attribute. */
  hook: string | null
  /** The button's box in CSS pixels, where the toast's slide has ended. */
  width: number
  height: number
}

/** What {@link toastrActionTargetCheck} reads. */
interface TargetReading {
  ok: boolean
  /** What was missing, when `ok` is false. */
  reason: string
  /** The hook the card says it gave the Undo toast's action, off its button's `data-action-hook`. */
  wanted: string
  /** How many elements in the stack carry that hook while the Undo toast is alone on it. */
  hooked: number
  /** Whether the one element carrying the hook is the button labelled Undo. */
  hookIsAction: boolean
  /** The Undo toast's action, whose store message named a `dataE2E` for it. */
  short: ActionTarget
  /** The long-label toast's action, whose store message named none. */
  long: ActionTarget
}

/** The smallest side a touch target may have, in CSS pixels. */
const TOUCH_TARGET_PX = 44

/**
 * #671: a toast's action button carries the `data-e2e` its store message asked for, carries none
 * when the message asked for none, and at a phone's width is at least 44 px tall and wide with a
 * four-letter label, which its text alone leaves about 37 by 28. A label long enough to wrap is
 * larger than that by its text, so its size is printed and not required.
 *
 * Both toasts come out of the card's real `createToastStore`, so the hook is read after it has
 * crossed the store.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrActionTargetCheck(devtools: Devtools): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: NARROW_WIDTH,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  })
  let reading: TargetReading
  try {
    reading = await devtools.evaluate<TargetReading>(`(async () => {
      const { card, region, clear } = globalThis.__verifyToastr ?? {}
      const undo = card?.querySelector('[data-e2e="toast-undo"]') ?? null
      const long = card?.querySelector('[data-e2e="toast-undo-long"]') ?? null
      const none = { hook: null, width: 0, height: 0 }
      const blank = { wanted: "", hooked: 0, hookIsAction: false, short: none, long: none }
      const wanted = undo?.dataset.actionHook ?? ""
      if (!region || !clear || undo === null || long === null || wanted === "") {
        return { ...blank, ok: false, reason: "the Toastr card is missing its live area, its " +
          'clear button, its long-action button or an Undo button with a data-action-hook' }
      }
      const until = ${PAGE_UNTIL}
      // Push one toast alone, wait for its slide to end, and read its action button.
      const push = async (button, hook) => {
        clear.click()
        await until(() => region.children.length === 0)
        button.click()
        await until(() => region.querySelector('[data-e2e="' + hook + '"]') !== null)
        const toast = region.querySelector('[data-e2e="' + hook + '"]')
        const label = button.dataset.label ?? ""
        const action = [...(toast?.querySelectorAll("button") ?? [])]
          .find((candidate) => (candidate.textContent ?? "").trim() === label) ?? null
        if (toast === null || action === null) return null
        await until(() => toast.getAnimations({ subtree: true }).length === 0)
        const rect = action.getBoundingClientRect()
        return {
          action,
          target: { hook: action.getAttribute("data-e2e"), width: rect.width, height: rect.height },
        }
      }
      const short = await push(undo, "guide-toast-undo")
      const carriers = [...region.querySelectorAll('[data-e2e="' + wanted + '"]')]
      const hookIsAction = short !== null && carriers.length === 1 && carriers[0] === short.action
      const lengthy = await push(long, "guide-toast-undo-long")
      if (short === null || lengthy === null) {
        return { ...blank, ok: false, reason: "a toast arrived without a button labelled with " +
          "its card button's data-label" }
      }
      return {
        ok: true,
        reason: "",
        wanted,
        hooked: carriers.length,
        hookIsAction,
        short: short.target,
        long: lengthy.target,
      }
    })()`)
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }

  const show = (hook: string | null) => hook === null ? "no data-e2e" : `data-e2e="${hook}"`
  check(
    "a toast action's dataE2E, set on the store message, is the data-e2e of its button, and an " +
      "action that names none has no data-e2e",
    reading.ok && reading.short.hook === reading.wanted && reading.hooked === 1 &&
      reading.hookIsAction && reading.long.hook === null,
    !reading.ok
      ? reading.reason
      : `the card asked for "${reading.wanted}": the Undo button has ${
        show(reading.short.hook)
      }, ` +
        `${reading.hooked} element(s) in the stack carry it, and the long action, which asked ` +
        `for none, has ${show(reading.long.hook)}`,
  )

  const size = (target: ActionTarget) => `${target.width}×${target.height}`
  const bigEnough = (target: ActionTarget) =>
    target.width >= TOUCH_TARGET_PX && target.height >= TOUCH_TARGET_PX
  check(
    `at ${NARROW_WIDTH}px a toast's action button with a short label is at least ` +
      `${TOUCH_TARGET_PX}px tall and wide`,
    reading.ok && bigEnough(reading.short),
    !reading.ok
      ? reading.reason
      : `the Undo button is ${size(reading.short)}; the long label's is ${size(reading.long)}`,
  )
}

/**
 * Dismissing the focused toast through its action, or through its dismiss control, hands focus
 * back to the element it came from — the card's clear button here — instead of dropping it on the
 * page body, where a keyboard user would have to start again from the top.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param via Which of the toast's buttons Enter is pressed on.
 */
async function toastrActionFocusReturnCheck(
  devtools: Devtools,
  via: "action" | "dismiss",
): Promise<void> {
  const pushed = await devtools.evaluate<UndoPushed>(PUSH_UNDO)
  await devtools.evaluate<null>(`(globalThis.__verifyToastr?.clear?.focus(), null)`)
  await pressKey(devtools, "Tab")
  if (via === "dismiss") await pressKey(devtools, "Tab")
  const target = await devtools.evaluate<boolean>(`(() => {
    const { toast, action } = globalThis.__verifyUndo ?? {}
    const buttons = [...(toast?.querySelectorAll("button") ?? [])]
    const wanted = ${via === "action" ? "action" : "buttons.at(-1)"}
    return wanted != null && document.activeElement === wanted
  })()`)
  await pressKey(devtools, "Enter")
  const gone = await poll(async () => !await devtools.evaluate<boolean>(UNDO_PRESENT), 3000)
  const landed = await devtools.evaluate<{ onClear: boolean; tag: string }>(`(() => {
    const active = document.activeElement
    return {
      onClear: active !== null && active === globalThis.__verifyToastr?.clear,
      tag: active === null ? "nothing" : active.tagName + " " +
        ((active.textContent ?? "").trim().slice(0, 40) || active.getAttribute("aria-label") || ""),
    }
  })()`)
  const name = via === "action" ? "its action" : "its dismiss control"

  check(
    `Enter on ${name} closes a focused toast and returns focus to the button it came from`,
    pushed.ok && target && gone && landed.onClear,
    !pushed.ok
      ? pushed.reason
      : !target
      ? `Tab from the clear button did not land on the toast's ${via} button`
      : !gone
      ? `Enter on ${name} left the toast on screen`
      : !landed.onClear
      ? `focus fell to ${landed.tag}, not to the card's clear button`
      : `focus went back to the card's clear button after Enter on ${name}`,
  )
}

/**
 * #606: an action that moves focus on purpose — to a dialog, or here to the card's name field —
 * keeps it there when its toast closes. `Toastr` hands focus back only while the stack still holds
 * it; without that condition the toast would pull focus back to the button it came from, out of
 * whatever the action opened.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrActionKeepsMovedFocusCheck(devtools: Devtools): Promise<void> {
  const pushed = await devtools.evaluate<{ ok: boolean; reason: string }>(`(async () => {
    const { card, region, clear } = globalThis.__verifyToastr ?? {}
    const rename = card?.querySelector('[data-e2e="toast-rename"]') ?? null
    const field = card?.querySelector('[data-e2e="toast-rename-field"]') ?? null
    if (!region || !clear || rename === null || field === null) {
      return { ok: false, reason: "the Toastr card is missing its live area, its clear button, " +
        'its Rename button (data-e2e="toast-rename") or its name field ' +
        '(data-e2e="toast-rename-field")' }
    }
    const until = ${PAGE_UNTIL}
    clear.click()
    await until(() => region.children.length === 0)
    rename.click()
    await until(() => region.querySelector('[data-e2e="guide-toast-rename"]') !== null)
    const toast = region.querySelector('[data-e2e="guide-toast-rename"]')
    const label = rename.dataset.label ?? ""
    const action = [...(toast?.querySelectorAll("button") ?? [])]
      .find((button) => (button.textContent ?? "").trim() === label) ?? null
    if (toast === null || action === null) {
      return { ok: false, reason: "pressing Rename pushed no toast with a button labelled " +
        JSON.stringify(label) }
    }
    globalThis.__verifyRename = { toast, action, field }
    clear.focus()
    return { ok: true, reason: "" }
  })()`)
  await pressKey(devtools, "Tab")
  const onAction = await devtools.evaluate<boolean>(
    `document.activeElement !== null && document.activeElement === globalThis.__verifyRename?.action`,
  )
  await pressKey(devtools, "Enter")
  const gone = await poll(
    async () =>
      !await devtools.evaluate<boolean>(`globalThis.__verifyRename?.toast?.isConnected ?? false`),
    3000,
  )
  // Focus is read after the toast has left the page, so a late hand-back would already have run.
  const landed = await devtools.evaluate<{ onField: boolean; tag: string }>(`(() => {
    const active = document.activeElement
    return {
      onField: active !== null && active === globalThis.__verifyRename?.field,
      tag: active === null ? "nothing" : active.tagName + " " +
        ((active.textContent ?? "").trim().slice(0, 40) || active.getAttribute("aria-label") || ""),
    }
  })()`)

  check(
    "A toast action that moves focus out of the stack keeps it there after the toast closes",
    pushed.ok && onAction && gone && landed.onField,
    !pushed.ok
      ? pushed.reason
      : !onAction
      ? "Tab from the clear button did not land on the Rename toast's action"
      : !gone
      ? "Enter on Rename left its toast on screen"
      : !landed.onField
      ? `focus ended on ${landed.tag}, not on the name field the action focused`
      : "focus stayed in the name field the Rename action moved it to",
  )
}

/** What {@link toastrActionNarrowCheck} measures. */
interface NarrowReading {
  ok: boolean
  /** What was missing, when `ok` is false. */
  reason: string
  label: string
  /** The viewport's width, without a scrollbar. */
  width: number
  toast: Box
  action: Box
  dismiss: Box
}

/**
 * At a phone's width, a toast whose action label runs to some thirty characters keeps its action
 * and its dismiss control inside the toast and inside the window. A label that refused to wrap
 * pushed the dismiss control out of both, so the toast could not be closed by hand.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrActionNarrowCheck(devtools: Devtools): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: NARROW_WIDTH,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  })
  let reading: NarrowReading
  try {
    reading = await devtools.evaluate<NarrowReading>(`(async () => {
      const { card, region, clear } = globalThis.__verifyToastr ?? {}
      const long = card?.querySelector('[data-e2e="toast-undo-long"]') ?? null
      const blank = { label: "", width: 0, toast: null, action: null, dismiss: null }
      if (!region || !clear || long === null) {
        return { ...blank, ok: false, reason: "the Toastr card is missing its live area, its " +
          'clear button or its long-action button (data-e2e="toast-undo-long")' }
      }
      const label = long.dataset.label ?? ""
      const until = ${PAGE_UNTIL}
      clear.click()
      await until(() => region.children.length === 0)
      long.click()
      await until(() => region.querySelector('[data-e2e="guide-toast-undo-long"]') !== null)
      const toast = region.querySelector('[data-e2e="guide-toast-undo-long"]')
      const buttons = [...(toast?.querySelectorAll("button") ?? [])]
      const action = buttons.find((button) => (button.textContent ?? "").trim() === label)
      const dismiss = buttons.at(-1)
      if (!toast || !action || !dismiss || action === dismiss || label.length < 25) {
        return { ...blank, ok: false, reason: "the long-action toast arrived without a " +
          "dismiss control and a button labelled with the card's data-label of 25+ characters" }
      }
      // The boxes are read where the 300ms slide ends.
      await until(() => toast.getAnimations({ subtree: true }).length === 0)
      const box = (element) => {
        const rect = element.getBoundingClientRect()
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        }
      }
      return {
        ok: true,
        reason: "",
        label,
        width: document.documentElement.clientWidth,
        toast: box(toast),
        action: box(action),
        dismiss: box(dismiss),
      }
    })()`)
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }

  const within = (inner: Box, outer: Box) =>
    inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  const inWindow = (inner: Box) => inner.left >= 0 && inner.right <= reading.width
  const fits = reading.ok && within(reading.action, reading.toast) &&
    within(reading.dismiss, reading.toast) && inWindow(reading.action) &&
    inWindow(reading.dismiss)
  const show = (box: Box) => `${box.left}–${box.right} × ${box.top}–${box.bottom}`

  check(
    `at ${NARROW_WIDTH}px a toast with a long action label keeps its action and its dismiss ` +
      "control inside the toast and the window",
    fits,
    !reading.ok
      ? reading.reason
      : `"${reading.label}": toast ${show(reading.toast)}, action ${show(reading.action)}, ` +
        `dismiss ${show(reading.dismiss)}, window 0–${reading.width}`,
  )
}

/**
 * The action is a button named by its visible label alone, inside the toast's live element, before
 * the dismiss control, and the toast's text carries the label exactly once.
 *
 * The name is the browser's own, read from its accessibility tree over the DevTools Protocol, so
 * an `aria-label` that renamed the button, or one that repeated the label, shows up here.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrActionNameCheck(devtools: Devtools): Promise<void> {
  const pushed = await devtools.evaluate<UndoPushed>(PUSH_UNDO)
  const reading = await devtools.evaluate<Omit<ActionReading, "name">>(`(() => {
    const { toast, action } = globalThis.__verifyUndo ?? {}
    const region = globalThis.__verifyToastr?.region ?? null
    const label = ${JSON.stringify(pushed.label)}
    const text = toast?.textContent ?? ""
    if (!toast || !action) {
      return { found: false, type: "", overrides: "", reachable: false, announced: false,
        labelCount: text.split(label).length - 1, hasBody: false, beforeDismiss: false }
    }
    // The dismiss control is the toast's last button, whatever the action is named.
    const dismiss = [...toast.querySelectorAll("button")].at(-1) ?? null
    return {
      found: true,
      type: action.getAttribute("type") ?? "",
      overrides: ["aria-label", "aria-labelledby", "title"]
        .filter((name) => action.hasAttribute(name)).join(", "),
      reachable: !action.disabled && action.tabIndex >= 0 &&
        action.closest('[aria-hidden="true"]') === null,
      announced: action.closest('[role="status"]') === toast && toast.parentElement === region &&
        region.getAttribute("aria-live") === "polite",
      labelCount: text.split(label).length - 1,
      hasBody: text.includes("Draft deleted"),
      beforeDismiss: dismiss !== null && dismiss !== action &&
        (action.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    }
  })()`)
  const name = reading.found ? await accessibleName(devtools) : ""

  check(
    "a toast's action is a button named by its label alone, inside the toast's live element and " +
      "before its dismiss control, and the toast's text carries the label once",
    pushed.ok && reading.found && reading.type === "button" && name === pushed.label &&
      reading.overrides === "" && reading.reachable && reading.announced &&
      reading.labelCount === 1 && reading.hasBody && reading.beforeDismiss,
    !pushed.ok
      ? pushed.reason
      : !reading.found
      ? `the Undo toast has no button whose text is "${pushed.label}"`
      : `type="${reading.type}", accessible name "${name}"` +
        `${reading.overrides === "" ? "" : `, set by ${reading.overrides}`}, ` +
        `${reading.reachable ? "reachable" : "not reachable"} by Tab, ` +
        `${reading.announced ? "inside" : "outside"} the toast's live element, ` +
        `${reading.beforeDismiss ? "before" : "not before"} the dismiss control; the toast's ` +
        `text has the label ${reading.labelCount} time(s)` +
        `${reading.hasBody ? "" : " and no body"}`,
  )
}

/**
 * The accessible name Chromium computes for the parked action button, or `""` when it has none.
 *
 * @param devtools The connected session.
 */
async function accessibleName(devtools: Devtools): Promise<string> {
  const { result } = await devtools.send<{ result: { objectId?: string } }>("Runtime.evaluate", {
    expression: `globalThis.__verifyUndo?.action ?? null`,
  })
  if (result.objectId === undefined) return ""
  const { nodes } = await devtools.send<{ nodes: Array<{ name?: { value?: string } }> }>(
    "Accessibility.getPartialAXTree",
    { objectId: result.objectId, fetchRelatives: false },
  )
  return nodes[0]?.name?.value ?? ""
}

/**
 * Tab reaches the action from the control just before the stack, the toast stays while the action
 * has focus — well past the moment its own timer would have taken it — without its text changing,
 * and Enter on the focused action runs it once and closes the toast.
 *
 * Focus starts on the card's clear button, the last control before the stack in document order,
 * and the move into the toast is a real Tab press, so this is the path a keyboard user takes.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrActionKeyboardCheck(devtools: Devtools): Promise<void> {
  const parked = await pointerAway(devtools)
  const pushed = await devtools.evaluate<UndoPushed>(PUSH_UNDO)
  await devtools.evaluate<null>(`(globalThis.__verifyToastr?.clear?.focus(), null)`)
  await pressKey(devtools, "Tab")
  const focused = await devtools.evaluate<{ onAction: boolean; label: string }>(`(() => {
    const active = document.activeElement
    return {
      onAction: active !== null && active === globalThis.__verifyUndo?.action,
      label: (active?.textContent ?? "").trim().slice(0, 40) || (active?.tagName ?? "nothing"),
    }
  })()`)
  const held = await holdsFor(
    () => devtools.evaluate<boolean>(UNDO_PRESENT),
    Math.round(pushed.duration * 1.5),
  )
  const mutations = await devtools.evaluate<number>(`globalThis.__verifyUndo?.mutations ?? -1`)
  await pressKey(devtools, "Enter")
  const gone = await poll(async () => !await devtools.evaluate<boolean>(UNDO_PRESENT), 3000)
  const undone = await devtools.evaluate<number>(
    `Number(document.querySelector('#demo-Toastr [data-e2e="toast-undo-count"]')?.textContent ?? -1)`,
  )

  check(
    "Tab reaches a toast's action, focus on it holds the timer without changing the toast's text, " +
      "and Enter runs it once and closes the toast",
    pushed.ok && parked.insideRegion === false && focused.onAction && held.held &&
      mutations === 0 && gone && undone === pushed.undone + 1,
    !pushed.ok
      ? pushed.reason
      : parked.insideRegion
      ? `the pointer was resting on the stack (${parked.tag}), which pauses the timer on its own`
      : !focused.onAction
      ? `Tab from the clear button landed on "${focused.label}", not on the action`
      : held.unreadable
      ? `the page stopped answering ${held.elapsedMs}ms in, so this proves nothing`
      : !held.held
      ? `a ${pushed.duration}ms toast left ${held.elapsedMs}ms in with focus on its action`
      : mutations !== 0
      ? `the toast's text or children changed ${mutations} time(s) while its action had focus, ` +
        `so a screen reader would announce it again`
      : !gone
      ? "Enter on the focused action left the toast on screen"
      : undone !== pushed.undone + 1
      ? `Enter ran the action ${undone - pushed.undone} time(s), not once`
      : `Tab landed on "${focused.label}", a ${pushed.duration}ms toast stayed ` +
        `${held.elapsedMs}ms with its text unchanged, and Enter ran the action once and closed it`,
  )
}

/**
 * The pointer resting on the action holds the toast's timer without changing its text, and the
 * timer resumes once the pointer leaves.
 *
 * The move is a real `Input.dispatchMouseEvent` aimed at the button's centre, checked against
 * `elementFromPoint` first, so a pointer that missed says so instead of passing as a pause.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrActionPointerCheck(devtools: Devtools): Promise<void> {
  await pointerAway(devtools)
  await centreInView(devtools, `globalThis.__verifyToastr?.region ?? null`)
  const pushed = await devtools.evaluate<UndoPushed>(PUSH_UNDO)
  const spot = await devtools.evaluate<{ x: number; y: number; onAction: boolean; tag: string }>(
    `(() => {
    const action = globalThis.__verifyUndo?.action ?? null
    if (action === null) return { x: -1, y: -1, onAction: false, tag: "nothing" }
    const box = action.getBoundingClientRect()
    const x = Math.round(box.left + box.width / 2)
    const y = Math.round(box.top + box.height / 2)
    const target = document.elementFromPoint(x, y)
    return {
      x,
      y,
      onAction: target !== null && action.contains(target),
      tag: target === null ? "nothing" : target.tagName,
    }
  })()`,
  )
  if (spot.onAction) {
    await devtools.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: spot.x,
      y: spot.y,
      button: "none",
      buttons: 0,
    })
  }
  const hovered = await devtools.evaluate<boolean>(
    `globalThis.__verifyUndo?.action?.matches(":hover") ?? false`,
  )
  const held = await holdsFor(
    () => devtools.evaluate<boolean>(UNDO_PRESENT),
    Math.round(pushed.duration * 1.5),
  )
  const mutations = await devtools.evaluate<number>(`globalThis.__verifyUndo?.mutations ?? -1`)
  const away = await pointerAway(devtools)
  const startedAt = Date.now()
  const gone = await poll(
    async () => !await devtools.evaluate<boolean>(UNDO_PRESENT),
    pushed.duration * 3,
  )
  const resumedMs = Date.now() - startedAt

  check(
    "the pointer on a toast's action holds the timer without changing the toast's text, and " +
      "leaving resumes it",
    pushed.ok && spot.onAction && hovered && held.held && mutations === 0 &&
      away.insideRegion === false && gone,
    !pushed.ok
      ? pushed.reason
      : !spot.onAction
      ? `the action's centre (${spot.x}, ${spot.y}) reads ${spot.tag}, so there was nothing to ` +
        `point at`
      : !hovered
      ? "the pointer move did not leave the action hovered, so this proves nothing"
      : held.unreadable
      ? `the page stopped answering ${held.elapsedMs}ms in, so this proves nothing`
      : !held.held
      ? `a ${pushed.duration}ms toast left ${held.elapsedMs}ms in with the pointer on its action`
      : mutations !== 0
      ? `the toast's text or children changed ${mutations} time(s) while it was hovered`
      : away.insideRegion
      ? "the pointer never left the stack, so a resume proves nothing"
      : !gone
      ? `the timer never resumed: still on screen ${resumedMs}ms after the pointer left`
      : `a ${pushed.duration}ms toast stayed ${held.elapsedMs}ms with the pointer on its action ` +
        `and its text unchanged, and left ${resumedMs}ms after the pointer moved away`,
  )
}

/**
 * Two clicks on the action in one task — before the dismissal can re-render the stack — run it
 * once, and the toast leaves both the screen and the store.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrActionOnceCheck(devtools: Devtools): Promise<void> {
  const pushed = await devtools.evaluate<UndoPushed>(PUSH_UNDO)
  const outcome = await devtools.evaluate<{ undone: number; gone: boolean; stored: string }>(
    `(async () => {
    const { action, count } = globalThis.__verifyUndo ?? {}
    if (!action || !count) return { undone: -1, gone: false, stored: "?" }
    action.click()
    action.click()
    const until = ${PAGE_UNTIL}
    const gone = await until(() => !(${UNDO_PRESENT}))
    return {
      undone: Number(count.textContent),
      gone,
      stored: document.querySelector('#demo-Toastr [data-e2e="toast-store-count"]')?.textContent ?? "?",
    }
  })()`,
  )

  check(
    "a toast's action pressed twice before the stack re-renders runs once, and the toast leaves " +
      "the screen and the store",
    pushed.ok && outcome.undone === pushed.undone + 1 && outcome.gone && outcome.stored === "0",
    !pushed.ok
      ? pushed.reason
      : outcome.undone !== pushed.undone + 1
      ? `two clicks ran the action ${outcome.undone - pushed.undone} time(s)`
      : !outcome.gone
      ? "the toast stayed on screen after its action ran"
      : outcome.stored !== "0"
      ? `the store still holds ${outcome.stored} toast(s) after the action ran`
      : "two clicks ran the action once, and the toast left the screen and the store",
  )
}
