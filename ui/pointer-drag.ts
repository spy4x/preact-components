/**
 * The drag mechanism `SortableList` and `KanbanBoard` share: a press that becomes a drag with
 * pointer events (mouse, pen and touch alike), the edge scrolling while it lasts, and focus kept on
 * the dragged item's control after the drop.
 *
 * Not exported from the package: each component owns what a drag means for its own layout, and
 * this module owns only the steps they have in common.
 */

import { useEffect, useRef } from "preact/hooks"

/**
 * How far to scroll in one animation frame while a held item is dragged near an edge.
 *
 * Inside `edge` pixels of the top or bottom of the scrolling area the speed grows towards `max`
 * the closer the pointer gets; elsewhere it is 0. The same rule serves the left and right edges.
 *
 * @param y The pointer's vertical position, in viewport pixels.
 * @param top The scrolling area's visible top edge, in viewport pixels.
 * @param bottom Its visible bottom edge.
 * @param edge Depth of the zone that scrolls. Shrinks to a quarter of a short area.
 * @param max The largest step, in pixels per frame.
 * @returns A negative step to scroll up, a positive one to scroll down, or 0.
 */
export function edgeScrollStep(
  y: number,
  top: number,
  bottom: number,
  edge = 48,
  max = 16,
): number {
  const zone = Math.min(edge, (bottom - top) / 4)
  if (zone <= 0) return 0
  const depth = (into: number) => Math.ceil(max * Math.min(into, zone) / zone)
  if (y < top + zone) return -depth(top + zone - y)
  if (y > bottom - zone) return depth(y - (bottom - zone))
  return 0
}

/** The nearest ancestor that scrolls vertically, or `null` when only the page does. */
export function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) return null
    const overflow = getComputedStyle(node).overflowY
    if (/(auto|scroll|overlay)/.test(overflow) && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

/**
 * Scroll the nearest vertical scrolling area of `element`, or the page, one step towards the edge
 * the pointer at viewport height `y` is near.
 *
 * @returns Whether anything scrolled.
 */
export function scrollPageNearEdge(element: HTMLElement, y: number): boolean {
  const parent = scrollParent(element)
  const area = parent?.getBoundingClientRect()
  const step = edgeScrollStep(
    y,
    Math.max(area?.top ?? 0, 0),
    Math.min(area?.bottom ?? globalThis.innerHeight, globalThis.innerHeight),
  )
  if (step === 0) return false // Instant: a page with smooth scrolling would otherwise restart a smooth scroll every frame.
  ;(parent ?? globalThis).scrollBy({ top: step, behavior: "instant" })
  return true
}

/** What a component does at each step of a pointer drag. */
export interface PointerDragSteps {
  /**
   * The press became a drag. Return `false` to refuse it, which ends the press quietly.
   *
   * @param id The item the press began on.
   * @param x Where the press began, in viewport pixels.
   * @param y Where the press began, in viewport pixels.
   */
  start: (id: string, x: number, y: number) => boolean
  /** The pointer moved during a drag, to viewport (`x`, `y`). */
  move: (x: number, y: number) => void
  /** The pointer was released during a drag. */
  drop: (id: string) => void
  /** The browser cancelled the pointer, or Escape was pressed, during a drag. */
  cancel: (id: string) => void
  /** Once per animation frame during a drag, with the pointer's latest position: edge scrolling. */
  frame: (x: number, y: number) => void
}

/** The handlers {@link usePointerDrag} hands a component. */
export interface PointerDrag {
  /** Goes on the draggable element's `onPointerDown`, with the item's id. */
  onPointerDown: (event: PointerEvent, id: string) => void
  /** Whether a press, dragging or not yet, is under way. */
  pressing: () => boolean
  /** Ends any press at once and calls no step. */
  end: () => void
}

/** A press that has not become a drag yet, or the drag it became. */
interface Press {
  id: string
  pointerId: number
  x: number
  y: number
  lastX: number
  lastY: number
  dragging: boolean
  /** Ends the window listeners, the hold timer and the frame loop. */
  stop: AbortController
}

/** How far a mouse or pen moves before the press becomes a drag. */
const DRAG_THRESHOLD = 4
/** How far a finger may wander during a touch hold before the press counts as a scroll instead. */
const HOLD_TOLERANCE = 8

/**
 * A press on an item that becomes a drag, by mouse, pen or touch, with no drag library.
 *
 * A mouse or pen press becomes a drag once it moves a few pixels. A touch press does too when
 * `touchHold` is 0, which suits an element with `touch-action: none` such as a drag handle. With
 * a `touchHold` in milliseconds, a finger must rest that long first, and moving sooner is left to
 * the browser as a scroll: that suits a whole card the page must still scroll over. Then give
 * `area` too, an element around every draggable one: once the drag starts, its `touchmove` events
 * are cancelled so the page does not scroll under the drag. That listener is added by hand,
 * not as an `onTouchMove` prop: it must not be passive, and Preact names a touch event wrongly on a
 * browser that had no touch screen when the page loaded.
 *
 * Release drops, and Escape or a pointer the browser cancels puts back. The click a release fires
 * after a drag is swallowed, so a drag never also opens what it dragged. Unmounting mid-drag
 * leaves no listener, timer or frame loop behind.
 *
 * @param steps What the component does at each step; the latest render's are used.
 * @param touch How long a finger rests before a touch press becomes a drag (`hold`, 0 for none),
 *   and the element whose touch scrolling a drag stops (`area`).
 */
export function usePointerDrag(
  steps: PointerDragSteps,
  touch: { hold: number; area: { current: HTMLElement | null } } | undefined = undefined,
): PointerDrag {
  const touchHold = touch?.hold ?? 0
  const latest = useRef(steps)
  latest.current = steps
  const press = useRef<Press | null>(null)

  const end = () => {
    press.current?.stop.abort()
    press.current = null
  }
  useEffect(() => end, [])

  const area = touch?.area
  useEffect(() => {
    const element = area?.current
    if (element === null || element === undefined) return
    const still = (event: TouchEvent) => {
      if (press.current?.dragging === true && event.cancelable) event.preventDefault()
    }
    element.addEventListener("touchmove", still, { passive: false })
    return () => element.removeEventListener("touchmove", still)
  }, [area])

  const begin = (current: Press) => {
    if (!latest.current.start(current.id, current.x, current.y)) return end()
    current.dragging = true
    const frame = () => {
      if (current.stop.signal.aborted) return
      latest.current.frame(current.lastX, current.lastY)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    latest.current.move(current.lastX, current.lastY)
  }

  /**
   * End a drag through `step`. After a release, the next pointer click is swallowed, so the drag
   * does not also open or press what it dragged. It is the next click unless a press comes first:
   * a touch release often fires no click at all. A click with no pointer behind it (`detail` 0,
   * from a screen reader or a key) is never swallowed.
   */
  const finish = (step: "drop" | "cancel", released: boolean) => {
    const current = press.current
    end()
    if (current === null || !current.dragging) return
    if (released) {
      const swallow = new AbortController()
      globalThis.addEventListener("click", (event) => {
        if (event.detail === 0) return
        event.preventDefault()
        event.stopPropagation()
        swallow.abort()
      }, { capture: true, signal: swallow.signal })
      globalThis.addEventListener("pointerdown", () => swallow.abort(), {
        capture: true,
        signal: swallow.signal,
      })
    }
    latest.current[step](current.id)
  }

  const onPointerDown = (event: PointerEvent, id: string) => {
    if (!event.isPrimary || event.button !== 0) return
    end()
    const stop = new AbortController()
    const current: Press = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
      stop,
    }
    press.current = current
    const hold = event.pointerType === "touch" ? touchHold : 0
    if (hold > 0) {
      const timer = setTimeout(() => {
        if (press.current === current) begin(current)
      }, hold)
      stop.signal.addEventListener("abort", () => clearTimeout(timer))
    }
    const options = { signal: stop.signal }
    const mine = (e: PointerEvent) => press.current === current && e.pointerId === current.pointerId
    globalThis.addEventListener("pointermove", (e: PointerEvent) => {
      if (!mine(e)) return
      current.lastX = e.clientX
      current.lastY = e.clientY
      if (current.dragging) return latest.current.move(e.clientX, e.clientY)
      const distance = Math.hypot(e.clientX - current.x, e.clientY - current.y)
      if (hold > 0) {
        // Moving before the hold is up is a scroll: the browser keeps it.
        if (distance > HOLD_TOLERANCE) end()
        return
      }
      if (distance >= DRAG_THRESHOLD) begin(current)
    }, options)
    globalThis.addEventListener("pointerup", (e: PointerEvent) => {
      if (mine(e)) finish("drop", true)
    }, options)
    globalThis.addEventListener("pointercancel", (e: PointerEvent) => {
      if (mine(e)) finish("cancel", false)
    }, options)
    globalThis.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Escape" || press.current !== current || !current.dragging) return
      // Escape stays with the drag, so a dialog around it does not close too.
      e.preventDefault()
      e.stopPropagation()
      finish("cancel", false)
    }, { signal: stop.signal, capture: true })
  }

  return {
    onPointerDown,
    pressing: () => press.current !== null,
    end,
  }
}

/** What {@link useKeptFocus} hands a component. */
export interface KeptFocus {
  /** Keep focus on this item's control across the next renders, until focus goes elsewhere. */
  keep: (id: string) => void
  /** Stop keeping focus on any item. */
  forget: () => void
  /** Whether focus is being kept on this item. */
  isKept: (id: string) => boolean
  /**
   * Call from a layout effect after every render: when the kept item's control lost focus to the
   * page itself (its element was replaced or moved), focus it again. Focus the reader put on
   * anything else wins, and the item is forgotten.
   */
  restore: () => void
  /**
   * Call from the control's `onBlur`. A task later, once the board or list has re-rendered, decides
   * whether focus really left: if so, the item is forgotten and `left` runs.
   *
   * Decided a task later, not in the event: the caller's re-render after a drop can move the
   * control to a new element, and Chromium fires `blur` on the old one as it leaves the document;
   * by the next task {@link KeptFocus.restore} has focused the new one, so that blur is ignored.
   *
   * @param id The item whose control blurred.
   * @param left Runs when focus did leave the item, such as putting back an item held by keyboard.
   */
  blurred: (id: string, left: () => void) => void
}

/**
 * Focus kept on a moved item's control, by drop, cancel or keyboard move, while the caller's
 * re-render replaces or moves the element.
 *
 * @param control The focusable control of an item, or `null` when it is not rendered.
 */
export function useKeptFocus(control: (id: string) => HTMLElement | null): KeptFocus {
  const kept = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  return {
    keep: (id) => {
      kept.current = id
    },
    forget: () => {
      kept.current = null
    },
    isKept: (id) => kept.current === id,
    restore: () => {
      const id = kept.current
      if (id === null) return
      const element = control(id)
      const active = document.activeElement
      if (element === null || active === element) return
      if (active !== null && active !== document.body) {
        kept.current = null
        return
      }
      element.focus()
    },
    blurred: (id, left) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        if (document.activeElement === control(id)) return
        if (kept.current === id) kept.current = null
        left()
      }, 0)
    },
  }
}
