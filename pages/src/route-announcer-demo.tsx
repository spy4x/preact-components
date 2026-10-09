/**
 * The host page's demo of `useRouteAnnouncer` from `@spy4x/preact-system`: a hook, so it has no
 * card in the catalogue. `pages/checks/system.ts` drives this section.
 *
 * The path is the section's own state, not the address bar: the catalogue routes by the address's
 * hash, and a demo that wrote to it would navigate the catalogue away. The hook takes the path as
 * input from any router, so a path held in state is exactly what it sees in an app. The page region
 * is passed as `main`, because the catalogue's own `<main>` already holds this section.
 *
 * `/inbox` draws an `<h1>`, `/settings` draws none, so the two show both places focus can land. The
 * title stays unset until the first press, so opening this page leaves the catalogue's own tab title
 * alone.
 */

import { useRouteAnnouncer } from "@spy4x/preact-system/route-announcer"
import { buttonClasses } from "@spy4x/preact-ui/button"
import { useRef, useState } from "preact/hooks"

/** The routes the demo can show, in the order of their buttons, each with its button's hook. */
const ROUTES = [
  { e2e: "inbox", path: "/inbox" },
  { e2e: "filter", path: "/inbox?filter=open" },
  { e2e: "settings", path: "/settings" },
]

/** The page's name, for its heading and its title. */
function pageName(path: string): string {
  return path.startsWith("/settings") ? "Settings" : "Inbox"
}

/** The section: what the hook does, buttons that change the path, and the page they show. */
export function RouteAnnouncerDemo() {
  const [path, setPath] = useState(ROUTES[0].path)
  const [navigated, setNavigated] = useState(false)
  const page = useRef<HTMLDivElement>(null)

  useRouteAnnouncer({
    path,
    title: navigated ? `${pageName(path)} — route demo` : undefined,
    main: page,
  })

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
            onClick={() => {
              setPath(route.path)
              setNavigated(true)
            }}
            class={buttonClasses("outline", "sm", "font-mono")}
          >
            {route.path}
          </button>
        ))}
      </div>
      <div
        ref={page}
        data-e2e="route-demo-page"
        class="mt-3 rounded border border-gray-200 p-4 dark:border-gray-700"
      >
        {pageName(path) === "Inbox"
          ? <h1 class="text-base font-semibold text-gray-900 dark:text-gray-100">Inbox</h1>
          : null}
        <p class="text-sm text-gray-600 dark:text-gray-300">
          Showing <code data-e2e="route-demo-path">{path}</code>
        </p>
      </div>
    </section>
  )
}
