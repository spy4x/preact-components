import { cn } from "@preact-components/cn"
import { Button } from "./button.tsx"

/** One item of the range a pagination control renders: a real page, or a collapsed run of pages. */
export type PageRangeItem = { page: number } | { gap: "gap" }

export interface PaginationProps {
  /** Current page, `1`-based. Clamped into `1…pageCount` before rendering. */
  page: number
  /** Total number of pages. `0` renders nothing at all. */
  pageCount: number
  /** Called with the page the user asked for. The component never changes `page` itself. */
  onChange: (page: number) => void
  /** Accessible name of the `nav` landmark. Defaults to `"Pagination"`. */
  label?: string
  /** Text of the previous control. Defaults to `"Previous"`. */
  previousLabel?: string
  /** Text of the next control. Defaults to `"Next"`. */
  nextLabel?: string
  /**
   * Accessible name of one page number, as a function of that number. Defaults to
   * `` (page) => `Page ${page}` ``.
   *
   * A function rather than a string, because a translation needs the number and where it falls in
   * the sentence is the translator's business, not this component's.
   */
  pageLabel?: (page: number) => string
  class?: string
}

/** Longest range still listed in full; past this the middle collapses. */
const fullListLimit = 7

/** Pages kept next to the current one, on each side. */
const sideWidth = 2

/**
 * Collapse a page range into the items a pagination control renders.
 *
 * Pure and DOM-free, so the collapsing rules are unit-testable on their own. A range no longer than
 * `size` is listed in full. Past that, three rules hold together, in this order:
 *
 * - the first and last page are always shown;
 * - the current page keeps {@link sideWidth} neighbours on **both** sides, as far as the ends of
 *   the range allow — where the window runs off an end it slides back inside rather than shrinking,
 *   so the control keeps one width wherever the reader is;
 * - a `…` always stands for at least two pages. Where a window would leave a single page between
 *   itself and an end, that page is written out instead of marked: a `…` takes the same room as the
 *   number and says less.
 *
 * That last rule is why a collapsed range can show more page numbers than `size` — it swallows a
 * page by dropping the `…` that would have hidden it — and it is why `size` does not bound how much
 * the control renders. {@link sideWidth} does. A collapsed range renders at most
 * `2 * sideWidth + 5` items, **nine** as this module is configured: the window is
 * `2 * sideWidth + 1` pages, and each end adds at most two more items — the first or last page and
 * a `…`, or the two pages the window swallowed in place of that `…`.
 *
 * Two at each end rather than `sideWidth`, and the difference matters as soon as anyone changes the
 * constant. The swallow is bounded by {@link windowAround}'s own literals, which ask whether fewer
 * than two pages would be left behind a mark, so it takes two pages however wide the window is.
 *
 * `sideWidth` is a constant of this module and not a parameter, so what the unit suite can pin is
 * the number the library ships rather than the formula: it walks every page of every total up to 60
 * across a dozen values of `size` and asserts both that nothing exceeds nine and that nine is
 * reached, which is what turns a change that widens the swallow, or narrows the window, red.
 *
 * `page` is clamped into `1…pageCount` first.
 *
 * The `page` of a {@link PageRangeItem} is always a real page number; `"gap"` is a sentinel only
 * ever used by the `gap` branch of the union.
 *
 * @param page Current page, `1`-based. Non-integers are rounded.
 * @param pageCount Total number of pages; `0` or fewer yields `[]`.
 * @param size How long a range may be and still be listed in full. Defaults to `7`; values below
 *   `5` are raised, because a range shorter than that cannot show both ends and still give the
 *   current page a neighbour on each side. It does not set the collapsed window's width —
 *   {@link sideWidth} does — so raising it moves only the point at which collapsing starts.
 * @returns The items to render, in order: `[{ page: 1 }, { gap: "gap" }, …]`.
 */
export function pageRange(page: number, pageCount: number, size = fullListLimit): PageRangeItem[] {
  if (pageCount < 1) return []

  const current = Math.max(1, Math.min(pageCount, Math.round(page)))
  const budget = Math.max(5, size)
  if (pageCount <= budget) {
    return Array.from({ length: pageCount }, (_, index) => ({ page: index + 1 }))
  }

  // Which pages the window shows, when the range is long enough to need one.
  const { from, to } = windowAround(current, pageCount)

  const items: PageRangeItem[] = []
  if (from > 1) items.push({ page: 1 }, { gap: "gap" })

  for (let number = from; number <= to; number++) items.push({ page: number })

  if (to < pageCount) items.push({ gap: "gap" }, { page: pageCount })

  return items
}

/**
 * The run of page numbers a long range shows around the current page.
 *
 * Derived rather than searched. Centre {@link sideWidth} pages on each side of the current page,
 * slide the window back inside the range if it hangs off an end, then let each edge swallow a page
 * it would otherwise have hidden behind a `…` on its own. Both adjustments only ever widen the
 * window, so the neighbours the first step granted are never taken away again — which is the
 * property the old scoring search did not have: it rejected the centred window outright when a mark
 * beside it would have hidden one page, and answered with an off-centre one instead, so page 5 of
 * 10 was shown as `1 2 3 4 5 … 10` with no neighbour after it.
 *
 * Called only for `pageCount > budget`, and `budget` is at least `5`, so the range is always long
 * enough to hold the window.
 *
 * @param current Current page, already clamped into `1…pageCount`.
 * @param pageCount Total number of pages.
 * @returns The inclusive first and last page of the window.
 */
function windowAround(current: number, pageCount: number): { from: number; to: number } {
  let from = current - sideWidth
  let to = current + sideWidth

  if (from < 1) {
    to = Math.min(pageCount, to + (1 - from))
    from = 1
  }
  if (to > pageCount) {
    from = Math.max(1, from - (to - pageCount))
    to = pageCount
  }

  // A mark in front of the window would hide pages `2 … from - 1`, and one behind it pages
  // `to + 1 … pageCount - 1`. Fewer than two of them is not worth a mark, so the window takes them.
  if (from <= 3) from = 1
  if (to >= pageCount - 2) to = pageCount

  return { from, to }
}

/**
 * Utilities that make an `aria-disabled` control look and feel disabled.
 *
 * `Button`'s own `disabled:` utilities are gated on the native attribute, which this component does
 * not use — see {@link Pagination} for why — so the same two effects are spelled out against the
 * aria state instead.
 */
const ariaDisabledClasses = "aria-disabled:pointer-events-none aria-disabled:opacity-50"

/**
 * Page numbers with the long runs collapsed, plus previous/next.
 *
 * Controlled: `page` is rendered as given (clamped) and every request leaves through `onChange`,
 * so a caller can drive it from a URL param or a signal. Nothing is kept internally. `pageCount` of
 * `0` renders nothing; `1` renders the single page marked `aria-current="page"` and no controls at
 * all, because a list with one page has nowhere to go and two dead tab stops on it would cost every
 * reader who tabs past them something and gain nobody anything.
 *
 * **From two pages up, Previous and Next are always rendered**, and carry `aria-disabled="true"`
 * where they cannot act. The two obvious alternatives both lose the keyboard user's place at the
 * moment they reach
 * the end, which is exactly when they are pressing the control: unmounting it destroys the element
 * under their focus, and setting the native `disabled` attribute on a focused button takes focus
 * off it — measured in the headless Chromium this repository drives, where `document.activeElement`
 * went from the button to `<body>` on the same line that set the attribute. `aria-disabled` leaves
 * focus alone, and Chromium's accessibility tree reports the control as disabled for either
 * spelling, so nothing is given up by choosing it. What it does not do is stop the press: a real
 * Space press still fires a click on an `aria-disabled` button, measured the same way, so each
 * handler checks the end it guards before calling `onChange`.
 *
 * The one-page case does mean the two controls mount and unmount as `pageCount` crosses between `1`
 * and `2`. That is the caller's data changing under the control rather than a step the reader took
 * inside it, so nobody's focus is on a control at that moment — which is the whole difference from
 * paging to an end.
 */
export function Pagination(
  {
    page,
    pageCount,
    onChange,
    label = "Pagination",
    previousLabel = "Previous",
    nextLabel = "Next",
    pageLabel = (pageNumber) => `Page ${pageNumber}`,
    class: className,
  }: PaginationProps,
) {
  if (pageCount < 1) return null

  const current = Math.max(1, Math.min(pageCount, Math.round(page)))
  const atStart = current === 1
  const atEnd = current === pageCount
  const showsControls = pageCount > 1

  return (
    <nav aria-label={label} class={cn("flex items-center justify-center gap-1", className)}>
      {showsControls && (
        <Button
          variant="outline"
          size="sm"
          class={ariaDisabledClasses}
          aria-disabled={atStart ? "true" : undefined}
          onClick={() => {
            if (!atStart) onChange(current - 1)
          }}
        >
          {previousLabel}
        </Button>
      )}
      <ul class="flex items-center gap-1">
        {pageRange(current, pageCount).map((item, index) =>
          !("page" in item)
            ? (
              <li key={`gap-${index}`} aria-hidden="true" class="px-1 text-gray-500">
                …
              </li>
            )
            : (
              <li key={item.page}>
                <Button
                  variant={item.page === current ? "secondary" : "outline"}
                  size="sm"
                  aria-current={item.page === current ? "page" : undefined}
                  aria-label={pageLabel(item.page)}
                  onClick={() => onChange(item.page)}
                >
                  {item.page}
                </Button>
              </li>
            )
        )}
      </ul>
      {showsControls && (
        <Button
          variant="outline"
          size="sm"
          class={ariaDisabledClasses}
          aria-disabled={atEnd ? "true" : undefined}
          onClick={() => {
            if (!atEnd) onChange(current + 1)
          }}
        >
          {nextLabel}
        </Button>
      )}
    </nav>
  )
}
