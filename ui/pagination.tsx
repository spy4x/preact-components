import { cn } from "@preact-components/signals/cn"
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
  class?: string
}

/** Most page numbers shown at once in a collapsed range, not counting a `…`. */
const windowSize = 7

/** Pages kept next to the current one when the window is wide enough to hold them. */
const sideWidth = 2

/**
 * Collapse a page range into the items a pagination control renders.
 *
 * Pure and DOM-free, so the collapsing rules are unit-testable on their own. A range no longer than
 * `size` is listed in full; past that the first and last page are always shown, the current page
 * keeps {@link sideWidth} neighbours around it, and a run nobody needs to see becomes a `…`. A `…`
 * is only ever used for at least two pages — a mark hiding one page shows less than writing it out
 * — and it does not count against `size`. `page` is clamped into `1…pageCount` first.
 *
 * The `page` of a {@link PageRangeItem} is always a real page number; `"gap"` is a sentinel only
 * ever used by the `gap` branch of the union.
 *
 * @param page Current page, `1`-based. Non-integers are rounded.
 * @param pageCount Total number of pages; `0` or fewer yields `[]`.
 * @param size How many page numbers to show at most when the range is long enough. Defaults to
 *   `7`; values below `5` are raised, because a narrower window cannot show both ends and still
 *   give the current page a neighbour on each side.
 * @returns The items to render, in order: `[{ page: 1 }, { gap: "gap" }, …]`.
 */
export function pageRange(page: number, pageCount: number, size = windowSize): PageRangeItem[] {
  if (pageCount < 1) return []

  const current = Math.max(1, Math.min(pageCount, Math.round(page)))
  const budget = Math.max(5, size)
  if (pageCount <= budget) {
    return Array.from({ length: pageCount }, (_, index) => ({ page: index + 1 }))
  }

  // Which pages the window shows, when the range is long enough to need one.
  const { from, to } = bestWindow(current, pageCount, budget)

  const items: PageRangeItem[] = []
  if (from > 2) items.push({ page: 1 }, { gap: "gap" })

  for (let number = from; number <= to; number++) items.push({ page: number })

  if (to < pageCount - 1) items.push({ gap: "gap" }, { page: pageCount })
  else if (to < pageCount) items.push({ page: pageCount })

  return items
}

/**
 * Pick the run of page numbers a long range should show.
 *
 * The rules overlap at the edges of a range, so the candidates are scored rather than derived: a
 * `…` must hide at least two pages, the current page must stay visible, and the widest window that
 * obeys both wins. Ties go to the window whose centre is closest to the current page, so the active
 * page sits mid-span instead of against a mark. Called only for `pageCount > budget`.
 */
function bestWindow(
  current: number,
  pageCount: number,
  budget: number,
): { from: number; to: number } {
  const widest = Math.min(pageCount - 2, budget, sideWidth * 2 + 1)

  for (let width = widest; width > 0; width--) {
    let best: { from: number; to: number } | undefined
    let closest = Number.POSITIVE_INFINITY

    for (let from = 1; from + width - 1 <= pageCount; from++) {
      const to = from + width - 1
      if (current < from || current > to) continue
      // A mark in front of the window hides `from - 2` pages; one behind it hides `pageCount - to`.
      // Two is the fewest worth a mark, and a window that reaches an end needs no mark there.
      if (from > 1 && from < 4) continue
      if (to < pageCount - 1 && pageCount - to < 3) continue

      const distance = Math.abs(current - (from + to) / 2)
      if (distance < closest) {
        best = { from, to }
        closest = distance
      }
    }

    if (best) return best
  }

  // A range this long always has a window of its own; this only fails safe on the impossible.
  return { from: 1, to: widest }
}

/**
 * Page numbers with the long runs collapsed, plus previous/next.
 *
 * Controlled: `page` is rendered as given (clamped) and every request leaves through `onChange`,
 * so a caller can drive it from a URL param or a signal. Nothing is kept internally.
 *
 * A control that cannot act is not rendered: there is no previous button on page 1 and no next
 * button on the last page. `pageCount` of `0` renders nothing; `1` renders the single page marked
 * `aria-current="page"`.
 */
export function Pagination(
  {
    page,
    pageCount,
    onChange,
    label = "Pagination",
    previousLabel = "Previous",
    nextLabel = "Next",
    class: className,
  }: PaginationProps,
) {
  if (pageCount < 1) return null

  const current = Math.max(1, Math.min(pageCount, Math.round(page)))

  return (
    <nav aria-label={label} class={cn("flex items-center justify-center gap-1", className)}>
      {current > 1 && (
        <Button variant="outline" size="sm" onClick={() => onChange(current - 1)}>
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
                  aria-label={`Page ${item.page}`}
                  onClick={() => onChange(item.page)}
                >
                  {item.page}
                </Button>
              </li>
            )
        )}
      </ul>
      {current < pageCount && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(current + 1)}
        >
          {nextLabel}
        </Button>
      )}
    </nav>
  )
}
