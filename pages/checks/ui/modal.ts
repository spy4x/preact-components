import {
  centreInView,
  check,
  type Devtools,
  PAGE_UNTIL,
  pointerToCorner,
  poll,
  pressKey,
  settledScroll,
} from "../harness.ts"
import { type Aim, aimAt, clickAt, clickSelector, holdsFor } from "./shared.ts"

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
export async function modalChecks(devtools: Devtools): Promise<void> {
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
    await ${PAGE_UNTIL}(() =>
      Number(document.querySelector('#demo-Modal [data-e2e="modal-close-step"]')?.dataset.step) !==
        before
    )
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
  await modalBackdropCheck(devtools)
  await modalFallbackEscapeCheck(devtools)
  await confirmDialogChecks(devtools)
  await confirmDialogBusyChecks(devtools)
  await confirmDialogBusyFallbackCheck(devtools)
}

/**
 * A point on a dialog's backdrop: halfway between the viewport's left edge and the dialog's, at the
 * dialog's vertical middle, with what `elementFromPoint` reads there.
 *
 * The backdrop hit-tests as the dialog itself, which is how `Modal` tells a backdrop click from a
 * click inside its box, so `onTarget` means "the dialog is under this point" and the point is
 * outside the dialog's own box by construction.
 *
 * @param devtools The connected session.
 * @param dialog A page expression for the open dialog.
 */
async function backdropAim(devtools: Devtools, dialog: string): Promise<Aim> {
  return await devtools.evaluate<Aim>(`(() => {
    const dialog = ${dialog}
    if (dialog === null || dialog === undefined) {
      return { x: -1, y: -1, inViewport: false, onTarget: false, tag: "nothing", width: 0, height: 0 }
    }
    const box = dialog.getBoundingClientRect()
    const x = Math.round(box.left / 2)
    const y = Math.round(box.top + box.height / 2)
    const at = document.elementFromPoint(x, y)
    return {
      x,
      y,
      inViewport: x > 0 && y > 0 && x < box.left,
      onTarget: x > 0 && x < box.left && at === dialog,
      tag: at === null ? "nothing" : at.tagName,
      width: Math.round(box.width),
      height: Math.round(box.height),
    }
  })()`)
}

/** The page's scroll-lock styles, inline and computed, in one read. */
interface SharedLockReading {
  /** Inline `overflow` of `html` and of `body`. */
  inlineHtml: string
  inlineBody: string
  /** Inline `padding-right` of `body`. */
  inlinePadding: string
  /** Computed `overflow-y` of `html`. */
  html: string
}

/** Reads {@link SharedLockReading}. */
const SHARED_LOCK_READING = `(() => ({
  inlineHtml: document.documentElement.style.overflow,
  inlineBody: document.body.style.overflow,
  inlinePadding: document.body.style.paddingRight,
  html: getComputedStyle(document.documentElement).overflowY,
}))()`

/**
 * `Modal` and `CommandPalette` hold one counted scroll lock (#649).
 *
 * First the order a palette whose `onSelect` opens a `Modal` can produce: the guide's search
 * palette locks the page, the Modal card's dialog opens over it, and the palette closes first. The
 * page must stay locked under the Modal, with the padding the palette measured, and the Modal's close
 * must give the page back its own styles — a `padding-right` of `1px` set on the body beforehand, so
 * a restore to the empty string is told apart from a restore. Then a Modal opened over another
 * Modal must leave the page's padding as the first one set it, rather than measure a page whose
 * scrollbar is already gone and write `0px`.
 *
 * The second dialog in each pair is opened by a scripted `.click()` on a trigger the first dialog
 * makes inert: a person could not press it, but an `onSelect` or an app's own code opens a dialog in
 * exactly that state.
 *
 * @param devtools The connected session, on the guide's `ui` page with no dialog open.
 */
export async function sharedScrollLockChecks(devtools: Devtools): Promise<void> {
  const read = () => devtools.evaluate<SharedLockReading>(SHARED_LOCK_READING)
  const show = (reading?: SharedLockReading) =>
    reading === undefined
      ? "no reading"
      : `inline overflow "${reading.inlineHtml}"/"${reading.inlineBody}", padding ` +
        `"${reading.inlinePadding}", html computed ${reading.html}`
  const PALETTE = `document.querySelector('[data-e2e="ui-guide-search"]')`
  const MODAL = `document.querySelector('#demo-Modal [data-e2e="guide-modal"]')`
  const NESTED = `document.querySelector('#demo-Modal [data-e2e="guide-modal-uncontrolled"]')`
  const press = (label: string) =>
    devtools.evaluate<boolean>(`(() => {
      const button = [...document.querySelectorAll("#demo-Modal button")]
        .find((candidate) => candidate.textContent.trim().startsWith(${JSON.stringify(label)}))
      button?.click()
      return button !== undefined
    })()`)
  const closeModal = (dialog: string) =>
    devtools.evaluate<null>(
      `(${dialog}?.querySelector('header button[aria-label="Close"]')?.click(), null)`,
    )
  const until = (expression: string) => poll(() => devtools.evaluate<boolean>(expression), 3_000)
  // Every dialog this check may have opened, closed whatever happened, and the marker taken off.
  const cleanUp = async () => {
    await devtools.evaluate<null>(`(${PALETTE}?.open && ${PALETTE}.close(), null)`)
    await closeModal(NESTED)
    await until(`${NESTED} === null`)
    await closeModal(MODAL)
    await until(`${MODAL} === null`)
    await devtools.evaluate<null>(`(document.body.style.paddingRight = "", null)`)
  }

  await settledScroll(devtools)
  const original = await devtools.evaluate<SharedLockReading>(
    `(document.body.style.paddingRight = "1px", ${SHARED_LOCK_READING})`,
  )
  let order: {
    opened: boolean
    modalOpened: boolean
    paletteClosed: boolean
    modalClosed: boolean
    palette?: SharedLockReading
    underModal?: SharedLockReading
    after?: SharedLockReading
  } = { opened: false, modalOpened: false, paletteClosed: false, modalClosed: false }
  try {
    const opened = await clickSelector(devtools, `[data-e2e="ui-guide-search-open"]`) &&
      await until(`${PALETTE}?.matches(":modal") === true`)
    const palette = await read()
    const modalOpened = await press("default") &&
      await until(`${MODAL}?.matches(":modal") === true`)
    await devtools.evaluate<null>(`(${PALETTE}.close(), null)`)
    const paletteClosed = await until(`${PALETTE}.open === false`)
    // The palette lets go in its `close` handler, a task after `close()`: two frames cover it.
    await devtools.evaluate<null>(
      `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null))))`,
    )
    const underModal = await read()
    await closeModal(MODAL)
    const modalClosed = await until(`${MODAL} === null`)
    order = { opened, modalOpened, paletteClosed, modalClosed, palette, underModal }
    // The Modal releases in its effect cleanup, after the commit that removed it.
    await until(`document.body.style.paddingRight === "1px"`)
    order.after = await read()
  } finally {
    await cleanUp()
  }
  check(
    "a CommandPalette that closes under a Modal it opened over leaves the page locked, and the " +
      "Modal's close gives the page back its own styles",
    order.opened && order.modalOpened && order.paletteClosed && order.modalClosed &&
      order.palette?.html === "hidden" && order.palette.inlinePadding !== "1px" &&
      order.underModal?.html === "hidden" &&
      order.underModal.inlinePadding === order.palette.inlinePadding &&
      order.after?.inlineHtml === original.inlineHtml &&
      order.after.inlineBody === original.inlineBody && order.after.inlinePadding === "1px" &&
      order.after.html !== "hidden",
    `palette opened ${order.opened}, Modal opened over it ${order.modalOpened}, palette closed ` +
      `${order.paletteClosed}, Modal closed ${order.modalClosed}; before: ${show(original)}; ` +
      `palette open: ${show(order.palette)}; palette closed under the Modal: ` +
      `${show(order.underModal)}; Modal closed: ${show(order.after)}`,
  )

  let nested: {
    opened: boolean
    nestedOpened: boolean
    nestedClosed: boolean
    first?: SharedLockReading
    both?: SharedLockReading
    back?: SharedLockReading
    after?: SharedLockReading
  } = { opened: false, nestedOpened: false, nestedClosed: false }
  try {
    const opened = await press("default") && await until(`${MODAL}?.matches(":modal") === true`)
    const first = await read()
    const nestedOpened = await press("uncontrolled") &&
      await until(`${NESTED}?.matches(":modal") === true`)
    const both = await read()
    await closeModal(NESTED)
    const nestedClosed = await until(`${NESTED} === null`)
    // The inner Modal lets go in its effect cleanup, after the commit that removed it: two frames.
    await devtools.evaluate<null>(
      `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null))))`,
    )
    nested = { opened, nestedOpened, nestedClosed, first, both, back: await read() }
    await closeModal(MODAL)
    await until(`${MODAL} === null && document.body.style.paddingRight === ""`)
    nested.after = await read()
  } finally {
    await cleanUp()
  }
  check(
    "a Modal opened over another Modal leaves the page's padding as the first one set it",
    nested.opened && nested.nestedOpened && nested.nestedClosed &&
      nested.first?.html === "hidden" && nested.first.inlinePadding !== "0px" &&
      nested.both?.inlinePadding === nested.first.inlinePadding &&
      nested.back?.html === "hidden" &&
      nested.back.inlinePadding === nested.first.inlinePadding &&
      nested.after?.inlinePadding === "" && nested.after.html !== "hidden",
    `first opened ${nested.opened}, second opened over it ${nested.nestedOpened}, second closed ` +
      `${nested.nestedClosed}; one open: ${show(nested.first)}; both open: ${show(nested.both)}; ` +
      `first alone again: ${show(nested.back)}; both closed: ${show(nested.after)}`,
  )
}

/**
 * A real click on a default Modal's backdrop closes it through its close port.
 *
 * `Modal` defaults `closeOnBackdrop` to `backdropDismissesByDefault`, and a parameter default has no
 * rendered symptom a string-rendering test could read, so `ui/modal.test.tsx` used to search the
 * source for it (#217). This is the behaviour itself: the card's first dialog passes no
 * `closeOnBackdrop`, so only the default decides whether this click closes it.
 *
 * @param devtools The connected session, on a hydrated page with no dialog open.
 */
async function modalBackdropCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    const button = [...document.querySelectorAll("#demo-Modal button")]
      .find((candidate) => candidate.textContent.trim().startsWith("default"))
    button?.click()
    return null
  })()`)
  const dialog = `document.querySelector("#demo-Modal dialog")`
  const opened = await poll(
    () => devtools.evaluate<boolean>(`${dialog}?.matches(":modal") === true`),
    3_000,
  )
  const aim = await backdropAim(devtools, dialog)
  const landing = aim.onTarget ? await clickAt(devtools, aim, dialog) : null
  const closed = await poll(() => devtools.evaluate<boolean>(`${dialog} === null`), 3_000)
  await pointerToCorner(devtools)
  // On failure the dialog is still open over everything after this; its own close button asks the
  // same port Escape does, so the card's parent unmounts it and releases the page's scroll lock.
  if (!closed) {
    await devtools.evaluate<null>(
      `(${dialog}?.querySelector('header button[aria-label="Close"]')?.click(), null)`,
    )
  }

  check(
    "a real click on a Modal's backdrop closes it by default",
    opened && aim.onTarget && landing?.onTarget === true && closed,
    !opened
      ? "the card's default dialog never became modal, so there was no backdrop to click"
      : !aim.onTarget
      ? `the point ${aim.x},${aim.y} left of the dialog reads ${aim.tag}, not the dialog's backdrop`
      : landing?.onTarget !== true
      ? `the press at ${aim.x},${aim.y} landed on ${landing?.tag ?? "nothing"}, not the backdrop`
      : closed
      ? `a real press at ${aim.x},${aim.y}, outside the dialog's box, took the dialog off the page`
      : `the dialog was still on the page 3s after a real press on its backdrop, so the default ` +
        `no longer lets a backdrop click close a Modal`,
  )
}

/** What the fallback check saw on the dialog it opened with `closedBy` hidden. */
interface FallbackReading {
  /** Event types the browser holds listeners for on the dialog, for the failure message only. */
  listeners: string[]
  /** Whether the platform fired `cancel` for the Escape press. */
  cancelled: boolean
  present: boolean
  lock: string
}

/**
 * On a dialog engine that does not know `closedby`, Escape is the platform's, and an uncontrolled
 * Modal still settles closed.
 *
 * Chromium honours `closedby`, so the path `Modal` takes everywhere else — WebKit today — is not
 * reached by any other check here. This makes Chromium stand in for that engine, in the two ways
 * the component and the platform can tell: `closedBy` is taken off `HTMLDialogElement.prototype`
 * before the dialog mounts, so the component's capability test answers "not supported", and the
 * `closedby` attribute is taken off the open dialog, so the platform closes on Escape and fires
 * `cancel` as an engine that ignores the attribute would. The prototype is put back as soon as the
 * dialog is open, and on every way out.
 *
 * Everything asserted is behaviour, and it covers the gate `ui/modal.test.tsx` used to pin by
 * searching the source (#217) from both sides:
 *
 * - the platform must fire `cancel` for the Escape press. A component that ignored the capability
 *   and took the `keydown` path anyway closes the dialog itself, synchronously, before the platform
 *   gets to, so no `cancel` fires and this reads red;
 * - the Escape press must take the uncontrolled dialog off the page and release the scroll lock,
 *   which happens only if the `cancel` handler settles the component's own open flag. Without that,
 *   the platform closes the element and the component keeps rendering it, closed and unopenable.
 *
 * The dialog's listener types are read through DevTools for the failure message only; which
 * listeners the component uses is its own business, and asserting on them would fail a correct
 * dialog that one day adds a `keydown` listener for something else.
 *
 * The trigger is pressed with a real click, because Chromium fires `cancel` for an Escape close
 * request only after a user activation, and a scripted `.click()` is not one.
 *
 * @param devtools The connected session, on a hydrated page with no dialog open.
 */
async function modalFallbackEscapeCheck(devtools: Devtools): Promise<void> {
  const dialog = `document.querySelector('[data-e2e="guide-modal-uncontrolled"]')`
  const trigger = `document.querySelector('#demo-Modal [data-e2e="modal-uncontrolled-open"]')`
  const hidden = await devtools.evaluate<boolean>(`(() => {
    const proto = HTMLDialogElement.prototype
    const descriptor = Object.getOwnPropertyDescriptor(proto, "closedBy")
    if (descriptor === undefined) return false
    globalThis.__verifyClosedBy = descriptor
    delete proto.closedBy
    return !("closedBy" in proto)
  })()`)
  const restore = `(() => {
    const descriptor = globalThis.__verifyClosedBy
    if (descriptor !== undefined) Object.defineProperty(HTMLDialogElement.prototype, "closedBy", descriptor)
    delete globalThis.__verifyClosedBy
    return "closedBy" in HTMLDialogElement.prototype
  })()`
  let opened = false
  let landed = false
  let restored = false
  let reading: FallbackReading = { listeners: [], cancelled: false, present: true, lock: "" }
  try {
    await centreInView(devtools, trigger)
    landed = (await clickAt(devtools, await aimAt(devtools, trigger), trigger))?.onTarget === true
    opened = await poll(
      () => devtools.evaluate<boolean>(`${dialog}?.matches(":modal") === true`),
      3_000,
    )
    restored = await devtools.evaluate<boolean>(restore)
    // Read before this check adds its own `cancel` probe below, which would otherwise be counted.
    const listeners = await dialogListenerTypes(devtools, dialog)
    await devtools.evaluate<null>(`(() => {
      const dialog = ${dialog}
      globalThis.__verifyCancelled = false
      dialog?.removeAttribute("closedby")
      dialog?.addEventListener("cancel", () => globalThis.__verifyCancelled = true, { once: true })
      return null
    })()`)
    await pressKey(devtools, "Escape")
    await poll(() => devtools.evaluate<boolean>(`${dialog} === null`), 3_000)
    await poll(() => devtools.evaluate<boolean>(`document.body.style.overflow === ""`), 3_000)
    reading = {
      ...await devtools.evaluate<Omit<FallbackReading, "listeners">>(`(() => ({
        cancelled: globalThis.__verifyCancelled === true,
        present: ${dialog} !== null,
        lock: document.body.style.overflow === "" ? "released" : document.body.style.overflow,
      }))()`),
      listeners,
    }
  } finally {
    restored = await devtools.evaluate<boolean>(restore).catch(() => false) || restored
    await devtools.evaluate<null>(`(() => {
      delete globalThis.__verifyCancelled
      const dialog = ${dialog}
      if (dialog?.open) dialog.close()
      return null
    })()`).catch(() => null)
    await pointerToCorner(devtools)
  }

  const escapeListeners = reading.listeners.filter((type) =>
    type === "keydown" || type === "cancel"
  )
  check(
    "on an engine without closedby, Modal hands Escape to the platform and an uncontrolled one still leaves the page",
    hidden && restored && landed && opened && reading.cancelled && !reading.present &&
      reading.lock === "released",
    !hidden
      ? "HTMLDialogElement.prototype has no closedBy to take away, so this browser is already the " +
        "engine the check simulates and the premise does not hold"
      : !restored
      ? "closedBy could not be put back on HTMLDialogElement.prototype, so every later check runs " +
        "on a changed platform"
      : !landed || !opened
      ? "a real click on the uncontrolled trigger never opened a modal dialog"
      : !reading.cancelled
      ? `the platform fired no cancel for the Escape press, so nothing here reached the fallback ` +
        `(the dialog's Escape listeners were [${escapeListeners.join(", ")}]; a keydown one ` +
        `closes the dialog itself before the platform can)`
      : reading.present
      ? `the platform closed the dialog but the component kept rendering it: its own open flag ` +
        `was not settled by the cancel handler, and the scroll lock reads "${reading.lock}"`
      : reading.lock !== "released"
      ? `the dialog left the page but the scroll lock still reads "${reading.lock}"`
      : `a real Escape fired the platform's cancel, the element left the page and the scroll ` +
        `lock was released`,
  )
}

/**
 * The event types the browser holds listeners for on one element, read from DevTools.
 *
 * @param devtools The connected session.
 * @param element A page expression for the element.
 * @returns The types, one entry per listener; empty when the element is missing.
 */
async function dialogListenerTypes(devtools: Devtools, element: string): Promise<string[]> {
  const found = await devtools.send<{ result: { objectId?: string } }>("Runtime.evaluate", {
    expression: element,
  })
  const objectId = found.result.objectId
  if (objectId === undefined) return []
  try {
    const { listeners } = await devtools.send<{ listeners: { type: string }[] }>(
      "DOMDebugger.getEventListeners",
      { objectId },
    )
    return listeners.map((listener) => listener.type)
  } finally {
    await devtools.send("Runtime.releaseObject", { objectId }).catch(() => null)
  }
}

/**
 * `ConfirmDialog`'s two refusals, driven for real: a backdrop click does not dismiss it by
 * default, and an Escape press asks its `onCancel` — which, on the card's third panel, says no.
 *
 * Both used to be pinned by searching `ui/confirm-dialog.tsx` for `closeOnBackdrop = false` and
 * `onClose={onCancel}` (#217). A panel left open by either check would sit in the top layer over
 * everything after it, so each one closes its panel through the panel's own buttons on the way
 * out, and these run last of all.
 *
 * @param devtools The connected session, on a hydrated page with no dialog open.
 */
async function confirmDialogChecks(devtools: Devtools): Promise<void> {
  const dialog = `document.querySelector("#demo-ConfirmDialog dialog")`
  const outcome = `(document.querySelector('#demo-ConfirmDialog [data-e2e="controlled-value"]')` +
    `?.textContent ?? "").trim()`
  /** Press the card button, or the open panel's footer button, whose text is `label`. */
  const press = (scope: string, label: string) =>
    devtools.evaluate<boolean>(`(() => {
      const button = [...document.querySelectorAll(${JSON.stringify(scope)})]
        .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)})
      button?.click()
      return button !== undefined
    })()`)
  const open = async (label: string) =>
    await press("#demo-ConfirmDialog button", label) &&
    await poll(() => devtools.evaluate<boolean>(`${dialog}?.matches(":modal") === true`), 3_000)
  const closeWith = async (label: string) => {
    await press("#demo-ConfirmDialog dialog footer button", label)
    return await poll(() => devtools.evaluate<boolean>(`${dialog} === null`), 3_000)
  }

  // A backdrop click on the Archive panel, which passes no `closeOnBackdrop`.
  const archiveOpened = await open("Archive invoice")
  const aim = await backdropAim(devtools, dialog)
  const landing = aim.onTarget ? await clickAt(devtools, aim, dialog) : null
  const stayed = await holdsFor(
    () => devtools.evaluate<boolean>(`${dialog}?.matches(":modal") === true`),
    1_000,
  )
  await pointerToCorner(devtools)
  const archiveClosed = await closeWith("Cancel")
  check(
    "a real click on a ConfirmDialog's backdrop leaves it open by default",
    archiveOpened && aim.onTarget && landing?.onTarget === true && stayed.held && archiveClosed,
    !archiveOpened
      ? "the Archive invoice panel never became modal"
      : !aim.onTarget || landing?.onTarget !== true
      ? `the press at ${aim.x},${aim.y} did not land on the panel's backdrop (${aim.tag})`
      : !stayed.held
      ? `a real click on the backdrop closed the panel ${stayed.elapsedMs}ms later: a confirmation ` +
        `must not be dismissed by a stray click beside it`
      : !archiveClosed
      ? "the panel stayed open through a backdrop click, but its own Cancel button then failed to " +
        "close it"
      : `a real press at ${aim.x},${aim.y} on the backdrop; the panel was still modal 1s later, ` +
        `and its Cancel button closed it`,
  )

  // Escape on the panel whose `onCancel` returns false.
  const before = await devtools.evaluate<string>(outcome)
  const leaveOpened = await open("Leave page")
  await pressKey(devtools, "Escape")
  const asked = await poll(
    () => devtools.evaluate<boolean>(`${outcome}.includes("cancel refused")`),
    3_000,
  )
  const held = await holdsFor(
    () => devtools.evaluate<boolean>(`${dialog}?.matches(":modal") === true`),
    1_000,
  )
  const after = await devtools.evaluate<string>(outcome)
  const leaveClosed = await closeWith("Discard")
  if (!leaveClosed) await devtools.evaluate<null>(`(${dialog}?.close(), null)`)
  check(
    "a real Escape on a ConfirmDialog asks its onCancel, and a refusal keeps the panel open",
    leaveOpened && !before.includes("cancel refused") && asked && held.held && leaveClosed,
    !leaveOpened
      ? "the Leave page panel never became modal"
      : before.includes("cancel refused")
      ? `the card already read "${before}" before Escape, so a reading after it proves nothing`
      : !asked
      ? `Escape never reached onCancel: the card reads "${after}"` +
        (held.held ? "" : ", and the panel closed without asking it")
      : !held.held
      ? `onCancel refused, but the panel closed ${held.elapsedMs}ms after Escape regardless`
      : !leaveClosed
      ? "the panel held through Escape, but its Discard button then failed to close it"
      : `Escape → onCancel ran ("${after}") and returned false → the panel was still modal 1s ` +
        `later, and Discard closed it`,
  )
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

/** What the busy delete panel of the `ConfirmDialog` card shows. */
interface ConfirmBusyState {
  /** The panel is open and modal. */
  modal: boolean
  /** `aria-busy` on the confirm button. */
  busy: string | null
  /** The confirm button's visible text. */
  confirmText: string
  /** The confirm button holds the spinner. */
  spinner: boolean
  /** The cancel button is disabled. */
  cancelDisabled: boolean
}

/**
 * A `ConfirmDialog` with `busy` shows it on the confirm button and refuses to be cancelled while the
 * work runs. The card's Delete panel turns busy when confirmed and closes itself two seconds later:
 * pressing Delete must show the spinner, `aria-busy` and "Deleting…" on the confirm button and
 * disable "Keep it", and a real Escape during that time must leave the panel open.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function confirmDialogBusyChecks(devtools: Devtools): Promise<void> {
  const dialog = `document.querySelector("#demo-ConfirmDialog dialog")`
  const state = `(() => {
    const dialog = ${dialog}
    const confirm = dialog?.querySelector('[data-e2e="confirm-dialog-confirm"]')
    const cancel = dialog?.querySelector('[data-e2e="confirm-dialog-cancel"]')
    return {
      modal: dialog?.matches(":modal") === true,
      busy: confirm?.getAttribute("aria-busy") ?? null,
      confirmText: confirm?.textContent.trim() ?? "",
      spinner: confirm?.querySelector("svg.animate-spin") != null,
      cancelDisabled: cancel?.disabled === true,
    }
  })()`

  const opened = await devtools.evaluate<boolean>(`(() => {
    const open = [...document.querySelectorAll("#demo-ConfirmDialog button")]
      .find((button) => button.textContent.trim() === "Delete invoice")
    open?.click()
    return open !== undefined
  })()`) &&
    await poll(() => devtools.evaluate<boolean>(`${dialog}?.matches(":modal") === true`), 3_000)
  await devtools.evaluate<null>(
    `(${dialog}?.querySelector('[data-e2e="confirm-dialog-confirm"]')?.click(), null)`,
  )
  const busy = opened &&
    await poll(() => devtools.evaluate<boolean>(`${state}.busy === "true"`), 2_000)
  const during = await devtools.evaluate<ConfirmBusyState>(state)
  check(
    "a busy ConfirmDialog shows a spinner, aria-busy and its busy label on confirm, and " +
      "disables cancel",
    busy && during.spinner && during.confirmText === "Deleting…" && during.cancelDisabled,
    !opened ? "the Delete invoice panel never became modal" : JSON.stringify(during),
  )

  await pressKey(devtools, "Escape")
  const held = await holdsFor(
    () => devtools.evaluate<boolean>(`${state}.modal && ${state}.busy === "true"`),
    600,
  )
  check(
    "a real Escape on a busy ConfirmDialog leaves it open",
    busy && held.held,
    !busy
      ? "the panel never turned busy, so Escape proves nothing"
      : `the panel ${held.held ? "stayed open" : `closed or went idle after ${held.elapsedMs}ms`}`,
  )

  // The demo closes the panel itself once its two-second "request" ends; wait for that, so the
  // next check starts with no dialog in the top layer.
  const closed = await poll(() => devtools.evaluate<boolean>(`${dialog} === null`), 5_000)
  if (!closed) await devtools.evaluate<null>(`(${dialog}?.close(), null)`)
}

/** What the Safari-like busy check saw after its Escape press. */
interface BusyFallbackReading {
  /** The platform fired `cancel` for the Escape press. */
  cancelled: boolean
  /** The platform closed the dialog: its `close` event fired. */
  closedOnce: boolean
  /** The dialog was modal and still busy after the press. */
  back: boolean
}

/**
 * On a browser that ignores `closedby`, as shipping Safari does, a real Escape on a busy
 * `ConfirmDialog` is closed by the platform before anything can refuse it, and `Modal` must show it
 * again: the panel ends up open, modal and busy. Once the demo's two-second request ends and it
 * unmounts the panel, the scroll lock must be released.
 *
 * Chromium stands in for that engine as in `modalFallbackEscapeCheck`: `closedBy` is taken off
 * `HTMLDialogElement.prototype` before the panel mounts and put back once it is open, and the
 * `closedby` attribute is stripped from the open panel. The trigger and confirm are pressed with real
 * clicks, because Chromium fires `cancel` for Escape only after a user activation.
 *
 * @param devtools The connected session, on a hydrated page with no dialog open.
 */
async function confirmDialogBusyFallbackCheck(devtools: Devtools): Promise<void> {
  const dialog = `document.querySelector("#demo-ConfirmDialog dialog")`
  const trigger = `[...document.querySelectorAll("#demo-ConfirmDialog button")]
    .find((button) => button.textContent.trim() === "Delete invoice")`
  const confirm = `${dialog}?.querySelector('[data-e2e="confirm-dialog-confirm"]')`
  const busyModal = `(${dialog}?.matches(":modal") === true &&
    ${confirm}?.getAttribute("aria-busy") === "true")`
  const hidden = await devtools.evaluate<boolean>(`(() => {
    const proto = HTMLDialogElement.prototype
    const descriptor = Object.getOwnPropertyDescriptor(proto, "closedBy")
    if (descriptor === undefined) return false
    globalThis.__verifyClosedBy = descriptor
    delete proto.closedBy
    return !("closedBy" in proto)
  })()`)
  const restore = `(() => {
    const descriptor = globalThis.__verifyClosedBy
    if (descriptor !== undefined) Object.defineProperty(HTMLDialogElement.prototype, "closedBy", descriptor)
    delete globalThis.__verifyClosedBy
    return "closedBy" in HTMLDialogElement.prototype
  })()`
  let opened = false
  let busy = false
  let restored = false
  let reading: BusyFallbackReading = { cancelled: false, closedOnce: false, back: false }
  let lock = ""
  try {
    await centreInView(devtools, trigger)
    await clickAt(devtools, await aimAt(devtools, trigger), trigger)
    opened = await poll(
      () => devtools.evaluate<boolean>(`${dialog}?.matches(":modal") === true`),
      3_000,
    )
    restored = await devtools.evaluate<boolean>(restore)
    await devtools.evaluate<null>(`(() => {
      const dialog = ${dialog}
      globalThis.__verifyCancelled = false
      globalThis.__verifyClosed = false
      dialog?.removeAttribute("closedby")
      dialog?.addEventListener("cancel", () => globalThis.__verifyCancelled = true, { once: true })
      dialog?.addEventListener("close", () => globalThis.__verifyClosed = true, { once: true })
      return null
    })()`)
    if (opened) await clickAt(devtools, await aimAt(devtools, confirm), confirm)
    busy = opened && await poll(() => devtools.evaluate<boolean>(busyModal), 1_000)
    if (busy) {
      await pressKey(devtools, "Escape")
      await poll(() => devtools.evaluate<boolean>(`globalThis.__verifyClosed === true`), 1_000)
      await poll(() => devtools.evaluate<boolean>(busyModal), 500)
      reading = await devtools.evaluate<BusyFallbackReading>(`({
        cancelled: globalThis.__verifyCancelled === true,
        closedOnce: globalThis.__verifyClosed === true,
        back: ${busyModal},
      })`)
    }
    // The demo unmounts the panel when its two-second request ends.
    await poll(() => devtools.evaluate<boolean>(`${dialog} === null`), 5_000)
    await poll(() => devtools.evaluate<boolean>(`document.body.style.overflow === ""`), 2_000)
    lock = await devtools.evaluate<string>(
      `${dialog} !== null ? "still rendered" : document.body.style.overflow === "" && ` +
        `document.documentElement.style.overflow === "" ? "released" : "held"`,
    )
  } finally {
    restored = await devtools.evaluate<boolean>(restore).catch(() => false) || restored
    await devtools.evaluate<null>(`(() => {
      delete globalThis.__verifyCancelled
      delete globalThis.__verifyClosed
      const dialog = ${dialog}
      if (dialog?.open) dialog.close()
      return null
    })()`).catch(() => null)
    await pointerToCorner(devtools)
  }

  check(
    "on an engine without closedby, a real Escape on a busy ConfirmDialog is undone: it stays open " +
      "and modal, and the scroll lock is released once it unmounts",
    hidden && restored && opened && busy && reading.cancelled && reading.closedOnce &&
      reading.back && lock === "released",
    !hidden
      ? "HTMLDialogElement.prototype has no closedBy to take away, so the premise does not hold"
      : !restored
      ? "closedBy could not be put back on HTMLDialogElement.prototype"
      : !opened || !busy
      ? `real clicks never left a busy modal panel (opened ${opened}, busy ${busy})`
      : !reading.cancelled || !reading.closedOnce
      ? `the platform did not close the panel on Escape (cancel ${reading.cancelled}, close ` +
        `${reading.closedOnce}), so nothing here reached the fallback`
      : !reading.back
      ? "the platform closed the busy panel and it was not shown again"
      : lock !== "released"
      ? `after the panel's request ended the scroll lock reads "${lock}"`
      : "the platform closed the busy panel on Escape, Modal showed it again, modal and busy, and " +
        "the scroll lock was released when it unmounted",
  )
}
