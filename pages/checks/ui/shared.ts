import { type Devtools } from "../harness.ts"

/** `IconCheck`'s path, which {@link CopyButton} swaps in for its own glyph while `copied` is true. */
export const COPY_BUTTON_CHECKMARK = "m4.5 12.75 6 6 9-13.5"

/** How long a condition went on holding in the page, and whether it reached the end of a window. */
export interface Hold {
  held: boolean
  elapsedMs: number
  /** `true` when the page stopped answering, which is the harness failing rather than the page. */
  unreadable?: boolean
}

/** A point to move the pointer to, with the reading that says what is there. */
export interface Point {
  x: number
  y: number
  inViewport: boolean
  insideRegion: boolean
  tag: string
}

/** One element's box in the viewport, in whole pixels. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** A rounded box, in viewport pixels. */
export interface Box {
  top: number
  right: number
  bottom: number
  left: number
}

/** The width of a small phone, where a long action label has the least room. */
export const NARROW_WIDTH = 375

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
export async function holdsFor(read: () => Promise<boolean>, windowMs: number): Promise<Hold> {
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

/** Where a dispatched pointer move landed, as the page saw the browser deliver it. */
export interface Landing {
  /** `true` when the browser delivered the move to the element aimed at, or to something inside it. */
  onTarget: boolean
  tag: string
  x: number
  y: number
}

/** A point derived from an element's own box, with the reading that says what is at it. */
export interface Aim {
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

/**
 * Derive the centre of an element, and read back what sits at that point.
 *
 * The reading is the half that makes the point worth using: a coordinate on its own is a guess,
 * and `elementFromPoint` is the browser's own answer to what a press there would hit.
 *
 * @param devtools The connected session.
 * @param element A page expression for the element to aim at, or `null`.
 */
export async function aimAt(devtools: Devtools, element: string): Promise<Aim> {
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
export async function movePointer(
  devtools: Devtools,
  aim: Aim,
  target: string,
): Promise<Landing | null> {
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
 * Press and release the left button at a derived point, and report where the press landed.
 *
 * @param devtools The connected session.
 * @param aim The point, from {@link aimAt}.
 * @param target A page expression for the element the press was aimed at.
 * @returns What the page saw, or `null` when the press never reached it.
 */
export async function clickAt(
  devtools: Devtools,
  aim: Aim,
  target: string,
): Promise<Landing | null> {
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
 * Take focus off whatever holds it, so a later block's key press cannot be answered by this one's
 * control.
 *
 * @param devtools The connected session.
 */
export async function blurActive(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    return null
  })()`)
}

/**
 * Reads {@link InlineEditState} off one `InlineEdit` demo of the `InlineEdit` card.
 *
 * @param which The demo's `data-e2e` marker: `inline-edit-ok` or `inline-edit-fail`.
 */
export function inlineEditState(which: string): string {
  return `(() => {
    const root = document.querySelector('#demo-InlineEdit [data-e2e="${which}"]')
    const field = root.querySelector("input")
    const trigger = root.querySelector("button")
    const active = document.activeElement
    return {
      editing: field !== null,
      text: field !== null ? field.value : trigger.textContent.trim(),
      allSelected: field !== null && field.selectionStart === 0 &&
        field.selectionEnd === field.value.length && field.value.length > 0,
      busy: field?.getAttribute("aria-busy") ?? null,
      readOnly: field?.readOnly ?? false,
      alert: root.querySelector('[role="alert"]')?.textContent.trim() ?? "",
      onTrigger: trigger !== null && active === trigger,
      onField: field !== null && active === field,
      saved: document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-saved"]').textContent.trim(),
    }
  })()`
}

/** A danger colour no palette uses, which every error message must follow once an app sets it. */
export const REPAINTED_DANGER = "rgb(0, 128, 0)"

/** A key press with modifiers held, for {@link pressChord}. */
export interface Chord {
  key: string
  code: string
  keyCode: number
  /** The character the press types; a press with Control or Command held types none. */
  text?: string
  /** `Input.dispatchKeyEvent`'s bit field: Alt 1, Control 2, Meta 4, Shift 8. */
  modifiers: number
}

/**
 * Press a key with modifiers through the browser's own input pipeline. `pressKey` in `harness.ts`
 * sends no modifiers, and a hotkey check is about exactly those.
 */
export async function pressChord(devtools: Devtools, chord: Chord): Promise<void> {
  const fields = {
    key: chord.key,
    code: chord.code,
    windowsVirtualKeyCode: chord.keyCode,
    nativeVirtualKeyCode: chord.keyCode,
    modifiers: chord.modifiers,
  }
  await devtools.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    ...fields,
    ...(chord.text === undefined ? {} : { text: chord.text }),
  })
  await devtools.send("Input.dispatchKeyEvent", { type: "keyUp", ...fields })
}

/** Reads {@link ShortcutsState} off the `ShortcutsDialog` card in one round trip. */
export const SHORTCUTS_STATE = `(() => {
  const card = document.querySelector("#demo-ShortcutsDialog")
  const dialog = card.querySelector("dialog")
  const active = document.activeElement
  return {
    modal: dialog?.matches(":modal") === true,
    plain: Number(card.querySelector('[data-e2e="shortcuts-plain"]').textContent),
    combo: Number(card.querySelector('[data-e2e="shortcuts-combo"]').textContent),
    enter: Number(card.querySelector('[data-e2e="shortcuts-enter"]').textContent),
    escape: Number(card.querySelector('[data-e2e="shortcuts-escape"]').textContent),
    field: card.querySelector('[data-e2e="shortcuts-field"]').value,
    active: active?.getAttribute("data-e2e") ?? active?.tagName ?? "none",
    focusInDialog: dialog !== null && dialog.contains(active),
  }
})()`

/** A real left click at the centre of the element `selector` names, as it sits now. */
export async function clickSelector(devtools: Devtools, selector: string): Promise<boolean> {
  const point = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const box = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect()
    return box && box.width > 0 ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null
  })()`)
  if (point === null) return false
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      ...point,
      button: "left",
      clickCount: 1,
    })
  }
  return true
}
