/**
 * The host page's demo of `useUrlFilters` — the one piece of `@preact-components/signals` that
 * cannot be shown as a card in the catalogue.
 *
 * The catalogue demonstrates components, and this is a hook: it has no markup of its own, and what
 * it does is bind a set of signals to the query string in both directions. Proving that needs a
 * page that owns an address, so it lives here, in the host application, rather than in
 * `ui-guide/`'s registry. `pages/checks/signals.ts` drives exactly this section.
 *
 * **Why it starts on a click.** The hook writes the filters back through the router as soon as it
 * has read them, and the router's own `navigate` pushes `pathname?search` — an address with no
 * fragment. This page routes by fragment (`#/inputs/toggle-switch`), so a demo that mounted with
 * the page would take the route out of the address bar of every reader who never asked for one.
 * Starting it is therefore the reader's decision, the section says what it takes over, and a reader
 * who does not press the button gets the page exactly as it was.
 */

import { useSignal } from "@preact/signals"
import { useUrlFilters } from "@preact-components/signals/use-url-filters"
import { buttonClasses } from "@preact-components/ui/button"
import { useState } from "preact/hooks"
import { Link } from "wouter-preact"

/** Classes shared by the links and the buttons that drive the demo. */
const CONTROL = buttonClasses("outline", "sm", "font-mono")

/**
 * The section: an explanation, and the live demo once the reader starts it.
 *
 * Until then it renders the button alone, which is also what the build prerenders — `useUrlFilters`
 * reads the address through the router, and there is no address in Deno, so the live half must
 * never be part of the server render.
 */
export function UrlFilterDemo() {
  const [started, setStarted] = useState(false)

  return (
    <section data-e2e="url-filters" class="border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Filters in the address bar
      </h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        <code>useUrlFilters</code> from <code>@preact-components/signals</code>{" "}
        binds a set of signals to the query string both ways: the links below change the address and
        the filters follow, the buttons change the filters and the address follows.
      </p>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        It is a hook rather than a component, so it has no card in the catalogue. Starting it hands
        the query string over, and the filters the hook writes back through the router replace the
        whole address — including the <code>#/…</code>{" "}
        route this page uses for its own navigation. That is why it waits to be asked.
      </p>

      {started ? <LiveFilters /> : (
        <button
          type="button"
          data-e2e="url-filters-run"
          onClick={() => setStarted(true)}
          class={buttonClasses("outline", "sm", "mt-3")}
        >
          Start the demo
        </button>
      )}
    </section>
  )
}

/**
 * Two filters bound to the address: `status`, a string defaulting to nothing, and `page`, a number
 * defaulting to 1. Both defaults are cleared from the query string rather than written to it, which
 * is what keeps a URL with no filters clean.
 */
function LiveFilters() {
  const status = useSignal("")
  const page = useSignal(1)
  const { filters, clearFilters } = useUrlFilters({
    status: { signal: status, urlParam: "status", initialValue: "" },
    page: { signal: page, urlParam: "page", initialValue: 1 },
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
      </dl>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">Address → filters</span>
        <Link href="?status=open" data-e2e="url-filters-link-open" class={CONTROL}>
          ?status=open
        </Link>
        <Link href="?status=open&page=2" data-e2e="url-filters-link-page" class={CONTROL}>
          ?status=open&page=2
        </Link>
        <Link href="?" data-e2e="url-filters-link-none" class={CONTROL}>
          ?
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
