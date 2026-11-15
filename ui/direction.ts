/**
 * Reading direction for the components whose keys and gestures run along a line (#876). The
 * direction is the element's own computed `direction`, which it inherits from the nearest `dir`
 * above it, so an app sets `dir` on the page and passes nothing.
 */

/**
 * Whether `element` lays out right to left: its computed `direction`, inherited from the nearest
 * ancestor with a `dir`. Call it in an event handler or an effect, never during a render.
 *
 * @param element The element whose line the keys move along.
 */
export function isRightToLeft(element: Element): boolean {
  return getComputedStyle(element).direction === "rtl"
}

/**
 * The step along the reading direction a horizontal arrow key asks for: `1` toward the end of the
 * line, `-1` toward its start, `0` for any other key. Right is the end in a left-to-right line and
 * the start in a right-to-left one.
 *
 * @param key Value of `KeyboardEvent.key`.
 * @param rtl Whether the line runs right to left.
 */
export function inlineStep(key: string, rtl: boolean): -1 | 0 | 1 {
  if (key === "ArrowRight") return rtl ? -1 : 1
  if (key === "ArrowLeft") return rtl ? 1 : -1
  return 0
}
