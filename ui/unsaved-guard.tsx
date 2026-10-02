/**
 * `UnsavedGuard` — asks before a person leaves a page with changes they have not saved.
 *
 * Two ways out of a page are covered: closing or reloading the tab, which gets the browser's own
 * question through `beforeunload`, and a click on an in-app link, which is held back and answered
 * with a {@link ConfirmDialog}. The browser's Back and Forward buttons are not covered: by the time
 * the page hears of them the address has already changed, and no event lets a page refuse them.
 */

import type { JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
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
 * It returns `null` for a click a handler already cancelled, a button other than the main one, a
 * modifier key, a link with a `target` other than `_self`, a `download` link, a link marked
 * `data-unsaved-ok`, another origin, an address `owns` says the app's router does not handle (a
 * server route, an API path), and a link that only moves to a fragment of this same page.
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
  if (url.pathname === page.pathname && url.search === page.search && url.hash !== "") return null
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

export interface UnsavedGuardProps {
  /** Whether there are unsaved changes. The guard listens only while this is `true`. */
  when: boolean
  /** Moves the app's router to an address, after the person chose to leave. */
  navigate: (href: string) => void
  /**
   * Whether the app's router handles an address. A same-origin link it does not own, such as a
   * server-rendered page or a file, is left to the browser, which then asks through `beforeunload`.
   */
  owns: (url: URL) => boolean
  /** Called when the person chose to leave, just before `navigate`, to drop the unsaved changes. */
  onDiscard?: () => void
  /** Replaces any of the dialog's English words. */
  labels?: Partial<UnsavedGuardLabels>
}

/**
 * Asks before a person leaves a page with unsaved changes. While `when` is `true`, closing or
 * reloading the tab gets the browser's own question, and a plain click on an in-app link `owns`
 * accepts opens a dialog: "Leave" calls `onDiscard` and `navigate` with the link's address, and
 * "Stay" closes the dialog. A link marked `data-unsaved-ok` is never held back.
 *
 * The browser's Back button cannot be held back: the address has already changed when the page
 * hears of it.
 *
 * It renders nothing until a click is held back, and its listeners are added in an effect, so it
 * renders on a server.
 */
export function UnsavedGuard(
  { when, navigate, owns, onDiscard, labels }: UnsavedGuardProps,
): JSX.Element | null {
  const words = { ...defaultUnsavedGuardLabels, ...labels }
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  // Read at click time, so a caller's inline predicate does not re-add the listeners every render.
  const ownsRef = useRef(owns)
  ownsRef.current = owns

  useEffect(() => {
    if (!when) {
      setLeaveTo(null)
      return
    }
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element
        ? event.target.closest("a[href], area[href]")
        : null
      if (!(link instanceof HTMLAnchorElement || link instanceof HTMLAreaElement)) return
      const to = guardedHref(
        event,
        {
          href: link.href,
          target: link.getAttribute("target"),
          download: link.hasAttribute("download"),
          allowed: link.hasAttribute("data-unsaved-ok"),
        },
        location,
        (url) => ownsRef.current(url),
      )
      if (to === null) return
      event.preventDefault()
      // This listener runs in the capture phase, before the router's own link handler, which
      // would otherwise navigate.
      event.stopPropagation()
      setLeaveTo(to)
    }
    addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [when])

  if (!when || leaveTo === null) return null
  return (
    <ConfirmDialog
      title={words.title}
      message={words.message}
      confirmLabel={words.leave}
      cancelLabel={words.stay}
      tone="danger"
      onConfirm={() => {
        const to = leaveTo
        setLeaveTo(null)
        onDiscard?.()
        navigate(to)
      }}
      onCancel={() => setLeaveTo(null)}
    />
  )
}
