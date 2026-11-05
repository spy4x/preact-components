import { check, CONTRAST_HELPERS, type Devtools, PAGE_UNTIL, pointerToCorner } from "../harness.ts"
import { goneWithin, pointerAway, pushAutoToast } from "./toastr-shared.ts"
import { holdsFor } from "./shared.ts"
import {
  budgetCheck,
  extendCheck,
  focusPauseCheck,
  pointerPauseCheck,
  storeDelayChecks,
} from "./toastr-timing.ts"
import { toastrActionChecks } from "./toastr-action.ts"

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
    // the toast, so a card whose toast grows past these 60 characters before that label appears
    // turns the check red for a reason that has nothing to do with the component. The card's
    // toast reads its title, "Success", then "success — pushed by the demo stack": 41 characters
    // with the label at 7. Lengthen this cut along with that text.
    text: (region.textContent ?? "").trim().slice(0, 60),
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
export async function toastrChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(TOASTR_SETUP)
  const empty = await devtools.evaluate<ToastrState>(TOASTR_STATE)

  // The button's own label is what the demo puts at the front of the toast's body, so the check can
  // demand that the words arrived without keeping a copy of the card's prose to drift from it.
  const filled = await devtools.evaluate<ToastrState & { pushed: string }>(`(async () => {
    const button = globalThis.__verifyToastr?.success ?? null
    const pushed = (button?.textContent ?? "").trim()
    button?.click()
    await ${PAGE_UNTIL}(() => {
      const state = ${TOASTR_STATE}
      return state.toasts >= 1 && state.height > 0 && state.text.includes(pushed)
    })
    return { ...(${TOASTR_STATE}), pushed }
  })()`)
  const cleared = await devtools.evaluate<ToastrState>(`(async () => {
    globalThis.__verifyToastr?.clear?.click()
    await ${PAGE_UNTIL}(() => {
      const state = ${TOASTR_STATE}
      return state.toasts === 0 && state.height === 0
    })
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
  await toastrTitleCheck(devtools)
  await toastrOwnHookCheck(devtools)
  await toastrWarningContrastCheck(devtools)
  await toastrActionChecks(devtools)

  // Leave the card as it was found, for whatever reads the page next.
  await devtools.evaluate<null>(`(globalThis.__verifyToastr?.clear?.click(), null)`)
}

/** What {@link toastrTitleCheck} reads off one toast's title. */
interface ToastTitleReading {
  /** The title the check expected on this toast. */
  want: string
  /** The toast's own text, cut short, for the failure message. */
  text: string
  /** Whether an element whose whole text is the title was found inside the toast. */
  found: boolean
  /** Whether it is painted: a box, `visibility: visible`, full opacity, and no `aria-hidden` above it. */
  visible: boolean
  /** Whether its box ends above where the body's begins. */
  above: boolean
  /** Whether it is drawn heavier than the body. */
  bolder: boolean
  /** Whether it sits inside the toast's `status`/`alert` element, inside the polite live area. */
  announced: boolean
}

/**
 * #207: the title a toast carries is on screen. The store has always filled one in — "Success",
 * "Error" — and a caller could pass their own, and until #207 the component drew neither.
 *
 * Pushes two toasts through the card's real store: one from the success button, which names no
 * title and so carries the store's default, and one from the titled button, which carries the
 * title written on it as `data-title`. For each, the check finds the element whose whole text is
 * that title and asserts it is painted, heavier than the body, above the body, and inside the
 * toast's live element — a title a screen reader never hears would be half the fix. The toasts'
 * 300ms entry fade is waited out first, so "painted" is read at full opacity.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrTitleCheck(devtools: Devtools): Promise<void> {
  const outcome = await devtools.evaluate<{ reason: string; readings: ToastTitleReading[] }>(
    `(async () => {
    const parked = globalThis.__verifyToastr ?? {}
    const region = parked.region ?? null
    const titled = parked.card?.querySelector('[data-e2e="toast-titled"]') ?? null
    const missing = [
      region === null ? "its live area" : "",
      parked.success ? "" : 'its success button (data-e2e="toast-success")',
      titled === null ? 'its titled button (data-e2e="toast-titled")' : "",
      parked.clear ? "" : 'its clear button (data-e2e="toast-clear")',
    ].filter(Boolean)
    if (missing.length > 0) {
      return { reason: "the Toastr card is missing " + missing.join(", "), readings: [] }
    }
    const until = ${PAGE_UNTIL}
    parked.clear.click()
    await until(() => region.children.length === 0)
    parked.success.click()
    titled.click()
    // The toasts fade in over 300ms; "painted" is read once every part of both is fully opaque.
    await until(() =>
      region.children.length >= 2 &&
      [...region.children].every((toast) =>
        [toast, ...toast.querySelectorAll("*")]
          .every((el) => Number(getComputedStyle(el).opacity) > 0.99)
      )
    )

    const wants = ["Success", titled.dataset.title ?? ""]
    const toasts = [...region.children]
    const readings = wants.map((want, index) => {
      const toast = toasts[index] ?? null
      const text = (toast?.textContent ?? "").trim().slice(0, 90)
      const leaves = toast === null ? [] : [...toast.querySelectorAll("*")]
        .filter((el) => el.children.length === 0 && !(el instanceof SVGElement))
      const heading = leaves.find((el) => (el.textContent ?? "").trim() === want) ?? null
      // Both of the card's bodies carry an em dash, and neither title does.
      const body = leaves.find((el) => el !== heading && (el.textContent ?? "").includes("—")) ??
        null
      if (want === "" || heading === null || body === null) {
        return { want, text, found: false, visible: false, above: false, bolder: false,
          announced: false }
      }
      const box = heading.getBoundingClientRect()
      const style = getComputedStyle(heading)
      let opacity = 1
      for (let el = heading; el !== null; el = el.parentElement) {
        opacity *= Number(getComputedStyle(el).opacity)
      }
      const live = heading.closest('[role="status"], [role="alert"]')
      return {
        want,
        text,
        found: true,
        visible: box.width > 0 && box.height > 0 && style.visibility === "visible" &&
          opacity > 0.99 && heading.closest('[aria-hidden="true"]') === null,
        above: box.bottom <= body.getBoundingClientRect().top + 1,
        bolder: Number(style.fontWeight) > Number(getComputedStyle(body).fontWeight),
        announced: live === toast && live.parentElement === region &&
          region.getAttribute("aria-live") === "polite",
      }
    })
    parked.clear.click()
    await until(() => region.children.length === 0)
    return { reason: "", readings }
  })()`,
  )
  const [fallback, own] = outcome.readings
  const describe = (reading: ToastTitleReading | undefined, name: string) =>
    reading === undefined
      ? `no ${name} toast was read`
      : !reading.found
      ? `the ${name} toast reads "${reading.text}", with no element holding "${reading.want}" ` +
        `on its own above an em-dashed body`
      : `"${reading.want}" is ${reading.visible ? "painted" : "not painted"}, ` +
        `${reading.above ? "above" : "not above"} the body, ` +
        `${reading.bolder ? "heavier than" : "no heavier than"} it, and ` +
        `${reading.announced ? "inside" : "outside"} the toast's live element`
  const passes = (reading: ToastTitleReading | undefined) =>
    reading !== undefined && reading.found && reading.visible && reading.above &&
    reading.bolder && reading.announced
  check(
    "a toast shows its title above its body, the store's default for its kind and a caller's own",
    outcome.reason === "" && passes(fallback) && passes(own),
    outcome.reason !== ""
      ? outcome.reason
      : `default: ${describe(fallback, "success")}; own: ${describe(own, "titled")}`,
  )
}

/**
 * #420: a toast carries its own `data-e2e`, so a test can wait for one message instead of for any
 * text inside the stack.
 *
 * Pushes one toast from the card's success button, whose store message names
 * `dataE2E: "guide-toast-success"`, and asserts that exactly one element in the stack carries that
 * hook, that it is the toast itself — a direct child of the live area holding the pushed body — and
 * that the stack's own hook is still the stack's.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrOwnHookCheck(devtools: Devtools): Promise<void> {
  const outcome = await devtools.evaluate<{ reason: string; detail: string; ok: boolean }>(
    `(async () => {
    const parked = globalThis.__verifyToastr ?? {}
    const region = parked.region ?? null
    if (region === null || !parked.success || !parked.clear) {
      return { reason: "the Toastr card is missing its live area or its success or clear button",
        detail: "", ok: false }
    }
    const until = ${PAGE_UNTIL}
    parked.clear.click()
    await until(() => region.children.length === 0)
    parked.success.click()
    await until(() =>
      region.querySelector('[data-e2e="guide-toast-success"]')?.textContent
        .includes("pushed by the demo stack")
    )
    const hooked = [...region.querySelectorAll('[data-e2e="guide-toast-success"]')]
    const toast = hooked[0] ?? null
    const detail = hooked.length + " element(s) carry the hook" +
      (toast === null ? "" : "; the first is a " + toast.tagName.toLowerCase() +
        " whose parent is " + (toast.parentElement === region ? "the stack" : "not the stack") +
        ", role " + toast.getAttribute("role") + ", text: " +
        (toast.textContent ?? "").trim().slice(0, 60))
    const ok = hooked.length === 1 && toast.parentElement === region &&
      toast.getAttribute("role") === "status" &&
      (toast.textContent ?? "").includes("pushed by the demo stack") &&
      region.getAttribute("data-e2e") === "guide-toastr"
    parked.clear.click()
    await until(() => region.children.length === 0)
    return { reason: "", detail, ok }
  })()`,
  )
  check(
    "a toast pushed with its own dataE2E carries that data-e2e on the toast itself",
    outcome.reason === "" && outcome.ok,
    outcome.reason !== "" ? outcome.reason : outcome.detail,
  )
}

/** The warning toast's colours and its weakest label, read in one palette. */
interface WarningToastReading {
  /** The toast's fill and the `--color-warning-fill` token, both painted to sRGB bytes. */
  fill: string
  token: string
  /** The toast's text colour and the `--color-warning-foreground` token, painted the same way. */
  label: string
  labelToken: string
  /** The lowest of the title's, the body's and the dismiss button's contrast on the fill. */
  ratio: number
  /** The toast's opacity with its ancestors', which must be 1 for the reading to mean anything. */
  opacity: number
  /** The page canvas, which differs between the palettes: proof the palette really switched. */
  canvas: string
}

/**
 * #461: the warning toast is drawn with the warning tokens, and its label reads 4.5:1 or better on
 * that fill in light and dark. Pushes one warning toast from the card's real store, waits out its
 * entry fade, and in each palette paints the toast's fill and text colour next to
 * `--color-warning-fill` and `--color-warning-foreground`. The contrast is the lowest of the
 * title, the body and the dismiss button, each against everything composited behind it. The page
 * canvas is read in each palette too, and must differ, so a palette that never switched fails.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function toastrWarningContrastCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const outcome = await devtools.evaluate<{
    reason: string
    light?: WarningToastReading
    dark?: WarningToastReading
  }>(`(async () => {
    ${CONTRAST_HELPERS}
    const parked = globalThis.__verifyToastr ?? {}
    const region = parked.region ?? null
    const push = parked.card?.querySelector('[data-e2e="toast-warning"]') ?? null
    if (region === null || push === null || !parked.clear) {
      return { reason: "the Toastr card is missing its live area, its warning button " +
        '(data-e2e="toast-warning") or its clear button' }
    }
    const until = ${PAGE_UNTIL}
    parked.clear.click()
    await until(() => region.children.length === 0)
    push.click()
    // Waits out the toast's 300ms entry fade, so its colours are read at full opacity.
    await until(() => {
      const arrived = region.querySelector('[data-e2e="guide-toast-warning"]')
      return arrived !== null && arrived.getAnimations({ subtree: true }).length === 0
    })
    const toast = region.querySelector('[data-e2e="guide-toast-warning"]')
    if (toast === null) {
      parked.clear.click()
      return { reason: "no warning toast arrived in the stack" }
    }
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const rgb = (bytes) => "rgb(" + bytes.join(", ") + ")"
    const token = (name) => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = "var(" + name + ")"
      document.body.appendChild(probe)
      const color = paint(getComputedStyle(probe).backgroundColor)
      probe.remove()
      return rgb(color)
    }
    const labels = [
      ...toast.querySelectorAll("p"),
      toast.querySelector("button"),
    ].filter(Boolean)
    const measure = () => {
      let opacity = 1
      for (let el = toast; el !== null; el = el.parentElement) {
        opacity *= Number(getComputedStyle(el).opacity)
      }
      return {
        fill: rgb(paint(getComputedStyle(toast).backgroundColor)),
        token: token("--color-warning-fill"),
        label: rgb(paint(getComputedStyle(toast).color)),
        labelToken: token("--color-warning-foreground"),
        ratio: labels.length < 3 ? 0 : Math.min(
          ...labels.map((el) => seenRatio(el)),
        ),
        opacity,
        canvas: token("--color-canvas"),
      }
    }
    try {
      root.classList.remove("dark")
      const light = measure()
      root.classList.add("dark")
      const dark = measure()
      return { reason: "", light, dark }
    } finally {
      root.classList.toggle("dark", wasDark)
      parked.clear.click()
      await until(() => region.children.length === 0)
    }
  })()`)
  const passes = (reading: WarningToastReading | undefined) =>
    reading !== undefined && reading.fill === reading.token &&
    reading.label === reading.labelToken && reading.ratio >= 4.5 && reading.opacity > 0.99
  const describe = (name: string, reading: WarningToastReading | undefined) =>
    reading === undefined
      ? `${name}: not read`
      : `${name}: fill ${reading.fill} (token ${reading.token}), label ${reading.label} ` +
        `(token ${reading.labelToken}), lowest ${reading.ratio.toFixed(2)}:1 at opacity ` +
        `${reading.opacity.toFixed(2)}, canvas ${reading.canvas}`
  check(
    "the warning toast draws the warning tokens and its label reads 4.5:1 in light and dark",
    outcome.reason === "" && passes(outcome.light) && passes(outcome.dark) &&
      outcome.light?.canvas !== outcome.dark?.canvas,
    outcome.reason !== ""
      ? outcome.reason
      : `${describe("light", outcome.light)}; ${describe("dark", outcome.dark)}`,
  )
}
