/**
 * The host page's demo of `DataTable`'s sort state bound to the address bar.
 *
 * `DataTable` holds no sort state of its own — the caller owns `sort` and writes it back through
 * `onSortChange` — so proving it can live in a URL parameter needs a page that owns an address,
 * the same reason {@link UrlFilterDemo} lives here rather than as a catalogue card. It sits next to
 * that demo and reuses the same hook, `useUrlFilters`, with `parseSort`/`serializeSort` doing the
 * one conversion `useUrlFilters` itself does not know about: a `SortRule[]` is not a string, so the
 * bound field carries the serialized form and this component parses it back on every render.
 *
 * Paging is left out on purpose. This demo exists to prove the sort round trip, and `page` would
 * either collide with {@link UrlFilterDemo}'s own `?page=` or need a parameter name invented just
 * for this card — neither is worth it for a demo with three rows.
 *
 * `pages/checks/ui.ts` drives this section, in the `ui` package block, which `pages/verify.ts`
 * runs after the `signals` block that drives {@link UrlFilterDemo}. That ordering is what keeps the
 * two demos' `history` writes apart: `UrlFilterDemo`'s checks finish, and restore the address they
 * started from, before this one presses anything.
 *
 * This component owns the real `?sort=` parameter — the same name `pages/checks/signals.ts` pushes
 * as its own example of a parameter `useUrlFilters` does *not* own, in the checks that prove a
 * foreign parameter survives a write next to it. The two have been measured not to interfere: a
 * build and verify run at the commit before this file existed and one at head produce identical
 * `signals/` block output, `history.length` counts included, and this file's own checks start from
 * an empty query string. A parameter added to either demo later should keep that measurement
 * rather than assume it still holds.
 */

import { useSignal } from "@preact/signals"
import { type FilterField, useUrlFilters } from "@preact-components/signals/use-url-filters"
import { parseSort, serializeSort, type SortRule } from "@preact-components/signals/table-state"
import { DataTable } from "@preact-components/ui/data-table"
import { Router } from "wouter-preact"

/** One customer order, small enough that sorting three rows is easy to read off the page. */
interface Order {
  id: string
  customer: string
  total: number
}

/** Fixed set, so a browser check can assert on exact rows rather than guess at fixtures. */
const orders: Order[] = [
  { id: "ord-1", customer: "Grace", total: 340 },
  { id: "ord-2", customer: "Ada", total: 120 },
  { id: "ord-3", customer: "Katherine", total: 75 },
]

/** Columns `sort` is allowed to name — the allow-list `parseSort` checks an incoming value against. */
const SORTABLE_KEYS = ["customer", "total"] as const

/** One of {@link SORTABLE_KEYS}. */
type OrderKey = typeof SORTABLE_KEYS[number]

/**
 * The `sort` field: a filter whose value is a serialized `SortRule[]`, not a plain string a reader
 * would type. `useUrlFilters` only ever reads and writes the string; `parseSort`/`serializeSort` are
 * what turn that string into the rules `DataTable` takes and back, both inside this component.
 */
function sortField(signal: FilterField<string>["signal"]): FilterField<string> {
  return { signal, urlParam: "sort", initialValue: "none" }
}

/**
 * The section: a `DataTable` whose `sort` prop is read from the address and whose `onSortChange`
 * writes back to it.
 *
 * `Router` is wouter's own, the same one {@link UrlFilterDemo} wraps its live card in: `ssrPath` and
 * `ssrSearch` are what let this prerender in Deno, where `location` does not exist, and a browser
 * ignores both and reads the real address bar instead.
 */
export function DataTableSortDemo() {
  return (
    <section
      data-e2e="data-table-sort-url"
      class="border-t border-gray-200 pt-6 dark:border-gray-700"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        DataTable, sorted from the address bar
      </h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        <code>DataTable</code>'s <code>sort</code> prop is caller-owned state, the same as{" "}
        <code>Pagination</code>'s <code>page</code>. Here it is a <code>?sort=</code>{" "}
        parameter, bound through{" "}
        <code>useUrlFilters</code>: press a column header and the address changes with it.
      </p>

      <Router ssrPath="/" ssrSearch="">
        <LiveSort />
      </Router>
    </section>
  )
}

function LiveSort() {
  const sortValue = useSignal("none")
  const { filters } = useUrlFilters({ sort: sortField(sortValue) })

  const sort = parseSort<OrderKey>(filters.sort.value, SORTABLE_KEYS, [])
  const onSortChange = (next: SortRule<OrderKey>[]) => {
    filters.sort.value = serializeSort(next)
  }

  return (
    // `Table` bleeds 16px past its container below `md`, to reach a phone's edge from a page's own
    // padding; the guide's page column clips at its own edge, so the padding is given back here.
    <div data-e2e="data-table-sort-url-live" class="mt-3 px-4 md:px-0">
      <DataTable
        caption="Orders"
        columns={[
          { key: "customer", header: "Customer", sortable: true },
          { key: "total", header: "Total", sortable: true, align: "right" },
        ]}
        rows={orders}
        rowKey={(row) => row.id}
        sort={sort}
        onSortChange={onSortChange}
      />
    </div>
  )
}
