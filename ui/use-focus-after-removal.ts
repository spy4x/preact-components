import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/** The id of a row: what the caller's list of ids holds. */
export type RowId = string | number

/** Options of {@link useFocusAfterRemoval}. */
export interface FocusAfterRemovalOptions {
  /**
   * Where focus goes when no row can take it: the last row left, or none of the rows that may take
   * it has a control. Such as the button that adds a row, or the section's heading with
   * `tabIndex={-1}`. Without one, focus falls to the page's body then.
   */
  fallback?: () => HTMLElement | null | undefined
  /**
   * The control of a row that takes focus. Defaults to the row's first enabled button, link or
   * visible kind of field, or element with a `tabindex` of 0 or more. A row for which it returns
   * nothing is passed over, and so is a row whose control did not take focus, such as a button that
   * is not shown or one inside a disabled `<fieldset>`.
   */
  target?: (row: Element) => HTMLElement | null | undefined
  /**
   * Whether a row before the removed one may take focus when no later row can. Defaults to `true`:
   * removing the last of several rows moves focus to the row before it. `false` skips the earlier
   * rows for {@link FocusAfterRemovalOptions.fallback}.
   */
  earlier?: boolean
}

/** What a row's default focus target matches: its first control a person can reach. */
const FOCUSABLE =
  `button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex^="-"])`

/**
 * Keeps focus on the page when a row leaves a list because its own removal went through.
 *
 * A row's "Remove" button, or the menu that holds it, goes with the row, and focus then falls to
 * the page's body: a keyboard user starts again from the top, and a screen reader says nothing.
 * This hook moves focus to the row that took the removed one's place, else to the nearest later row
 * whose control takes focus, else to the nearest earlier one, else to `fallback()`.
 *
 * It acts only on a removal it was told about: a row whose id was `removingId` and then left
 * `ids`. A row that leaves for another reason (a filter, a reload, someone else's change) moves
 * nothing, and neither does a removal that ended with the row still there, such as a refusal.
 *
 * Take the row out of `ids` in the same update that clears `removingId`, or earlier, while the
 * removal still runs; never later. The hook stops waiting when `removingId` clears with the row
 * still in `ids`, so a list that is loaded again one render after the request ended moves nothing
 * and focus falls to the body. A row that leaves early moves focus once, when it leaves: the end of
 * its request moves nothing more.
 *
 * `list` is the element whose children are the rows, one child per id and in the order of `ids`: a
 * `<ul>` of `<li>`, or a `<tbody>` of `<tr>`. Keep that element mounted when the last row leaves,
 * or pass a `fallback` that does not need it. A confirmation dialog for the removal belongs inside
 * its row, so that it leaves with the row: a dialog still open when the row goes holds focus, and
 * the move is lost.
 *
 * @param list The element whose children are the rows.
 * @param ids The rows' ids, in the order drawn; `null` or `undefined` while they are not loaded.
 * @param removingId The id of the row whose removal is running, else `null`.
 * @param options The fallback, the control of a row to focus, and whether earlier rows count.
 */
export function useFocusAfterRemoval(
  list: RefObject<HTMLElement>,
  ids: readonly RowId[] | null | undefined,
  removingId: RowId | null | undefined,
  options: FocusAfterRemovalOptions = {},
): void {
  const awaited = useRef<{ id: RowId; index: number; moved?: boolean } | null>(null)
  const known = useRef(ids)
  if (removingId != null && awaited.current?.id !== removingId) {
    awaited.current = { id: removingId, index: known.current?.indexOf(removingId) ?? -1 }
  }
  const key = ids ? JSON.stringify(ids) : null
  useEffect(() => {
    known.current = ids
    const gone = awaited.current
    if (!gone || !ids) return
    if (ids.includes(gone.id)) {
      // The removal ended and the row stayed (a refusal, or another change to the row): stop
      // waiting for it, so a later departure for another reason leaves focus where the person is.
      if (removingId == null) awaited.current = null
      return
    }
    // While this removal still runs, keep its record: a later render must not start the wait again
    // and move focus a second time when the request ends.
    awaited.current = removingId === gone.id ? { ...gone, moved: true } : null
    if (gone.moved) return
    const { fallback, target = firstControl, earlier = true } = options
    const rows = Array.from(list.current?.children ?? [])
    // An id that was not in the list when its removal started has no place: start from the top.
    const from = Math.max(gone.index, 0)
    const candidates = [...rows.slice(from), ...(earlier ? rows.slice(0, from).reverse() : [])]
    for (const row of candidates) {
      if (takesFocus(target(row))) return
    }
    fallback?.()?.focus()
  }, [key, removingId])
}

/**
 * Focuses a control and says whether focus landed on it. A control that is not shown, or that an
 * ancestor disables, matches a selector and still refuses focus.
 */
function takesFocus(control: HTMLElement | null | undefined): boolean {
  if (!control) return false
  control.focus()
  return control.ownerDocument.activeElement === control
}

/** A row's first control a person can reach, or `null`. */
function firstControl(row: Element): HTMLElement | null {
  return row.querySelector<HTMLElement>(FOCUSABLE)
}
