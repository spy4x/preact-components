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
import { signal } from "@preact/signals"
import { ConfirmDialog } from "./confirm-dialog.tsx"
import { type ClickModifiers, isPlainClick } from "./link.tsx"

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

/**
 * The question "leave with unsaved changes?" for navigation an app starts from code: a sidebar
 * button, a keyboard shortcut, a redirect. The app creates one with {@link createLeaveGuard}, gives
 * it to its {@link UnsavedGuard} as `leaveGuard`, and wraps its own navigation in `navigate`.
 */
export interface LeaveGuard {
  /**
   * Runs `go` at once when no `UnsavedGuard` holds this guard, which is whenever nothing is
   * unsaved. Otherwise it asks first, in the guard's dialog: "Leave" runs `go`, "Stay" drops it.
   *
   * A call that arrives while the question is already on screen replaces the earlier `go`: the
   * dialog stays as it is, and "Leave" runs only the newest one.
   *
   * @param go The navigation itself, such as `() => setLocation("/lists")`.
   */
  navigate(go: () => void): void
  /**
   * Marks unsaved changes on behalf of `holder`, until the returned function is called.
   * `UnsavedGuard` calls this while its `when` is `true`; an app does not. When the last holder
   * lets go, a question still on screen is dropped without navigating.
   *
   * @param holder Any object that stands for the caller, compared by identity.
   * @returns The function that lets go. Calling it twice does nothing more.
   */
  hold(holder: object): () => void
  /**
   * Whether `holder` should show the question now: a navigation is waiting and `holder` is the
   * earliest one still holding, so two guards that share this object never show two dialogs. It
   * reads signals, so a component that calls it while rendering re-renders when the answer changes.
   */
  asks(holder: object): boolean
  /** Answers "Leave": closes the question, then runs the waiting navigation. */
  leave(): void
  /** Answers "Stay": closes the question and drops the waiting navigation. */
  stay(): void
}

/**
 * Creates a {@link LeaveGuard}. Create one for the app, outside any component, so the code that
 * navigates and the `UnsavedGuard` that asks share it.
 *
 * It knows no router and touches no global: the app passes its own navigation to `navigate` each
 * time.
 */
export function createLeaveGuard(): LeaveGuard {
  const holders = signal<readonly { holder: object }[]>([])
  const waiting = signal<(() => void) | null>(null)
  return {
    navigate(go) {
      if (holders.value.length === 0) go()
      else waiting.value = go
    },
    hold(holder) {
      // Its own entry, so a release called twice cannot let go of a later hold by the same holder.
      const entry = { holder }
      holders.value = [...holders.value, entry]
      return () => {
        if (!holders.value.includes(entry)) return
        holders.value = holders.value.filter((other) => other !== entry)
        if (holders.value.length === 0) waiting.value = null
      }
    },
    asks: (holder) => waiting.value !== null && holders.value[0]?.holder === holder,
    leave() {
      const go = waiting.value
      waiting.value = null
      go?.()
    },
    stay() {
      waiting.value = null
    },
  }
}

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
   * only links and the tab itself are guarded.
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
  // Stands for this component in the guard, which shows the question through one holder only.
  const holder = useRef({}).current
  // Read at click time, so a caller's inline function does not re-add the listeners every render.
  const latest = useRef({ owns, navigate })
  latest.current = { owns, navigate }

  useEffect(() => {
    if (!when) return
    const release = guard.hold(holder)
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
  }, [when, guard])

  if (!when || !guard.asks(holder)) return null
  return (
    <ConfirmDialog
      title={words.title}
      message={words.message}
      confirmLabel={words.leave}
      cancelLabel={words.stay}
      tone="danger"
      onConfirm={() => {
        onDiscard?.()
        guard.leave()
      }}
      onCancel={() => guard.stay()}
    />
  )
}
