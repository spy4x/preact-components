/**
 * A vertical list whose items move by dragging a handle, on touch screens and with a mouse, and by
 * keyboard.
 *
 * The list is controlled: it renders `items` in the order the caller gives, reports a finished move
 * through the one `onMove(from, to)` port, and never reorders the caller's data.
 *
 * Pointer events cover mouse, pen and touch, so no drag library is involved. A drag starts only on
 * an item's handle, the one element with `touch-action: none`, so a finger anywhere else on the
 * list still scrolls the page. While an item is held, the other rows slide out of its way with CSS
 * transforms and nothing in the DOM moves until the drop; near the edge of the scrolling area the
 * area scrolls. The keyboard path is the handle: Space or Enter picks the item up, the arrow keys
 * move it, Space or Enter drops it and Escape puts it back. A polite live region says what happened
 * at every step.
 */

import { cn } from "@spy4x/preact-cn"
import { IconBars3 } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "preact/hooks"

/** The one field the list reads off an item. The caller's items may carry anything else. */
export interface SortableItem {
  /** Stable identity, unique in the list. */
  id: string
}

/** Where an item is, as the announcements describe it. */
export interface SortablePlace {
  /** The item's name, from {@link SortableListProps.itemLabel}. */
  item: string
  /** 1-based position in the list. */
  position: number
  /** How many items the list holds. */
  total: number
}

/** Every string the list shows to assistive technology. Each has an English default. */
export interface SortableListLabels {
  /** Accessible name of an item's handle. Defaults to `Reorder <item>`. */
  handle: (item: string) => string
  /** The keyboard instructions every handle is described by. */
  instructions: string
  /** Announced when an item is picked up, by keyboard or by a drag. */
  pickedUp: (place: SortablePlace) => string
  /** Announced each time a held item reaches a new position. */
  moved: (place: SortablePlace) => string
  /** Announced when a held item is dropped. */
  dropped: (place: SortablePlace) => string
  /** Announced when Escape, a cancelled touch or focus leaving the handle puts an item back. */
  cancelled: (place: SortablePlace) => string
}

/** The English defaults of {@link SortableListLabels}. */
export const defaultSortableListLabels: SortableListLabels = {
  handle: (item) => `Reorder ${item}`,
  instructions:
    "Press Space or Enter to pick the item up. Use the arrow keys to move it, Space or Enter to drop it, and Escape to cancel.",
  pickedUp: (at) => `Picked up ${at.item}, position ${at.position} of ${at.total}.`,
  moved: (at) => `Moved ${at.item} to position ${at.position} of ${at.total}.`,
  dropped: (at) => `Dropped ${at.item} at position ${at.position} of ${at.total}.`,
  cancelled: (at) => `Cancelled. ${at.item} is back at position ${at.position} of ${at.total}.`,
}

export interface SortableListProps<Item extends SortableItem> {
  /** The items, in the order they are shown. */
  items: readonly Item[]
  /** An item's body, drawn beside its handle. It may hold its own buttons and links. */
  renderItem: (item: Item) => ComponentChildren
  /**
   * An item's name for its handle and the announcements, such as its title. Required: only the
   * caller knows what an item is called.
   */
  itemLabel: (item: Item) => string
  /**
   * Called once per finished move that changes the order. `from` is the item's index before the
   * move and `to` its index after it, so `items.splice(to, 0, ...items.splice(from, 1))` applies
   * it. The list shows the caller's order again right after the drop.
   */
  onMove: (from: number, to: number) => void
  /** Overrides for any of {@link defaultSortableListLabels}. */
  labels?: Partial<SortableListLabels>
  /** Extra utilities for the root element. */
  class?: string
}

/** One row's place inside the list, measured when an item is picked up. */
export interface SortableBox {
  /** Distance from the list's top edge to the row's top edge, in pixels. */
  top: number
  /** The row's height, in pixels. */
  height: number
}

/**
 * The index a held item would drop at, from where its middle is now.
 *
 * Counts the other rows whose middle is above the held item's middle. Pure and exported so the
 * drop rule is testable without a browser.
 *
 * @param boxes Every row's box as measured at pick-up, in list order.
 * @param from The held item's index.
 * @param center The held item's middle now, in the same coordinates as `boxes`.
 * @returns The index the item takes once dropped.
 */
export function sortableTarget(
  boxes: readonly SortableBox[],
  from: number,
  center: number,
): number {
  let to = 0
  boxes.forEach((box, index) => {
    if (index !== from && box.top + box.height / 2 < center) to++
  })
  return to
}

/**
 * How far each row is shifted while the item at `from` is shown at `to`.
 *
 * The rows between the two places slide by the held row's height plus the gap between rows, and
 * the held row lands where its new neighbours leave room. Pure and exported so the layout rule is
 * testable without a browser.
 *
 * @param boxes Every row's box as measured at pick-up, in list order.
 * @param from The held item's index.
 * @param to Where it is shown now.
 * @returns One vertical offset in pixels per row, in list order.
 */
export function sortableOffsets(
  boxes: readonly SortableBox[],
  from: number,
  to: number,
): number[] {
  const offsets = boxes.map(() => 0)
  const held = boxes[from]
  if (held === undefined || to === from || boxes[to] === undefined) return offsets
  const gap = boxes.length > 1 ? boxes[1].top - (boxes[0].top + boxes[0].height) : 0
  const step = held.height + gap
  if (to > from) {
    for (let index = from + 1; index <= to; index++) offsets[index] = -step
    offsets[from] = boxes[to].top + boxes[to].height - (held.top + held.height)
  } else {
    for (let index = to; index < from; index++) offsets[index] = step
    offsets[from] = boxes[to].top - held.top
  }
  return offsets
}

/**
 * How far to scroll in one animation frame while a held item is dragged near an edge.
 *
 * Inside `edge` pixels of the top or bottom of the scrolling area the speed grows towards `max`
 * the closer the pointer gets; elsewhere it is 0.
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

/** An item held by keyboard (`pointer` is `null`) or by a drag. */
interface Held {
  id: string
  from: number
  to: number
  boxes: SortableBox[]
  /** The items' ids at pick-up, joined: a different order or membership invalidates the indexes. */
  order: string
  /** For a drag, how far the held row follows the pointer from where it was; `null` by keyboard. */
  pointer: number | null
}

/** A press on a handle that has not moved far enough to be a drag yet, or the drag it became. */
interface Press {
  id: string
  pointerId: number
  x: number
  y: number
  /** The pointer's latest vertical position, in viewport pixels. */
  lastY: number
  /** The pointer's position inside the list when the drag started; `null` before that. */
  startInList: number | null
  /** Ends the window listeners and the edge-scroll loop. */
  stop: AbortController
}

/** How far a pointer moves on a handle before the press becomes a drag. */
const DRAG_THRESHOLD = 4

const listClass = "flex flex-col gap-2"
const rowClass =
  "relative flex items-center gap-2 rounded-md border border-subtle bg-surface p-1 pr-3 text-sm text-foreground"
const rowSlideClass = "transition-transform duration-150 motion-reduce:transition-none"
const rowHeldClass = "z-10 shadow-popover ring-2 ring-(--color-selected-text)"
const handleClass =
  "inline-flex size-11 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
const bodyClass = "min-w-0 flex-1"

/** The items' ids in order, as one string to compare. */
function orderOf(items: readonly SortableItem[]): string {
  return items.map((item) => item.id).join("\n")
}

/** The nearest ancestor that scrolls vertically, or `null` when only the page does. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) return null
    const overflow = getComputedStyle(node).overflowY
    if (/(auto|scroll|overlay)/.test(overflow) && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

/**
 * A list whose items are reordered by dragging a handle, by touch or mouse, or from the keyboard.
 *
 * The module doc says how each path works.
 *
 * Markup: a `<ul>` of rows, each a handle `<button>` named by `labels.handle` and described by the
 * instructions, then the caller's `renderItem` body. A held item is shown at its new place before
 * any `onMove`; once dropped, the list shows the caller's `items` again and keeps focus on the
 * dropped item's handle.
 */
export function SortableList<Item extends SortableItem>(
  { items, renderItem, itemLabel, onMove, labels, class: className }: SortableListProps<Item>,
): JSX.Element {
  const text: SortableListLabels = { ...defaultSortableListLabels, ...labels }
  const instructionsId = `sortable-${useId()}-instructions`
  const listRef = useRef<HTMLUListElement>(null)
  const [held, setHeldState] = useState<Held | null>(null)
  const [announcement, setAnnouncement] = useState("")
  /** The latest held item, for window listeners and timers that outlive a render. */
  const heldRef = useRef<Held | null>(null)
  const press = useRef<Press | null>(null)
  /** The handle to keep focused after a keyboard drop, until focus goes somewhere else. */
  const pendingFocus = useRef<string | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** The latest render's props, for listeners that outlive the render that added them. */
  const latest = useRef({ items, itemLabel, onMove, text })
  latest.current = { items, itemLabel, onMove, text }

  const setHeld = (next: Held | null) => {
    heldRef.current = next
    setHeldState(next)
  }

  const placeOf = (id: string, index: number): SortablePlace => {
    const { items, itemLabel } = latest.current
    const item = items.find((candidate) => candidate.id === id)
    return {
      item: item === undefined ? id : itemLabel(item),
      position: index + 1,
      total: items.length,
    }
  }

  const handleOf = (id: string) =>
    listRef.current?.querySelector<HTMLElement>(
      `[data-sortable-item="${CSS.escape(id)}"] [data-sortable-handle]`,
    ) ?? null

  /** Every row's box relative to the list's top edge, in list order. */
  const measure = (): SortableBox[] => {
    const list = listRef.current
    if (list === null) return []
    const top = list.getBoundingClientRect().top
    return [...list.querySelectorAll<HTMLElement>(":scope > [data-sortable-item]")].map((row) => {
      const box = row.getBoundingClientRect()
      return { top: box.top - top, height: box.height }
    })
  }

  const pickUp = (id: string, pointer: number | null): boolean => {
    const { items } = latest.current
    const from = items.findIndex((item) => item.id === id)
    const boxes = measure()
    if (from === -1 || boxes.length !== items.length) return false
    setHeld({ id, from, to: from, boxes, order: orderOf(items), pointer })
    setAnnouncement(latest.current.text.pickedUp(placeOf(id, from)))
    return true
  }

  /** Show the held item at `to`, announcing it when that is a new place. */
  const moveTo = (to: number, pointer: number | null) => {
    const now = heldRef.current
    if (now === null) return
    if (to !== now.to) setAnnouncement(latest.current.text.moved(placeOf(now.id, to)))
    if (to !== now.to || pointer !== now.pointer) setHeld({ ...now, to, pointer })
  }

  /** Drop the held item: report the move when it changes the order, and announce the drop. */
  const drop = () => {
    const now = heldRef.current
    if (now === null) return
    setHeld(null)
    setAnnouncement(latest.current.text.dropped(placeOf(now.id, now.to)))
    if (now.to !== now.from) latest.current.onMove(now.from, now.to)
  }

  /** Put the held item back where it was, reporting nothing. */
  const cancel = () => {
    const now = heldRef.current
    if (now === null) return
    setHeld(null)
    setAnnouncement(latest.current.text.cancelled(placeOf(now.id, now.from)))
  }

  const endPress = () => {
    press.current?.stop.abort()
    press.current = null
  }

  // Unmounting mid-drag must not leave window listeners, a frame loop or a timer behind.
  useEffect(() => () => {
    endPress()
    clearTimeout(blurTimer.current)
  }, [])

  // The caller changed the list under a held item: its indexes no longer mean anything. A layout
  // effect, so the check runs in the same commit and never lands after a later pick-up.
  const order = orderOf(items)
  useLayoutEffect(() => {
    const now = heldRef.current
    if (now === null || now.order === order) return
    endPress()
    cancel()
  }, [order])

  // After a keyboard drop the caller's new order can re-insert the row, which takes focus off its
  // handle: put it back. A keyboard-held row also stays in view as it moves.
  useLayoutEffect(() => {
    if (held !== null && held.pointer === null) {
      handleOf(held.id)?.scrollIntoView?.({ block: "nearest" })
      return
    }
    const pending = pendingFocus.current
    if (pending === null) return
    const handle = handleOf(pending)
    const active = document.activeElement
    if (handle === null || active === handle) return
    if (active !== null && active !== document.body) {
      pendingFocus.current = null
      return
    }
    handle.focus()
  })

  /**
   * Focus leaving a handle: a keyboard-held item is put back (Tab, or a click elsewhere), and a
   * handle waiting to be refocused after a drop is forgotten.
   *
   * Decided a task later, not in the event: the caller's re-render after a drop can move the row,
   * which blurs its handle, and the layout effect above focuses it again before that task runs.
   */
  const onHandleBlur = (id: string) => {
    const now = heldRef.current
    const keyboardHeld = now !== null && now.pointer === null && now.id === id
    if (!keyboardHeld && pendingFocus.current !== id) return
    clearTimeout(blurTimer.current)
    blurTimer.current = setTimeout(() => {
      if (document.activeElement === handleOf(id)) return
      if (pendingFocus.current === id) pendingFocus.current = null
      const still = heldRef.current
      if (still !== null && still.pointer === null && still.id === id) cancel()
    }, 0)
  }

  const onHandleKeyDown = (event: KeyboardEvent, id: string) => {
    const now = heldRef.current
    const pick = event.key === " " || event.key === "Enter"
    if (now === null) {
      if (!pick) return
      event.preventDefault()
      if (event.repeat) return
      pendingFocus.current = null
      pickUp(id, null)
      return
    }
    if (now.id !== id || now.pointer !== null) return
    if (pick) {
      event.preventDefault()
      if (event.repeat) return
      pendingFocus.current = id
      drop()
      return
    }
    if (event.key === "Escape") {
      // Escape stays with the list, so a dialog around it does not close too.
      event.preventDefault()
      event.stopPropagation()
      pendingFocus.current = id
      cancel()
      return
    }
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0
    if (step === 0) return
    event.preventDefault()
    moveTo(Math.min(Math.max(now.to + step, 0), now.boxes.length - 1), null)
  }

  /** Follow the pointer at viewport height `y`: the held row's offset and its drop index. */
  const follow = (y: number) => {
    const now = heldRef.current
    const current = press.current
    const list = listRef.current
    if (now === null || current === null || current.startInList === null || list === null) return
    const box = now.boxes[now.from]
    const last = now.boxes[now.boxes.length - 1]
    const offset = Math.min(
      Math.max(y - list.getBoundingClientRect().top - current.startInList, -box.top),
      last.top + last.height - box.height - box.top,
    )
    moveTo(sortableTarget(now.boxes, now.from, box.top + offset + box.height / 2), offset)
  }

  /** Scroll the nearest scrolling area while the pointer is near its edge, one step per frame. */
  const edgeScroll = (signal: AbortSignal) => {
    const list = listRef.current
    if (list === null) return
    const parent = scrollParent(list)
    const frame = () => {
      const current = press.current
      if (signal.aborted || current === null) return
      const area = parent?.getBoundingClientRect()
      const step = edgeScrollStep(
        current.lastY,
        Math.max(area?.top ?? 0, 0),
        Math.min(area?.bottom ?? globalThis.innerHeight, globalThis.innerHeight),
      )
      if (step !== 0) {
        // Instant: a page with smooth scrolling would otherwise restart a smooth scroll every frame.
        const scroller = parent ?? globalThis
        scroller.scrollBy({ top: step, behavior: "instant" })
        follow(current.lastY)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  const onHandlePointerDown = (event: PointerEvent, id: string) => {
    if (!event.isPrimary || event.button !== 0 || heldRef.current !== null) return
    endPress()
    const stop = new AbortController()
    press.current = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastY: event.clientY,
      startInList: null,
      stop,
    }
    const options = { signal: stop.signal }
    const mine = (e: PointerEvent) =>
      press.current !== null && e.pointerId === press.current.pointerId
    globalThis.addEventListener("pointermove", (e: PointerEvent) => {
      const current = press.current
      if (!mine(e) || current === null) return
      current.lastY = e.clientY
      if (current.startInList === null) {
        if (Math.hypot(e.clientX - current.x, e.clientY - current.y) < DRAG_THRESHOLD) return
        const list = listRef.current
        if (list === null || !pickUp(current.id, 0)) return endPress()
        pendingFocus.current = null
        current.startInList = current.y - list.getBoundingClientRect().top
        edgeScroll(stop.signal)
      }
      // A mouse drag would otherwise select the text it passes over.
      e.preventDefault()
      follow(e.clientY)
    }, options)
    globalThis.addEventListener("pointerup", (e: PointerEvent) => {
      if (!mine(e)) return
      const dragging = press.current?.startInList !== null
      endPress()
      if (dragging) drop()
    }, options)
    globalThis.addEventListener("pointercancel", (e: PointerEvent) => {
      if (!mine(e)) return
      const dragging = press.current?.startInList !== null
      endPress()
      if (dragging) cancel()
    }, options)
    globalThis.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Escape" || press.current?.startInList === null) return
      e.preventDefault()
      e.stopPropagation()
      endPress()
      cancel()
    }, { signal: stop.signal, capture: true })
  }

  const offsets = held === null ? [] : sortableOffsets(held.boxes, held.from, held.to)
  if (held !== null && held.pointer !== null) offsets[held.from] = held.pointer
  const dragging = held !== null && held.pointer !== null

  return (
    <div class={cn(dragging && "select-none", className)}>
      <ul ref={listRef} class={listClass}>
        {items.map((item, index) => {
          const isHeld = held?.id === item.id
          const offset = offsets[index] ?? 0
          return (
            <li
              key={item.id}
              data-sortable-item={item.id}
              class={cn(
                rowClass,
                !(isHeld && dragging) && rowSlideClass,
                isHeld && rowHeldClass,
              )}
              style={offset === 0 ? undefined : { transform: `translateY(${offset}px)` }}
            >
              <button
                type="button"
                data-sortable-handle=""
                aria-label={text.handle(itemLabel(item))}
                aria-describedby={instructionsId}
                class={cn(handleClass, dragging && "cursor-grabbing")}
                onKeyDown={(event) => onHandleKeyDown(event, item.id)}
                onPointerDown={(event) => onHandlePointerDown(event, item.id)}
                onBlur={() => onHandleBlur(item.id)}
              >
                <IconBars3 class="size-5" />
              </button>
              <div class={bodyClass}>{renderItem(item)}</div>
            </li>
          )
        })}
      </ul>
      <span id={instructionsId} class="sr-only">{text.instructions}</span>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-sortable-live=""
        class="sr-only"
      >
        {announcement}
      </div>
    </div>
  )
}
