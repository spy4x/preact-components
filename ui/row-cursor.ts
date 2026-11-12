import { useSignal } from "@preact/signals"
import { useRef } from "preact/hooks"
import { useHotkeys } from "./hotkeys.ts"

/** Options of {@link useRowCursor}. */
export interface RowCursorOptions {
  /** How many rows the list shows now. */
  count: number
  /** Runs when Enter is pressed while a row is highlighted, with that row's index. */
  onOpen: (index: number) => void
  /** Whether the keys listen. Defaults to `true`; turn it off for every list but one on a page. */
  enabled?: boolean
}

/** What {@link RowCursor.rowProps} gives each row: spread it on the row's element. */
export interface RowCursorRowProps {
  /** `"true"` on the highlighted row, so assistive tech hears which row it is. */
  "aria-current": "true" | undefined
  /** {@link rowCursorClass} on the highlighted row. */
  class: string | undefined
  /** Keeps the row's element, so a move can scroll it into view. */
  ref: (element: HTMLElement | null) => void
}

/** The cursor {@link useRowCursor} returns. */
export interface RowCursor {
  /** The highlighted row's index, or `-1` before the first `j` or `k`. */
  index: number
  /** The props of row `index`: its highlight, its `aria-current` and a ref. */
  rowProps: (index: number) => RowCursorRowProps
}

/** How the highlighted row looks: a quiet selected background inside a selected outline. */
export const rowCursorClass = "bg-selected-soft outline-2 -outline-offset-2 outline-selected"

/**
 * A control that answers Enter itself, so Enter on it never opens the highlighted row. A checkbox,
 * a switch or a radio does nothing with Enter, so it is left out and Enter there opens the row.
 */
const CONTROLS = "a[href], button, select, textarea, summary, " +
  "input:is([type='button'], [type='submit'], [type='reset'], [type='image']), " +
  "[role='button'], [role='link'], [role='tab'], [role='option'], [role='menuitem'], " +
  "[role='combobox']"

/**
 * Where a row cursor lands: the row `step` rows from `from` (`1` for `j`, `-1` for `k`), held to
 * the list's ends. From no row (`-1`) either step lands on the first row; in an empty list it lands
 * on none (`-1`). A `from` past a list that shrank counts from its new last row.
 *
 * @param from The highlighted row's index, or `-1` for none.
 * @param step How many rows to move, down for a positive number.
 * @param count How many rows the list shows.
 */
export function stepRowCursor(from: number, step: number, count: number): number {
  if (count === 0) return -1
  const current = Math.min(from, count - 1)
  return current < 0 ? 0 : Math.max(0, Math.min(count - 1, current + step))
}

/**
 * A keyboard cursor over a list of rows, card rows or a table's: `j` highlights the next row and
 * `k` the one before, scrolling it into view, and Enter opens the highlighted row through `onOpen`.
 * Nothing is highlighted until the first `j` or `k`, which both start on the first row; the cursor
 * stops at either end, and an empty list ignores every key. When the list shrinks, the cursor moves
 * up to its new last row.
 *
 * The keys go through `useHotkeys`, so they match the physical key too (`j` on a Cyrillic layout is
 * `о`), and a press with Control, Command, Alt or Shift, a press in a text field, a select or
 * editable content, and a press inside a dialog or a menu do nothing. Enter on a link, a button or
 * another control is left to that control. Every list on the page listens, so give all but one
 * `enabled: false`.
 *
 * @param options See {@link RowCursorOptions}.
 */
export function useRowCursor({ count, onOpen, enabled = true }: RowCursorOptions): RowCursor {
  const cursor = useSignal(-1)
  const rows = useRef<(HTMLElement | null)[]>([])
  const index = Math.min(cursor.value, count - 1)

  const move = (step: number) => {
    const next = stepRowCursor(cursor.peek(), step, count)
    if (next < 0) return
    cursor.value = next
    rows.current[next]?.scrollIntoView({ block: "nearest" })
  }

  useHotkeys([
    { keys: "j", handler: () => move(1) },
    { keys: "k", handler: () => move(-1) },
    {
      keys: "enter",
      preventDefault: false,
      handler: (event) => {
        const open = Math.min(cursor.peek(), count - 1)
        const target = event.target as Partial<Element> | null
        if (open < 0 || target?.closest?.(CONTROLS)) return
        event.preventDefault()
        onOpen(open)
      },
    },
  ], { enabled })

  return {
    index,
    rowProps: (row) => ({
      "aria-current": row === index ? "true" : undefined,
      class: row === index ? rowCursorClass : undefined,
      ref: (element) => {
        rows.current[row] = element
      },
    }),
  }
}
