/**
 * `UnsavedGuard` — asks before a person leaves a page with changes they have not saved.
 *
 * Three ways out of a page are covered: closing or reloading the tab, which gets the browser's own
 * question through `beforeunload`; a click on an in-app link, which is held back and answered with
 * a {@link ConfirmDialog}; and a navigation the app starts from code, such as a sidebar button or a
 * keyboard shortcut, once the app sends it through a {@link LeaveGuard}. The browser's Back and
 * Forward buttons are not covered: by the time the page hears of them the address has already
 * changed, and no event lets a page refuse them.
 */

import type { JSX } from "preact"
import { useEffect, useMemo, useRef } from "preact/hooks"
import { ConfirmDialog } from "./confirm-dialog.tsx"
import { type ClickModifiers, isPlainClick } from "./link.tsx"
import {
  createLeaveGuard,
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
 * The browser's Back button cannot be held back: the address has already changed when the page
 * hears of it.
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
    addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      release()
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
