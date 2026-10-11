/**
 * The host page's demo of `CrudList` with its search term and page number kept in the address.
 *
 * `CrudList` takes `query` and `page` as signals so that an application can bind them to
 * `?q=` and `?page=`. Proving that needs a page that owns an address, the same reason
 * {@link UrlFilterDemo} lives here rather than as a catalogue card. It sits under the CRUD page's
 * catalogue, so its `?q=` and `?page=` never meet the ones {@link UrlFilterDemo} owns on the UI
 * page: only one of the two is mounted at a time.
 *
 * What the demo is there to show: an address that names both a search and a page opens on that
 * page, and the list's own search goes back to page 1 as one history entry. `pages/e2e/crud.spec.ts`
 * drives it.
 */

import { useSignal } from "@preact/signals"
import { CrudList } from "@spy4x/preact-crud/crud-list"
import type { CrudModel } from "@spy4x/preact-crud/types"
import { type FilterField, useUrlFilters } from "@spy4x/preact-signals/use-url-filters"
import { search } from "@spy4x/platform/universal/text"
import { Router } from "wouter-preact"

/** One team; the list needs no more than a name to search and page. */
interface Team extends CrudModel {
  name: string
}

/** Fixed set, so a browser spec can name the rows of a page: five of the six contain an "a". */
const teams: Team[] = [
  { id: 1, name: "Platform" },
  { id: 2, name: "Design" },
  { id: 3, name: "Data" },
  { id: 4, name: "Sales" },
  { id: 5, name: "Marketing" },
  { id: 6, name: "Legal" },
]

/**
 * The section: a paged `CrudList` whose `query` and `page` are the address's `?q=` and `?page=`.
 *
 * `Router` is wouter's own, as in {@link UrlFilterDemo}: `ssrPath` and `ssrSearch` let this
 * prerender in Deno, where `location` does not exist, and a browser reads the real address.
 */
export function CrudListUrlDemo() {
  return (
    <section data-e2e="crud-list-url" class="border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        CrudList, searched and paged from the address bar
      </h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        <code>CrudList</code>'s <code>query</code> and <code>page</code>{" "}
        are signals the caller may own. Here they are <code>?q=</code> and{" "}
        <code>?page=</code>, bound through{" "}
        <code>useUrlFilters</code>: an address with both opens on that page, and a search typed into
        the list goes back to page 1 in one step of the browser's history.
      </p>

      <Router ssrPath="/" ssrSearch="">
        <LiveList />
      </Router>
    </section>
  )
}

function LiveList() {
  const rows = useSignal(teams)
  const q: FilterField<string> = { signal: useSignal(""), urlParam: "q", initialValue: "" }
  const page: FilterField<number> = { signal: useSignal(1), urlParam: "page", initialValue: 1 }
  const { filters } = useUrlFilters({ q, page })

  return (
    // `Table` bleeds 16px past its container below `md`; the guide's page column clips at its own
    // edge, so the padding is given back here.
    <div data-e2e="crud-list-url-live" class="mt-3 px-4 md:px-0">
      <CrudList
        rows={rows}
        title="Teams"
        headingLevel={3}
        match={(row, word) => search(row.name, word)}
        query={filters.q}
        page={filters.page}
        pageSize={2}
        searchFieldLabel="Team name in the address"
        searchLabel="Search the addressed teams"
        paginationLabels={{ label: "Pages of addressed teams" }}
        class="w-full"
        header={<th scope="col" class="text-left">Name</th>}
        row={(row) => <td class="text-foreground">{row.name}</td>}
      />
    </div>
  )
}
