/**
 * Tell keyboard and screen-reader users that a client-side route change happened.
 *
 * A router that swaps the page without a load leaves focus on the link that was pressed and the
 * tab title on the previous page, so a screen reader announces nothing. {@link useRouteAnnouncer}
 * does what a real page load would: it names the page in `document.title` and moves focus to the
 * new page's main heading.
 */

import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/** Options of {@link useRouteAnnouncer}. */
export interface RouteAnnouncerOptions {
  /**
   * The current route, from whatever router the app uses: wouter's `useLocation()[0]`, a hash
   * router's path, or `location.pathname`. Everything from the first `?` or `#` is ignored, so a
   * change of query string or fragment alone is not a new page.
   */
  path: string
  /**
   * The page's name for `document.title` — the head store's `head.value.title`, when the app keeps
   * one. Written on mount and whenever it changes. Left out, `document.title` is not touched: the
   * app sets it some other way, such as `SEOHead` in a framework that updates the head itself.
   */
  title?: string
  /**
   * The element that holds the page. Defaults to the document's first `<main>`. Pass one when the
   * page lives somewhere else, or when the document has more than one region that could be it.
   */
  main?: RefObject<HTMLElement>
}

/** The path without its query string and fragment. */
function pathname(path: string): string {
  return path.split(/[?#]/, 1)[0]
}

/**
 * On a route change, set `document.title` and move focus to the new page's main heading.
 *
 * Focus goes to the first `<h1>` inside `main` (the document's first `<main>` by default), or to
 * `main` itself when the page has no `<h1>`. Neither is focusable by itself, so the element gets
 * `tabindex="-1"` unless it already has a `tabindex`: focusable from script, still out of the Tab
 * order. The first render moves no focus — on a page load the browser has already put the reader at
 * the top of the document, and taking focus there would skip the skip link. A change of query
 * string or fragment alone moves no focus either.
 *
 * Call it once, in the layout that wraps every route, below the router so it re-renders with each
 * path. It runs after the render that shows the new path, so a page that renders its heading in
 * that render gets the heading; a page still loading gets `main`.
 *
 * ```tsx
 * const [path] = useLocation()
 * useRouteAnnouncer({ path, title: head.value.title })
 * ```
 *
 * @param options See {@link RouteAnnouncerOptions}.
 */
export function useRouteAnnouncer({ path, title, main }: RouteAnnouncerOptions): void {
  const current = pathname(path)
  const shown = useRef(current)

  useEffect(() => {
    if (title !== undefined) document.title = title
  }, [title])

  useEffect(() => {
    if (shown.current === current) return
    shown.current = current
    const page = main?.current ?? document.querySelector("main")
    if (!page) return
    const target = page.querySelector<HTMLElement>("h1") ?? page
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
    target.focus()
  }, [current])
}
