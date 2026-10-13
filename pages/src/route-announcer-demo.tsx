/**
 * The host page's demo of `useRouteAnnouncer` from `@spy4x/preact-system`: a hook, so it has no
 * card in the catalogue. `pages/checks/system.ts` drives this section. Its last button calls
 * `pageHeading()` from the same module, which `pages/e2e/system.spec.ts` drives.
 *
 * The path is the section's own state, not the address bar: the catalogue routes by the address's
 * hash, and a demo that wrote to it would navigate the catalogue away. The hook takes the path as
 * input from any router, so a path held in state is exactly what it sees in an app. The page region
 * is passed as `main`, because the catalogue's own `<main>` already holds this section.
 *
 * `/inbox` draws an `<h1>` (announced as level 3, since the catalogue's System page has its own
 * `<h1>`), `/settings` draws none, so the two show both places focus can land. The
 * title stays unset until the first press, so opening this page leaves the catalogue's own tab title
 * alone.
 *
 * `/search` draws an `<h1>` and a field that focuses itself as the page opens, and the checkbox
 * turns the hook's `keepPageFocus` on: with it focus stays in the field, without it focus goes on
 * to the heading. The button inside the page changes the route and stays in the page, so it shows
 * that focus which did not move goes to the new page either way.
 */

import { pageHeading, useRouteAnnouncer } from "@spy4x/preact-system/route-announcer"
import { buttonClasses } from "@spy4x/preact-ui/button"
import { useEffect, useRef, useState } from "preact/hooks"

/** The routes the demo can show, in the order of their buttons, each with its button's hook. */
const ROUTES = [
  { e2e: "inbox", path: "/inbox" },
  { e2e: "filter", path: "/inbox?filter=open" },
  { e2e: "fragment", path: "/inbox#unread" },
  { e2e: "settings", path: "/settings" },
  { e2e: "search", path: "/search" },
]

/** The page's name, for its heading and its title. */
function pageName(path: string): string {
  if (path.startsWith("/search")) return "Search"
  return path.startsWith("/settings") ? "Settings" : "Inbox"
}

/** A field that takes focus as its page opens, the way a search page reached by a shortcut does. */
function SearchField() {
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => field.current?.focus(), [])
  return (
    <label class="mt-2 flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
      Search
      <input
        ref={field}
        type="search"
        data-e2e="route-demo-search"
        class="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
      />
    </label>
  )
}

/** The section: what the hook does, buttons that change the path, and the page they show. */
export function RouteAnnouncerDemo() {
  const [path, setPath] = useState(ROUTES[0].path)
  const [navigated, setNavigated] = useState(false)
  const [keepPageFocus, setKeepPageFocus] = useState(false)
  const page = useRef<HTMLDivElement>(null)

  useRouteAnnouncer({
    path,
    title: navigated ? `${pageName(path)} — route demo` : undefined,
    main: page,
    keepPageFocus,
  })
  const go = (to: string) => {
    setPath(to)
    setNavigated(true)
  }

  return (
    <section data-e2e="route-demo" class="border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Route changes</h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        <code>useRouteAnnouncer</code> from <code>@spy4x/preact-system</code>{" "}
        moves focus to the new page's heading, or to the page when it has none, and names the page
        in the tab title. A change of query string alone keeps focus where it is.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        {ROUTES.map((route) => (
          <button
            key={route.path}
            type="button"
            data-e2e={`route-demo-go-${route.e2e}`}
            aria-pressed={route.path === path}
            onClick={() => go(route.path)}
            class={buttonClasses("outline", "sm", "font-mono")}
          >
            {route.path}
          </button>
        ))}
      </div>
      <label class="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          data-e2e="route-demo-keep-page-focus"
          checked={keepPageFocus}
          onChange={(event) => setKeepPageFocus(event.currentTarget.checked)}
        />
        <span>
          <code>keepPageFocus</code>: <code>/search</code>{" "}
          focuses its own field as it opens, and focus stays there instead of moving to the heading
        </span>
      </label>
      <p class="measure mt-3 text-sm text-gray-600 dark:text-gray-300">
        <code>pageHeading()</code>{" "}
        is the same target without a route change: this guide page's heading, or its{" "}
        <code>main</code> without one. Pass it as <code>returnFocus</code>{" "}
        to a component that leaves the page.
      </p>
      <div class="mt-3">
        <button
          type="button"
          data-e2e="route-demo-page-heading"
          onClick={() => pageHeading()?.focus()}
          class={buttonClasses("outline", "sm")}
        >
          Focus the page heading
        </button>
      </div>
      <div
        ref={page}
        data-e2e="route-demo-page"
        class="mt-3 rounded border border-gray-200 p-4 dark:border-gray-700"
      >
        {pageName(path) === "Settings" ? null : (
          // aria-level: the hook looks for an h1, but on the catalogue's System page this is a
          // sub-heading, not a second page title.
          <h1 aria-level={3} class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {pageName(path)}
          </h1>
        )}
        <p class="text-sm text-gray-600 dark:text-gray-300">
          Showing <code data-e2e="route-demo-path">{path}</code>
        </p>
        {pageName(path) === "Search" ? <SearchField /> : null}
        <div class="mt-2">
          <button
            type="button"
            data-e2e="route-demo-in-page"
            onClick={() => go(pageName(path) === "Inbox" ? "/settings" : "/inbox")}
            class={buttonClasses("outline", "sm")}
          >
            {pageName(path) === "Inbox" ? "Open /settings" : "Open /inbox"}
          </button>
        </div>
      </div>
    </section>
  )
}
