import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

export interface TableProps {
  /** Cells of the single header row, normally `<th>` elements. */
  headerSlot: ComponentChildren
  /** One entry per body row; each entry is the row's `<td>` list. */
  bodySlots: ComponentChildren[]
  /**
   * Optional identity of each body row, one per entry in `bodySlots`, in the same order.
   *
   * Given, each `<tr>` is keyed by its entry here instead of by its position, so when the caller
   * reorders `bodySlots` — a sort, a page turn, a row inserted above — Preact moves the row's DOM
   * element, and whatever that element holds (a ticked checkbox, a half-typed input, focus, a
   * component's own state), along with it. Omitted, rows are keyed by position, as they always
   * were: state then stays at its old position and describes whichever row lands there.
   *
   * Keys have to be distinct within one table, the ordinary rule for any keyed list; that is not
   * checked. A length that differs from `bodySlots`' is: it throws, because a row with no key of its
   * own would silently fall back to position and bring the bug back for that row alone.
   */
  bodyKeys?: readonly (string | number)[]
  /** Optional `<tfoot>` content. */
  footerSlot?: ComponentChildren
  /**
   * Optional `<caption>` content, the table's accessible name.
   *
   * Omitted, `null` or `false` — the three ways a conditional expression such as
   * `caption={title && title}` says "nothing" — no `<caption>` is rendered at all, the same as
   * Preact renders none of those three as content anywhere else. A caller naming the table through
   * `aria-label`/`aria-labelledby` on a wrapper is unaffected. Anything else passed renders, `0`
   * and `""` included, so a caller whose caption happens to be falsy-but-real still gets one.
   * `captionClass` is how a caller hides it visually (`"sr-only"`) while keeping it for assistive
   * tech; this primitive applies no caption styling of its own beyond the browser default.
   */
  caption?: ComponentChildren
  /** Extra utilities for the `<caption>`. Ignored when `caption` is omitted. */
  captionClass?: string
  /** Sets `data-e2e` on every body row, for end-to-end selectors. */
  rowDataE2E?: string
  class?: string
}

const wrapper = "bg-surface ring-1 ring-subtle rounded-lg pb-px overflow-x-auto min-h-[300px]"

/**
 * Whether `caption` means "render one", as opposed to one of the three values a conditional
 * expression produces for "nothing": `undefined`, `null` and `false`. Anything else — including
 * `0` and `""` — renders, so a caller whose real caption happens to be falsy still gets one.
 */
function hasCaption(caption: ComponentChildren): boolean {
  return caption !== undefined && caption !== null && caption !== false
}

/**
 * Table shell with header, body and optional footer slots.
 *
 * Rows are rendered from `bodySlots`, so the caller keeps control of cell content while the
 * primitive owns the divider, hover and spacing utilities. The wrapper scrolls horizontally
 * instead of overflowing the page on narrow screens. Pass `bodyKeys` whenever rows can reorder
 * and carry state of their own; without it a body row is keyed by its position.
 */
export function Table(
  {
    headerSlot,
    bodySlots,
    bodyKeys,
    footerSlot,
    caption,
    captionClass,
    rowDataE2E,
    class: className,
  }: TableProps,
): JSX.Element {
  if (bodyKeys !== undefined && bodyKeys.length !== bodySlots.length) {
    throw new Error(
      `Table: bodyKeys has ${bodyKeys.length} entries for ${bodySlots.length} bodySlots; ` +
        "give every body row a key, or none",
    )
  }

  return (
    <div class={cn(wrapper, className)}>
      <table class="min-w-full divide-y divide-subtle">
        {hasCaption(caption) && <caption class={captionClass}>{caption}</caption>}
        <thead class="bg-canvas">
          <tr class="*:whitespace-nowrap *:px-6 *:py-3 text-sm font-medium text-foreground">
            {headerSlot}
          </tr>
        </thead>
        <tbody class="divide-y divide-subtle bg-surface pc-focus-offset-surface">
          {bodySlots.map((bodySlot, index) => (
            <tr
              key={bodyKeys === undefined ? index : bodyKeys[index]}
              class="text-sm *:px-6 *:py-4 hover:bg-hover"
              data-e2e={rowDataE2E}
            >
              {bodySlot}
            </tr>
          ))}
        </tbody>
        {footerSlot && <tfoot class="bg-canvas">{footerSlot}</tfoot>}
      </table>
    </div>
  )
}
