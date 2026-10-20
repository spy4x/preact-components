/**
 * A board of columns whose cards move between and within the columns, by touch, by mouse and by
 * keyboard.
 *
 * The board is controlled: it renders `items` in the order the caller gives, reports every move
 * through the one `onMove` port, and never reorders the caller's data. `moveKanbanItem` applies a
 * reported move to an array of items for a caller that keeps its items in one.
 *
 * Pointer events cover mouse, pen and touch, so no drag library is involved: the same mechanism as
 * `SortableList`. A mouse drag starts once the pointer moves; a finger rests on a card for a
 * moment first, so a finger that moves at once still scrolls the page and the board. The dragged
 * card follows the pointer, a line marks where it would land, and near the board's edges the board
 * scrolls. The keyboard path is a card that is picked up with Space or Enter, moved with the arrow
 * keys and dropped with Space or Enter again; Escape puts it back. A polite live region says what
 * happened at every step.
 */

import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks"
import { edgeScrollStep, scrollPageNearEdge, useKeptFocus, usePointerDrag } from "./pointer-drag.ts"

/** One column of the board. */
export interface KanbanColumn {
  /** Stable identity, unique on the board. Items name their column by it. */
  id: string
  /** The column's visible title, which is also the accessible name of its list. */
  title: string
}

/** The two fields the board reads off an item. The caller's items may carry anything else. */
export interface KanbanItem {
  /** Stable identity, unique on the board. */
  id: string
  /** The `id` of the column the item is in. An item naming no column is not rendered. */
  column: string
}

/** A move the reader asked for, reported through {@link KanbanBoardProps.onMove}. */
export interface KanbanMove {
  /** The moved item's `id`. */
  itemId: string
  /** The column the item was in. */
  fromColumn: string
  /** The item's index in `fromColumn` before the move. */
  fromIndex: number
  /** The column the item goes to; it may be `fromColumn`. */
  toColumn: string
  /**
   * The index the item takes in `toColumn`, counted with the item already taken out of where it
   * was. `0` is the top; the column's length without the item is the bottom.
   */
  toIndex: number
}

/** Where a card is, as the announcements describe it. */
export interface KanbanPlace {
  /** The card's name, from {@link KanbanBoardProps.itemLabel}. */
  item: string
  /** The column's title. */
  column: string
  /** 1-based position in the column. */
  position: number
  /** How many cards the column holds with this one in it. */
  total: number
}

/** Every string the board shows or announces. Each has an English default. */
export interface KanbanBoardLabels {
  /** Accessible name of the board's list of columns. Defaults to `"Board"`. */
  board: string
  /** How a card describes itself instead of "button". Defaults to `"movable card"`. */
  roleDescription: string
  /** The keyboard instructions every card is described by when the board has no `onOpen`. */
  instructions: string
  /** The keyboard instructions every card is described by when `onOpen` is given. */
  instructionsWithOpen: string
  /** Announced when a card is picked up. */
  pickedUp: (place: KanbanPlace) => string
  /** Announced after each arrow key moves a picked-up card. */
  moved: (place: KanbanPlace) => string
  /** Announced when a card is dropped, by keyboard or by mouse. */
  dropped: (place: KanbanPlace) => string
  /** Announced when Escape, or focus leaving the card, puts a picked-up card back. */
  cancelled: (place: KanbanPlace) => string
}

/** The English defaults of {@link KanbanBoardLabels}. */
export const defaultKanbanLabels: KanbanBoardLabels = {
  board: "Board",
  roleDescription: "movable card",
  instructions:
    "Press Space or Enter to pick the card up. Use the arrow keys to move it, Space or Enter to drop it, and Escape to put it back.",
  instructionsWithOpen:
    "Press Enter to open the card, or Space to pick it up. Use the arrow keys to move it, Space to drop it, and Escape to put it back.",
  pickedUp: (at) => `Picked up ${at.item}. ${at.column}, position ${at.position} of ${at.total}.`,
  moved: (at) => `${at.item}: ${at.column}, position ${at.position} of ${at.total}.`,
  dropped: (at) => `Dropped ${at.item} in ${at.column}, position ${at.position} of ${at.total}.`,
  cancelled: (at) => `Put back ${at.item} in ${at.column}, position ${at.position} of ${at.total}.`,
}

export interface KanbanBoardProps<Item extends KanbanItem> {
  /** The columns, in the order they are shown. */
  columns: readonly KanbanColumn[]
  /** Every item on the board. Within a column they are shown in this array's order. */
  items: readonly Item[]
  /**
   * A card's body. The board draws the card around it, and the whole card is the control that
   * drags, picks up and opens, so keep the body free of buttons and links.
   */
  renderItem: (item: Item) => ComponentChildren
  /**
   * A card's name for the announcements, such as its title. Required: only the caller knows what
   * a card is called.
   */
  itemLabel: (item: Item) => string
  /** Called once per finished move. The board shows the item where it was until `items` changes. */
  onMove: (move: KanbanMove) => void
  /**
   * Opens a card, for example in an editor. When given, a click that is not a drag opens the card,
   * and Enter opens it while Space still picks it up. Left out, a card cannot be opened, and Enter
   * picks it up like Space.
   */
  onOpen?: (item: Item) => void
  /** Overrides for any of {@link defaultKanbanLabels}. */
  labels?: Partial<KanbanBoardLabels>
  /** The level of each column's heading. Defaults to 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** Extra utilities for the root element. */
  class?: string
}

/** A place on the board by indices: which column, and which index in it. */
export interface KanbanSlot {
  /** Index into the board's columns. */
  column: number
  /** Index in that column, counted without the card being moved. */
  index: number
}

/**
 * Where an arrow key sends a picked-up card.
 *
 * Up and Down step within the column; Left and Right go to the next column over at the same index,
 * or its bottom when it is shorter. A card at an edge stays where it is. Pure and exported so the
 * key map is testable without a browser.
 *
 * @param key `KeyboardEvent.key`.
 * @param from Where the card is now.
 * @param lengths How many cards each column holds without the card being moved.
 * @returns The new slot, the same slot at an edge, or `undefined` for a key the board does not use.
 */
export function nextKanbanSlot(
  key: string,
  from: KanbanSlot,
  lengths: readonly number[],
): KanbanSlot | undefined {
  const clampIn = (column: number, index: number) => ({
    column,
    index: Math.min(Math.max(index, 0), lengths[column] ?? 0),
  })
  switch (key) {
    case "ArrowUp":
      return clampIn(from.column, from.index - 1)
    case "ArrowDown":
      return clampIn(from.column, from.index + 1)
    case "ArrowLeft":
      return from.column > 0 ? clampIn(from.column - 1, from.index) : from
    case "ArrowRight":
      return from.column < lengths.length - 1 ? clampIn(from.column + 1, from.index) : from
    default:
      return undefined
  }
}

/**
 * Apply a reported move to an array of items, returning a new array.
 *
 * The moved item gets `toColumn` as its column and lands where it becomes the `toIndex`-th item of
 * that column; every other item keeps its relative order. An unknown `itemId` returns a copy.
 *
 * @param items The items as the board was given them.
 * @param move What {@link KanbanBoardProps.onMove} reported.
 * @returns The items after the move.
 */
export function moveKanbanItem<Item extends KanbanItem>(
  items: readonly Item[],
  move: KanbanMove,
): Item[] {
  const moving = items.find((item) => item.id === move.itemId)
  if (moving === undefined) return [...items]
  const rest = items.filter((item) => item.id !== move.itemId)
  let seen = 0
  let insertAt = -1
  let afterLast = -1
  rest.forEach((item, index) => {
    if (item.column !== move.toColumn) return
    if (seen === move.toIndex && insertAt === -1) insertAt = index
    seen++
    afterLast = index + 1
  })
  if (insertAt === -1) insertAt = afterLast === -1 ? rest.length : afterLast
  rest.splice(insertAt, 0, { ...moving, column: move.toColumn })
  return rest
}

/** A card picked up by keyboard: where it came from and where it is shown now. */
interface Lifted {
  itemId: string
  from: KanbanSlot
  at: KanbanSlot
}

/**
 * A card being dragged by a pointer: where its floating copy is drawn, and where it would land.
 *
 * The copy is `position: fixed`, outside the board's scrolling list, so the board neither clips it
 * nor grows its scroll area to make room for it.
 */
interface Dragged {
  itemId: string
  from: KanbanSlot
  /** The slot the drop indicator marks, or `null` while the pointer is off the board. */
  over: KanbanSlot | null
  /** The floating copy's top-left corner and width, in viewport pixels. */
  left: number
  top: number
  width: number
  /** Where the pointer holds the card, from the card's top-left corner. */
  grabX: number
  grabY: number
}

/** How long a finger rests on a card before it lifts, in milliseconds. Moving sooner scrolls. */
const TOUCH_HOLD = 250

const rootClass = "relative"
const boardClass = "flex items-start gap-4 overflow-x-auto p-1"
const columnClass = "flex min-w-60 flex-1 shrink-0 flex-col gap-2 rounded-lg bg-canvas p-2"
const headingClass =
  "flex items-center justify-between gap-2 px-1 text-sm font-semibold text-foreground"
const countClass = "text-xs font-normal text-muted"
const listClass = "flex min-h-16 flex-col gap-2"
const cardClass =
  "cursor-grab select-none rounded-md border border-subtle bg-surface p-3 text-sm text-foreground shadow-raised transition-shadow focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
// An outline, not a ring: `shadow-popover` sets the whole box-shadow, which would drop a ring.
const cardLiftedClass = "shadow-popover outline-2 outline-(--color-selected-text)"
/** The card left in place while its copy is dragged: it marks where the card came from. */
const cardDraggedClass = "opacity-50"
const cardCopyClass = "pointer-events-none fixed z-50 cursor-grabbing"
const indicatorClass = "h-0.5 shrink-0 rounded-full bg-(--color-selected-text)"

/**
 * The items of each column, in the caller's order.
 *
 * @returns One array per column, in column order.
 */
function itemsByColumn<Item extends KanbanItem>(
  columns: readonly KanbanColumn[],
  items: readonly Item[],
): Item[][] {
  return columns.map((column) => items.filter((item) => item.column === column.id))
}

/** The slot an item holds in `lists`, or `undefined` when no column holds it. */
function slotOf(lists: readonly KanbanItem[][], itemId: string): KanbanSlot | undefined {
  for (let column = 0; column < lists.length; column++) {
    const index = lists[column].findIndex((item) => item.id === itemId)
    if (index !== -1) return { column, index }
  }
  return undefined
}

/**
 * A board of columns; see the module doc.
 *
 * Markup: a list of columns named by `labels.board`, each column a list named by its heading.
 * Every card is focusable, carries `aria-roledescription` and is described by the instructions.
 * While a card is picked up by keyboard, the board shows it at its new place before any `onMove`;
 * while one is dragged, it follows the pointer and a line marks where it would land. Once dropped,
 * the board shows the caller's `items` again and keeps focus on the card wherever they put it.
 */
export function KanbanBoard<Item extends KanbanItem>(
  {
    columns,
    items,
    renderItem,
    itemLabel,
    onMove,
    onOpen,
    labels,
    headingLevel = 3,
    class: className,
  }: KanbanBoardProps<Item>,
): JSX.Element {
  const text: KanbanBoardLabels = { ...defaultKanbanLabels, ...labels }
  const id = useId()
  const instructionsId = `kanban-${id}-instructions`
  const rootRef = useRef<HTMLDivElement>(null)
  const [lifted, setLifted] = useState<Lifted | null>(null)
  const [dragged, setDraggedState] = useState<Dragged | null>(null)
  const [announcement, setAnnouncement] = useState("")
  /** The latest dragged card, for window listeners that outlive a render. */
  const draggedRef = useRef<Dragged | null>(null)
  const setDragged = (next: Dragged | null) => {
    draggedRef.current = next
    setDraggedState(next)
  }

  const lists = itemsByColumn(columns, items)
  const byId = new Map(items.map((item) => [item.id, item]))
  /** Column lengths with `itemId` taken out. */
  const lengthsWithout = (itemId: string) =>
    lists.map((list) => list.filter((item) => item.id !== itemId).length)

  const placeOf = (itemId: string, slot: KanbanSlot): KanbanPlace => {
    const item = byId.get(itemId)
    return {
      item: item === undefined ? itemId : itemLabel(item),
      column: columns[slot.column]?.title ?? "",
      position: slot.index + 1,
      total: lengthsWithout(itemId)[slot.column] + 1,
    }
  }

  /** Report a move when it changes anything, and announce the drop either way. */
  const finish = (itemId: string, from: KanbanSlot, to: KanbanSlot) => {
    if (from.column !== to.column || from.index !== to.index) {
      onMove({
        itemId,
        fromColumn: columns[from.column].id,
        fromIndex: from.index,
        toColumn: columns[to.column].id,
        toIndex: to.index,
      })
    }
    setAnnouncement(text.dropped(placeOf(itemId, to)))
  }

  /** The board's own scrolling list of columns. */
  const boardOf = () => (rootRef.current?.firstElementChild as HTMLElement | null) ?? null
  /** A card's focusable control, wherever the board shows it. */
  const cardOf = (itemId: string) =>
    rootRef.current?.querySelector<HTMLElement>(
      `[data-kanban-item="${CSS.escape(itemId)}"] [data-kanban-handle]`,
    ) ?? null

  /**
   * The card to keep focused while it is picked up and after a drop, until focus moves somewhere
   * else. A card moved to another column is a new element there, so focus is put back on it.
   */
  const focus = useKeptFocus(cardOf)
  useLayoutEffect(() => focus.restore())

  /** Put a picked-up card back where it came from. */
  const cancel = (from: Lifted) => {
    setLifted(null)
    setAnnouncement(text.cancelled(placeOf(from.itemId, from.from)))
  }

  /** The latest render's picked-up card and `cancel`, for the blur handler's deferred read. */
  const latest = useRef({ lifted, cancel })
  latest.current = { lifted, cancel }

  /**
   * Focus leaving a card: a picked-up card is put back (Tab, or a click anywhere else), and a card
   * waiting to be refocused after a drop is forgotten. `useKeptFocus` says why a task later.
   */
  const onCardBlur = (itemId: string) => {
    const held = lifted !== null && lifted.itemId === itemId
    if (!held && !focus.isKept(itemId)) return
    focus.blurred(itemId, () => {
      const { lifted: now, cancel: putBack } = latest.current
      if (now !== null && now.itemId === itemId) putBack(now)
    })
  }

  const onCardKeyDown = (event: KeyboardEvent, itemId: string) => {
    if (draggedRef.current !== null) return
    const pick = event.key === " " || event.key === "Enter"
    if (lifted === null || lifted.itemId !== itemId) {
      if (!pick || event.repeat) return
      const item = byId.get(itemId)
      if (event.key === "Enter" && onOpen !== undefined && item !== undefined) {
        event.preventDefault()
        onOpen(item)
        return
      }
      event.preventDefault()
      const slot = slotOf(lists, itemId)
      if (slot === undefined) return
      focus.keep(itemId)
      setLifted({ itemId, from: slot, at: slot })
      setAnnouncement(text.pickedUp(placeOf(itemId, slot)))
      return
    }
    if (pick) {
      event.preventDefault()
      if (event.repeat) return
      focus.keep(itemId)
      setLifted(null)
      finish(itemId, lifted.from, lifted.at)
      return
    }
    if (event.key === "Escape") {
      // Escape stays with the board, so a dialog around it does not close too.
      event.preventDefault()
      event.stopPropagation()
      focus.keep(itemId)
      cancel(lifted)
      return
    }
    const next = nextKanbanSlot(event.key, lifted.at, lengthsWithout(itemId))
    if (next === undefined) return
    event.preventDefault()
    if (next.column === lifted.at.column && next.index === lifted.at.index) return
    setLifted({ ...lifted, at: next })
    setAnnouncement(text.moved(placeOf(itemId, next)))
  }

  /**
   * The slot under viewport point (`x`, `y`): the column nearest across, and in it the place
   * before the first card whose middle is below. `null` when the point is off the board.
   */
  const slotAt = (x: number, y: number, itemId: string): KanbanSlot | null => {
    const board = boardOf()
    if (board === null) return null
    const area = board.getBoundingClientRect()
    if (x < area.left || x > area.right || y < area.top || y > area.bottom) return null
    const columnElements = [...board.querySelectorAll<HTMLElement>(":scope > [data-kanban-column]")]
    let column = -1
    let nearest = Infinity
    columnElements.forEach((element, index) => {
      const box = element.getBoundingClientRect()
      const distance = x < box.left ? box.left - x : x > box.right ? x - box.right : 0
      if (distance < nearest) {
        nearest = distance
        column = index
      }
    })
    if (column === -1) return null
    const cards = [...columnElements[column].querySelectorAll<HTMLElement>("[data-kanban-item]")]
      .filter((card) => card.dataset.kanbanItem !== itemId)
    const index = cards.filter((card) => {
      const box = card.getBoundingClientRect()
      return box.top + box.height / 2 < y
    }).length
    return { column, index }
  }

  /** Follow the pointer at viewport (`x`, `y`): where the card is drawn and where it would land. */
  const follow = (x: number, y: number) => {
    const now = draggedRef.current
    if (now === null) return
    const left = Math.round(x - now.grabX)
    const top = Math.round(y - now.grabY)
    const over = slotAt(x, y, now.itemId)
    const moved = over?.column !== now.over?.column || over?.index !== now.over?.index
    if (!moved && left === now.left && top === now.top) return
    if (moved && over !== null) setAnnouncement(text.moved(placeOf(now.itemId, over)))
    setDragged({ ...now, over, left, top })
  }

  /** End a drag: a card released over the board lands there, anywhere else it goes back. */
  const release = (itemId: string, land: boolean) => {
    const now = draggedRef.current
    setDragged(null)
    focus.keep(itemId)
    if (now === null) return
    if (land && now.over !== null) finish(itemId, now.from, now.over)
    else setAnnouncement(text.cancelled(placeOf(itemId, now.from)))
  }

  const drag = usePointerDrag({
    start: (itemId, x, y) => {
      const slot = slotOf(lists, itemId)
      const card = cardOf(itemId)
      if (slot === undefined || card === null || lifted !== null) return false
      const box = card.getBoundingClientRect()
      focus.forget()
      // A touch never focuses the card it drags; the drop keeps focus on it.
      card.focus({ preventScroll: true })
      setDragged({
        itemId,
        from: slot,
        over: slot,
        left: box.left,
        top: box.top,
        width: box.width,
        grabX: x - box.left,
        grabY: y - box.top,
      })
      setAnnouncement(text.pickedUp(placeOf(itemId, slot)))
      return true
    },
    move: follow,
    drop: (itemId) => release(itemId, true),
    cancel: (itemId) => release(itemId, false),
    // Scroll the board sideways near its left and right edges, and the page near its top and bottom.
    frame: (x, y) => {
      const board = boardOf()
      if (board === null) return
      const area = board.getBoundingClientRect()
      const step = board.scrollWidth > board.clientWidth
        ? edgeScrollStep(x, area.left, area.right)
        : 0
      if (step !== 0) board.scrollBy({ left: step, behavior: "instant" })
      if (scrollPageNearEdge(board, y) || step !== 0) follow(x, y)
    },
  }, { hold: TOUCH_HOLD, area: rootRef })

  // What each column shows: the caller's order, with a keyboard-lifted card moved to where it is.
  const shown: Item[][] = lists.map((list) => [...list])
  if (lifted !== null) {
    const card = byId.get(lifted.itemId)
    if (card !== undefined) {
      shown[lifted.from.column] = shown[lifted.from.column].filter((item) => item.id !== card.id)
      shown[lifted.at.column].splice(lifted.at.index, 0, card)
    }
  }

  const Heading = `h${headingLevel}` as "h3"
  const draggedItem = dragged === null ? undefined : byId.get(dragged.itemId)

  return (
    <div ref={rootRef} class={cn(rootClass, dragged !== null && "select-none", className)}>
      <ul aria-label={text.board} class={boardClass}>
        {columns.map((column, columnIndex) => {
          const titleId = `kanban-${id}-column-${columnIndex}`
          const cards = shown[columnIndex]
          const indicatorAt = dragged?.over?.column === columnIndex ? dragged.over.index : -1
          let beforeIndicator = 0
          const rows: ComponentChildren[] = []
          for (const item of cards) {
            if (item.id !== dragged?.itemId) {
              if (beforeIndicator === indicatorAt) {
                rows.push(<Indicator key="indicator" />)
              }
              beforeIndicator++
            }
            const isLifted = lifted?.itemId === item.id
            const isDragged = dragged?.itemId === item.id
            rows.push(
              <li key={item.id} data-kanban-item={item.id}>
                <div
                  data-kanban-handle=""
                  role="button"
                  tabIndex={0}
                  aria-roledescription={text.roleDescription}
                  aria-describedby={instructionsId}
                  class={cn(
                    cardClass,
                    isLifted && cardLiftedClass,
                    isDragged && cardDraggedClass,
                  )}
                  onKeyDown={(event) => onCardKeyDown(event, item.id)}
                  onClick={() => {
                    // A click on the card being held does not open it; a drag's own click is
                    // swallowed by `usePointerDrag`.
                    if (onOpen !== undefined && lifted?.itemId !== item.id) onOpen(item)
                  }}
                  onBlur={() => onCardBlur(item.id)}
                  onPointerDown={(event) => {
                    if (lifted === null) drag.onPointerDown(event, item.id)
                  }}
                  // A long press on a touch screen would otherwise open the browser's menu.
                  onContextMenu={(event) => {
                    if (drag.pressing()) event.preventDefault()
                  }}
                >
                  {renderItem(item)}
                </div>
              </li>,
            )
          }
          if (indicatorAt !== -1 && beforeIndicator === indicatorAt) {
            rows.push(<Indicator key="indicator" />)
          }
          return (
            <li key={column.id} data-kanban-column={column.id} class={columnClass}>
              <Heading class={headingClass}>
                <span id={titleId}>{column.title}</span>
                <span class={countClass}>{lists[columnIndex].length}</span>
              </Heading>
              <ul aria-labelledby={titleId} data-kanban-list="" class={listClass}>
                {rows}
              </ul>
            </li>
          )
        })}
      </ul>
      {draggedItem !== undefined && dragged !== null && (
        <div
          aria-hidden="true"
          data-kanban-dragging=""
          class={cn(cardClass, cardLiftedClass, cardCopyClass)}
          style={{ left: dragged.left, top: dragged.top, width: dragged.width }}
        >
          {renderItem(draggedItem)}
        </div>
      )}
      <span id={instructionsId} class="sr-only">
        {onOpen === undefined ? text.instructions : text.instructionsWithOpen}
      </span>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-kanban-live=""
        class="sr-only"
      >
        {announcement}
      </div>
    </div>
  )
}

/** The line that marks where a dragged card would land. Hidden from assistive technology. */
function Indicator(): JSX.Element {
  return <li aria-hidden="true" data-kanban-indicator="" class={indicatorClass} />
}
