import { useCallback, useEffect, useRef } from "preact/hooks"

/** Which physical edges of a sideways scroller hide content: what {@link scrollFade} returns. */
export type ScrollFade = "left" | "right" | "both"

/**
 * Which edges of a row that scrolls sideways hide content, so the row can fade them out and a
 * reader sees there is more. Physical edges, not logical ones: in a right-to-left row
 * `scrollLeft` runs from 0 down to minus the overflow, and the result still says left or right.
 *
 * @param scrollLeft The row's `scrollLeft`.
 * @param overflow The row's `scrollWidth` minus its `clientWidth`.
 * @param rtl Whether the row runs right to left.
 * @returns The hiding edges, or `undefined` when everything shows.
 */
export function scrollFade(
  scrollLeft: number,
  overflow: number,
  rtl: boolean,
): ScrollFade | undefined {
  // Under a pixel is rounding, not hidden content.
  if (overflow < 1) return undefined
  const fromLeft = rtl ? scrollLeft + overflow : scrollLeft
  const left = fromLeft >= 1
  const right = overflow - fromLeft >= 1
  return left && right ? "both" : left ? "left" : right ? "right" : undefined
}

/**
 * Marks a row's hiding edges in its `data-fade` attribute, or removes the attribute.
 *
 * @param row The row that scrolls sideways.
 */
function markScrollFade(row: HTMLElement): void {
  const fade = scrollFade(
    row.scrollLeft,
    row.scrollWidth - row.clientWidth,
    getComputedStyle(row).direction === "rtl",
  )
  if (fade) row.dataset.fade = fade
  else delete row.dataset.fade
}

/**
 * Fades out the edges of a sideways scroller, the cue that more of the row hides there:
 * {@link SCROLL_FADE} draws the fade from the `data-fade` attribute this keeps up to date on
 * scroll, on resize and after every render of the calling component.
 *
 * @returns A ref callback for the row.
 */
export function useScrollFade(): (row: HTMLElement | null) => void {
  const node = useRef<HTMLElement | null>(null)
  const stop = useRef<(() => void) | null>(null)
  // A render can add or remove items without resizing the row, so measure after each one.
  useEffect(() => {
    if (node.current) markScrollFade(node.current)
  })
  return useCallback((row: HTMLElement | null) => {
    stop.current?.()
    stop.current = null
    node.current = row
    if (!row) return
    const measure = () => markScrollFade(row)
    row.addEventListener("scroll", measure, { passive: true })
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure)
    observer?.observe(row)
    measure()
    stop.current = () => {
      row.removeEventListener("scroll", measure)
      observer?.disconnect()
    }
  }, [])
}

/**
 * The edge fades of a {@link useScrollFade} row: a 2 rem mask on each side `data-fade` names. The
 * row keeps its native scrollbar as well. A mask paints over every descendant, a fixed menu sheet
 * included, so the fade lifts while a trigger in the row has its menu open.
 */
export const SCROLL_FADE =
  "has-[[aria-expanded=true]]:data-[fade]:[mask-image:none] data-[fade=left]:[mask-image:linear-gradient(to_right,transparent,#000_2rem)] data-[fade=right]:[mask-image:linear-gradient(to_left,transparent,#000_2rem)] data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,#000_2rem,#000_calc(100%-2rem),transparent)]"
