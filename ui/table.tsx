import { cn } from "@preact-components/signals/cn"
import type { ComponentChildren } from "preact"

export interface TableProps {
  /** Cells of the single header row, normally `<th>` elements. */
  headerSlot: ComponentChildren
  /** One entry per body row; each entry is the row's `<td>` list. */
  bodySlots: ComponentChildren[]
  /** Optional `<tfoot>` content. */
  footerSlot?: ComponentChildren
  /** Sets `data-e2e` on every body row, for end-to-end selectors. */
  rowDataE2E?: string
  class?: string
}

const wrapper =
  "-mx-4 md:mx-0 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-600 sm:rounded-lg pb-px overflow-x-auto min-h-[300px]"

/**
 * Table shell with header, body and optional footer slots.
 *
 * Rows are rendered from `bodySlots`, so the caller keeps control of cell content while the
 * primitive owns the divider, hover and spacing utilities. The wrapper scrolls horizontally
 * instead of overflowing the page on narrow screens.
 */
export function Table(
  { headerSlot, bodySlots, footerSlot, rowDataE2E, class: className }: TableProps,
) {
  return (
    <div class={cn(wrapper, className)}>
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
        <thead class="bg-gray-50 dark:bg-gray-700">
          <tr class="*:whitespace-nowrap *:px-6 *:py-3 text-sm font-medium text-gray-900 dark:text-gray-200">
            {headerSlot}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-600 bg-white dark:bg-gray-800">
          {bodySlots.map((bodySlot, index) => (
            <tr
              key={index}
              class="text-sm *:px-6 *:py-4 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              data-e2e={rowDataE2E}
            >
              {bodySlot}
            </tr>
          ))}
        </tbody>
        {footerSlot && <tfoot class="bg-gray-50 dark:bg-gray-700">{footerSlot}</tfoot>}
      </table>
    </div>
  )
}
