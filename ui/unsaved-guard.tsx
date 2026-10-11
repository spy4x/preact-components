/**
 * `UnsavedGuard` — asks before a person leaves a page with changes they have not saved.
 *
 * Four ways out of a page are covered: closing or reloading the tab, which gets the browser's own
 * question through `beforeunload`; a click on an in-app link, which is held back and answered with
 * a {@link ConfirmDialog}; a navigation the app starts from code, such as a sidebar button or a
 * keyboard shortcut, once the app sends it through a {@link LeaveGuard}; and the browser's Back and
 * Forward buttons, in a browser that has the Navigation API. The guard does not cancel that step:
 * it puts the page's address back the moment it changes, before the app's router has looked at it,
 * and then asks in the same dialog. Cancelling the step, with the Navigation API's `navigate`
 * event, is the other design and is not built here.
 */

import type { JSX } from "preact"
import { useEffect, useMemo, useRef } from "preact/hooks"
import { ConfirmDialog } from "./confirm-dialog.tsx"
import { type ClickModifiers, isPlainClick } from "./link.tsx"
import {
  createLeaveGuard,
  holdHistory,
  type LeaveGuard,
  leaveGuardInternals,
} from "./unsaved-guard-internals.ts"

/** The parts of a click that decide whether the browser would follow a link in this tab. */
export interface UnsavedClick extends ClickModifiers {
  defaultPrevented: boolean
}

/** The parts of a link that decide where it goes. */
export interface UnsavedLink {
  /** The resolved address, as `HTMLAnchorElement.href` gives it. */
  href: string
  /** The `target` attribute, or `null` without one. */
  target: string | null
  /** Whether the link has a `download` attribute. */
  download: boolean
  /** Whether the link is marked `data-unsaved-ok`: it acts on this page and leaves nothing behind. */
  allowed: boolean
}

/**
 * The in-app address a click must be held back for while there are unsaved changes, as
 * `pathname + search + hash`; `null` when the browser or the link itself should handle the click.
 *
 * It returns `null` for a click that is already cancelled, a button other than the main one, a
 * modifier key, a link with a `target` other than `_self`, a `download` link, a link marked
 * `data-unsaved-ok`, another origin, an address `owns` says the app's router does not handle (a
 * server route, an API path), and a link that only moves to a fragment of this same page,
 * including an empty one (`href="#"`).
 *
 * @param click The click, or any object with the same fields.
 * @param link The link that was clicked.
 * @param here The page the click happened on, usually `location`.
 * @param owns Whether the app's router handles an address.
 */
export function guardedHref(
  click: UnsavedClick,
  link: UnsavedLink,
  here: { href: string },
  owns: (url: URL) => boolean,
): string | null {
  if (click.defaultPrevented || !isPlainClick(click)) return null
  if (link.target && link.target.toLowerCase() !== "_self") return null
  if (link.download || link.allowed) return null
  const page = new URL(here.href)
  const url = new URL(link.href, page)
  if (url.origin !== page.origin || !owns(url)) return null
  // `url.hash` is "" for an empty fragment too, so `href="#"` is found by the "#" in the address.
  if (url.pathname === page.pathname && url.search === page.search && url.href.includes("#")) {
    return null
  }
  return `${url.pathname}${url.search}${url.hash}`
}

/** Every word the guard's dialog shows. */
export interface UnsavedGuardLabels {
  /** The dialog's title. Defaults to `"Leave without saving?"`. */
  title: string
  /** The sentence under it. Defaults to `"Your changes have not been saved. If you leave, they are lost."`. */
  message: string
  /** The button that leaves. Defaults to `"Leave"`. */
  leave: string
  /** The button that stays. Defaults to `"Stay"`. */
  stay: string
}

/** The English words of {@link UnsavedGuard}'s dialog. */
export const defaultUnsavedGuardLabels: UnsavedGuardLabels = {
  title: "Leave without saving?",
  message: "Your changes have not been saved. If you leave, they are lost.",
  leave: "Leave",
  stay: "Stay",
}

export { createLeaveGuard, type LeaveGuard }

export interface UnsavedGuardProps {
  /** Whether there are unsaved changes. The guard listens only while this is `true`. */
  when: boolean
  /** Moves the app's router to an address, after the person chose to leave by a link. */
  navigate: (href: string) => void
  /**
   * Whether the app's router handles an address. A same-origin link it does not own, such as a
   * server-rendered page or a file, is left to the browser, which then asks through `beforeunload`.
   */
  owns: (url: URL) => boolean
  /**
   * Called when the person chose to leave, just before the navigation, to drop the unsaved
   * changes.
   */
  onDiscard?: () => void
  /** Replaces any of the dialog's English words. */
  labels?: Partial<UnsavedGuardLabels>
  /**
   * The app's {@link LeaveGuard}. With it, a navigation the app starts from code through
   * `leaveGuard.navigate(go)` gets the same question in the same dialog as a link click. Left out,
   * only links and the tab itself are guarded. It must come from `createLeaveGuard()`; any other
   * object throws.
   */
  leaveGuard?: LeaveGuard
}

/**
 * Asks before a person leaves a page with unsaved changes. While `when` is `true`, closing or
 * reloading the tab gets the browser's own question, and a plain click on an in-app link `owns`
 * accepts opens a dialog: "Leave" calls `onDiscard` and `navigate` with the link's address, and
 * "Stay" closes the dialog. A link marked `data-unsaved-ok` is never held back.
 *
 * Navigation started from code is covered once the app shares a {@link LeaveGuard}: pass it as
 * `leaveGuard` and call `leaveGuard.navigate(() => setLocation("/lists"))` where a button or a
 * shortcut used to call the router. While `when` is `true` that opens the same dialog: "Leave"
 * calls `onDiscard` and runs the navigation, "Stay" drops it and gives the focus back to the
 * element that had it when the dialog opened, such as the button that was pressed. While `when` is
 * `false` it navigates at once. A second navigation while the dialog is open replaces the first;
 * there is never a second dialog.
 *
 * The guard listens in the capture phase on `document`, so it decides before the link's own click
 * handler, or any ancestor's, has run: the only earlier cancellation it sees is a capture listener
 * on `window`. A link it holds back never reaches its own handler. Mark an in-page action link
 * `data-unsaved-ok` to keep its handler working.
 *
 * The browser's Back and Forward buttons, and `history.back()`, `forward()` and `go()`, are held
 * back too, with no prop and no wiring. When a step inside the app would leave the page (the path
 * or the query changes), the guard at once adds a history entry with the page's own address and
 * state on top of the entry the person went to, so the router keeps the form mounted with its
 * text, and opens the same dialog. "Leave" calls `onDiscard` and steps back from that new entry,
 * which is where the person was going, however many entries away and in either direction. "Stay"
 * closes the dialog. Another step while the dialog is open is answered the same way, in the one
 * dialog. `navigate` and `owns` play no part in this. What it cannot do:
 *
 * - After "Stay" the form is on the new entry. The entries that were ahead of the one the person
 *   went to are gone, and that one is now one step back; after Forward, that is the page that was
 *   ahead.
 * - It needs the Navigation API (`window.navigation`) to hear of the step before the router does.
 *   In a browser without it (Safari before 26.2, Firefox before 147), Back and Forward leave at
 *   once and the changes are lost.
 * - The toolbar's Back button pressed again right after a held step, with no click or key in
 *   between, is not verified. Chromium may then skip the entries the app added, the guard's
 *   included, and leave the app.
 * - Two forms with changes on one page must share one `leaveGuard`: then one dialog asks for
 *   both. Without it each guard holds the step on its own, and "Leave" in the first dialog is
 *   asked again by the second.
 * - A step to another document (another site, a server-rendered page, the page the tab showed
 *   before the app) unloads this one, so it gets the browser's own question through
 *   `beforeunload`, not the dialog.
 * - A step that changes only the fragment is not held, as a link to a fragment of the same page is
 *   not. A router that keeps its route in the fragment gets no question on Back.
 *
 * It renders nothing until a navigation is held back, and its listeners are added in an effect, so
 * it renders on a server.
 */
export function UnsavedGuard(
  { when, navigate, owns, onDiscard, labels, leaveGuard }: UnsavedGuardProps,
): JSX.Element | null {
  const words = { ...defaultUnsavedGuardLabels, ...labels }
  const own = useMemo(createLeaveGuard, [])
  const guard = leaveGuard ?? own
  const asking = leaveGuardInternals(guard)
  // Stands for this component in the guard, which shows the question through one holder only.
  const holder = useRef({}).current
  // Read at click time, so a caller's inline function does not re-add the listeners every render.
  const latest = useRef({ owns, navigate })
  latest.current = { owns, navigate }

  useEffect(() => {
    if (!when) return
    const release = asking.hold(holder)
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!(link instanceof HTMLAnchorElement)) return
      const to = guardedHref(
        event,
        {
          href: link.href,
          target: link.getAttribute("target"),
          download: link.hasAttribute("download"),
          allowed: link.hasAttribute("data-unsaved-ok"),
        },
        location,
        (url) => latest.current.owns(url),
      )
      if (to === null) return
      event.preventDefault()
      // This listener runs in the capture phase, before the router's own link handler, which
      // would otherwise navigate.
      event.stopPropagation()
      guard.navigate(() => latest.current.navigate(to))
    }
    const releaseHistory = holdHistory(() => asking.leads(holder), (go) => guard.navigate(go))
    addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      release()
      releaseHistory()
      removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [when, guard, asking])

  if (!when || !asking.asks(holder)) return null
  return (
    <ConfirmDialog
      title={words.title}
      message={words.message}
      confirmLabel={words.leave}
      cancelLabel={words.stay}
      tone="danger"
      onConfirm={() => {
        // Taken out first: an `onDiscard` that unmounts this guard at once lets go of the guard,
        // which drops whatever still waits in it.
        const go = asking.take()
        onDiscard?.()
        go?.()
      }}
      onCancel={() => asking.stay()}
    />
  )
}
