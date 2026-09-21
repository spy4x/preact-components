/**
 * The host page's demo of `useUrlFilters` — the one piece of `@preact-components/signals` that
 * cannot be shown as a card in the catalogue.
 *
 * The catalogue demonstrates components, and this is a hook: it has no markup of its own, and what
 * it does is bind a set of signals to the query string in both directions. Proving that needs a
 * page that owns an address, so it lives here, in the host application, rather than in
 * `ui-guide/`'s registry. `pages/checks/signals.ts` drives exactly this section.
 *
 * It mounts with the page. Mounting writes nothing — the hook writes only when the query string
 * would come out different — so a reader who never touches a control keeps the address they arrived
 * on, fragment route included. Touching one is a different matter, and the section says so where a
 * reader can read it: the router's `navigate` pushes `pathname?search`, which carries no fragment,
 * so a filter change takes this page's own `#/…` route out of the address bar.
 *
 * An earlier version of this file hid the card behind a "start the demo" button for exactly that
 * reason. The button is gone because the reason is: the write that ate the fragment was the one the
 * hook made at mount without changing anything, and it no longer happens.
 */

import { useSignal } from "@preact/signals"
import { type FilterField, useUrlFilters } from "@preact-components/signals/use-url-filters"
import { buttonClasses } from "@preact-components/ui/button"
import { useState } from "preact/hooks"
import { Link, Router } from "wouter-preact"

/** Classes shared by the links and the buttons that drive the demo. */
const CONTROL = buttonClasses("outline", "sm", "font-mono")

/** The sizes the `size` filter accepts; anything else in the address falls back to `md`. */
const SIZES = ["sm", "md", "lg"] as const

/** One of {@link SIZES}. */
type Size = typeof SIZES[number]

/**
 * The `size` field: a filter whose parameter has to be validated rather than read.
 *
 * `parser` is the hook's escape hatch for exactly that. `?size=huge` is an address a reader can
 * type, and an application that let it through would hand the rest of the page a size it cannot
 * render, so the parser answers with the default instead. The field is here because without it
 * nothing in this demo would exercise that branch.
 *
 * @param signal The signal the card renders and the hook writes into.
 * @returns The field description `useUrlFilters` takes.
 */
function sizeField(signal: FilterField<Size>["signal"]): FilterField<Size> {
  return {
    signal,
    urlParam: "size",
    initialValue: "md",
    parser: (value) => SIZES.includes(value as Size) ? value as Size : "md",
  }
}

/**
 * The section: what the hook does, and a card bound to this page's address bar.
 *
 * The card is keyed on a counter, so `remount` throws the old one away and mounts a new one against
 * whatever the address says by then. That is not a seam cut for the check: arriving on a filtered
 * address is what a deep link into a filtered list does, and remounting is the only way to show it
 * without reloading the page.
 *
 * `ssrPath` and `ssrSearch` on the `Router` are wouter's own answer to rendering where there is no
 * address: with them the router reads those two snapshots instead of `location`, which does not
 * exist in Deno, so the build prerenders this card like every other. A browser ignores them
 * entirely, so what hydrates is the ordinary browser router reading the real address bar.
 */
export function UrlFilterDemo() {
  const [instance, setInstance] = useState(0)

  return (
    <section data-e2e="url-filters" class="border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Filters in the address bar
      </h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        <code>useUrlFilters</code> from <code>@preact-components/signals</code>{" "}
        binds a set of signals to the query string both ways: the links below change the address and
        the filters follow, the buttons change the filters and the address follows. It is a hook
        rather than a component, so it has no card in the catalogue.
      </p>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        Changing a filter rewrites the address through the router, and that rewrite carries no
        fragment — so it takes this page's own <code>#/…</code>{" "}
        route with it. Arriving, reading and remounting leave the address alone.
      </p>

      <Router ssrPath="/" ssrSearch="">
        <LiveFilters key={instance} />
      </Router>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">Card</span>
        <button
          type="button"
          data-e2e="url-filters-remount"
          onClick={() => setInstance((current) => current + 1)}
          class={CONTROL}
        >
          remount
        </button>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          a fresh card starts from whatever the address says
        </span>
      </div>
    </section>
  )
}

/**
 * Three filters bound to the address: `status`, a string defaulting to nothing; `page`, a number
 * defaulting to 1; and `size`, an allow-list with a custom parser. Every default is cleared from
 * the query string rather than written to it, which is what keeps an unfiltered address clean.
 */
function LiveFilters() {
  const status = useSignal("")
  const page = useSignal(1)
  const size = useSignal<Size>("md")
  const { filters, clearFilters } = useUrlFilters({
    status: { signal: status, urlParam: "status", initialValue: "" },
    page: { signal: page, urlParam: "page", initialValue: 1 },
    size: sizeField(size),
  })

  return (
    <div data-e2e="url-filters-live" class="mt-3 space-y-3">
      <dl class="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-sm">
        <div class="flex items-baseline gap-2">
          <dt class="text-gray-500 dark:text-gray-400">status</dt>
          <dd data-e2e="url-filters-status" class="text-gray-900 dark:text-gray-100">
            {filters.status.value || "(any)"}
          </dd>
        </div>
        <div class="flex items-baseline gap-2">
          <dt class="text-gray-500 dark:text-gray-400">page</dt>
          <dd data-e2e="url-filters-page" class="text-gray-900 dark:text-gray-100">
            {filters.page.value}
          </dd>
        </div>
        <div class="flex items-baseline gap-2">
          <dt class="text-gray-500 dark:text-gray-400">size</dt>
          <dd data-e2e="url-filters-size" class="text-gray-900 dark:text-gray-100">
            {filters.size.value}
          </dd>
        </div>
      </dl>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">Address → filters</span>
        <Link href="?status=open" data-e2e="url-filters-link-open" class={CONTROL}>
          ?status=open
        </Link>
        <Link href="?status=open&page=2" data-e2e="url-filters-link-page" class={CONTROL}>
          ?status=open&page=2
        </Link>
        <Link href="?size=lg" data-e2e="url-filters-link-size" class={CONTROL}>
          ?size=lg
        </Link>
        <Link href="?size=huge" data-e2e="url-filters-link-bad-size" class={CONTROL}>
          ?size=huge
        </Link>
        <Link href="?" data-e2e="url-filters-link-none" class={CONTROL}>
          ? (no filters)
        </Link>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">Filters → address</span>
        <button
          type="button"
          data-e2e="url-filters-set-closed"
          onClick={() => filters.status.value = "closed"}
          class={CONTROL}
        >
          status = closed
        </button>
        <button
          type="button"
          data-e2e="url-filters-next-page"
          onClick={() => filters.page.value = filters.page.value + 1}
          class={CONTROL}
        >
          next page
        </button>
        <button
          type="button"
          data-e2e="url-filters-clear"
          onClick={clearFilters}
          class={CONTROL}
        >
          clear
        </button>
      </div>
    </div>
  )
}
