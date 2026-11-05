import { centreInView, check, type Devtools, PAGE_UNTIL, poll } from "../harness.ts"
import { goneWithin, pointerAway, pushAutoToast } from "./toastr-shared.ts"
import { type Hold, holdsFor, type Point } from "./shared.ts"

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
export async function storeDelayChecks(devtools: Devtools): Promise<void> {
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
    const until = ${PAGE_UNTIL}
    clear.click()
    await until((() => {
      const state = ${TOASTR_STORE_AND_DOM}
      return state.dom === 0 && state.store === 0
    }))
    long.click()
    success.click()
    await until((() => {
      const state = ${TOASTR_STORE_AND_DOM}
      return state.dom === 2 && state.store === 2
    }))
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
    await ${PAGE_UNTIL}((() => {
      const state = ${TOASTR_STORE_AND_DOM}
      return state.dom === 1 && state.store === 1
    }))
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
    await ${PAGE_UNTIL}((() => {
      const state = ${TOASTR_STORE_AND_DOM}
      return state.dom === 0 && state.store === 0
    }))
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
export async function budgetCheck(devtools: Devtools): Promise<void> {
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
export async function extendCheck(devtools: Devtools): Promise<void> {
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
export async function focusPauseCheck(devtools: Devtools): Promise<void> {
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
export async function pointerPauseCheck(devtools: Devtools): Promise<void> {
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

    const until = ${PAGE_UNTIL}
    clear.click()
    await until(() => region.children.length === 0)
    const pushedAt = Date.now()
    auto.click()
    await until(() => region.children.length > 0)
    const wait = Math.round(duration * ${share}) - (Date.now() - pushedAt)
    // A deliberate pause, not a poll: the check needs the toast to have lived this share of its
    // duration, and no state on the page marks that moment.
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
