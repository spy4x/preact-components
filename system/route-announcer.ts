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
   * The page's name for `document.title` — `store.head.value.title`, when the app keeps a head
   * store from `createHeadStore`. Written on mount and whenever it changes. Left out, `document.title` is not touched: the
   * app sets it some other way, such as `SEOHead` in a framework that updates the head itself.
   */
  title?: string
  /**
   * The element that holds the page. Defaults to the document's first `<main>`. Pass one when the
   * page lives somewhere else, or when the document has more than one region that could be it.
   */
  main?: RefObject<HTMLElement>
  /**
   * Leave focus where the new page put it. A page may focus one of its own controls as it opens,
   * such as a search field reached by a keyboard shortcut. With `true`, a route change during which
   * focus moved to an element inside `main` sets the title and moves no focus, so the reader hears
   * that control once and not the heading before it. Focus that stayed where it was, on the link
   * that was pressed for instance, still goes to the heading. Defaults to `false`: focus goes to
   * the heading on every route change.
   */
  keepPageFocus?: boolean
}

/** The path without its query string and fragment. */
function pathname(path: string): string {
  return path.split(/[?#]/, 1)[0]
}

/**
 * The element that names the current page: the first `<h1>` inside `main`, or `main` itself while
 * the page has no `<h1>`. `null` when there is no `main`, or no document (on a server).
 *
 * It is where {@link useRouteAnnouncer} moves focus, and what to pass as `returnFocus` to a
 * component that leaves the page while focus is inside it, such as `InstallPrompt`: the reader
 * lands on the page's heading instead of the page body. Neither element is focusable by itself, so
 * the one returned gets `tabindex="-1"` unless it already has a `tabindex`: focusable from script,
 * still out of the Tab order. An `<h1>` outside `main` is never returned.
 *
 * It reads the document, so call it from an event handler or an effect, not during a render.
 *
 * ```tsx
 * <InstallPrompt mode={mode} onInstall={install} onDismiss={dismiss} returnFocus={pageHeading} />
 * ```
 *
 * @param main The element that holds the page. Defaults to the document's first `<main>`.
 * @returns The heading or the page, ready for `focus()`, or `null`.
 */
export function pageHeading(main?: HTMLElement | null): HTMLElement | null {
  if (typeof document === "undefined") return null
  const page = main ?? document.querySelector<HTMLElement>("main")
  if (!page) return null
  const target = page.querySelector<HTMLElement>("h1") ?? page
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
  return target
}

/**
 * On a route change, set `document.title` and move focus to the new page's main heading.
 *
 * Focus goes to {@link pageHeading}: the first `<h1>` inside `main` (the document's first `<main>`
 * by default), or `main` itself when the page has no `<h1>`. Neither is focusable by itself, so the
 * element gets `tabindex="-1"` unless it already has a `tabindex`: focusable from script, still out
 * of the Tab order. The first render moves no focus — on a page load the browser has already put the reader at
 * the top of the document, and taking focus there would skip the skip link. A change of query
 * string or fragment alone moves no focus either. With `keepPageFocus`, neither does a route change
 * during which the new page focused one of its own controls.
 *
 * Call it once, in the layout that wraps every route, below the router so it re-renders with each
 * path. It runs after the render that shows the new path, so a page that renders its heading in
 * that render gets the heading; a page still loading gets `main`.
 *
 * ```tsx
 * const [path] = useLocation()
 * useRouteAnnouncer({ path, title: store.head.value.title })
 * ```
 *
 * @param options See {@link RouteAnnouncerOptions}.
 */
export function useRouteAnnouncer(
  { path, title, main, keepPageFocus = false }: RouteAnnouncerOptions,
): void {
  const current = pathname(path)
  const shown = useRef(current)
  // Where focus moved since the render that first showed the current path: the new page's doing.
  // Focus that arrived earlier, on the link that was pressed, is forgotten by that render.
  const taken = useRef<EventTarget | null>(null)
  if (shown.current !== current) taken.current = null

  useEffect(() => {
    if (title !== undefined) document.title = title
  }, [title])

  useEffect(() => {
    if (!keepPageFocus) return
    const note = (event: FocusEvent) => {
      taken.current = event.target
    }
    document.addEventListener("focusin", note)
    return () => document.removeEventListener("focusin", note)
  }, [keepPageFocus])

  useEffect(() => {
    if (shown.current === current) return
    shown.current = current
    const page = main?.current ?? document.querySelector<HTMLElement>("main")
    const active = document.activeElement
    const byThePage = keepPageFocus && active !== null && active === taken.current &&
      active !== page && Boolean(page?.contains(active))
    if (byThePage) return
    pageHeading(main?.current)?.focus()
  }, [current])
}
