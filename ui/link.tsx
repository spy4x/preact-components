import type { ComponentChildren, JSX } from "preact"

/**
 * The part of a `MouseEvent` {@link isPlainClick} reads. A real `MouseEvent` fits it; so does a
 * plain object in a test.
 */
export interface ClickModifiers {
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** The part of a `MouseEvent` {@link followLinkClick} reads and cancels. */
export interface LinkClickEvent extends ClickModifiers {
  defaultPrevented: boolean
  preventDefault(): void
}

/** The anchor a click landed on, as {@link followLinkClick} needs it. */
export interface LinkClickTarget {
  href: string
  /** Called with `href` instead of letting the browser follow the link. Left out, it always does. */
  navigate?: (href: string) => void
  /** The anchor's `target`; anything but none, `""` or `"_self"` leaves the click to the browser. */
  target?: string
  /** The anchor's `download`; any value but `false` leaves the click to the browser. */
  download?: string | boolean
}

/**
 * Whether a click is one the page may take over: the primary button with no modifier. Ctrl or Meta
 * opens a new tab, Shift a new window and Alt a download, so those stay the browser's. A middle
 * click fires `auxclick` rather than `click`, and its `button` is `1`, so it never counts either.
 */
export function isPlainClick(event: ClickModifiers): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
    !event.altKey
}

/**
 * Follow a link click through the `navigate` port when the page may take it over, and report
 * whether it did.
 *
 * It takes over only a plain click ({@link isPlainClick}) that nothing earlier cancelled, on a link
 * that opens in the same browsing context and is not a download, and only when `navigate` is given.
 * Then it cancels the browser's own navigation and calls `navigate(href)`. Every other click is
 * left alone, so a new tab, a new window, a download or a caller's own `preventDefault()` work as
 * they would on any link. This is the rule {@link Link} runs; call it from the click handler of an
 * anchor of your own to give it the same behaviour.
 *
 * @param event The click, as the anchor received it.
 * @param link The anchor's `href`, `target` and `download`, and the `navigate` port.
 * @returns `true` when `navigate` was called and the browser's navigation cancelled.
 */
export function followLinkClick(event: LinkClickEvent, link: LinkClickTarget): boolean {
  const { href, navigate, target, download } = link
  if (!navigate || event.defaultPrevented || !isPlainClick(event)) return false
  if (target && target.toLowerCase() !== "_self") return false
  if (download !== undefined && download !== false) return false
  event.preventDefault()
  navigate(href)
  return true
}

export interface LinkProps extends
  Omit<
    JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
    "class" | "href" | "target" | "download" | "onClick"
  > {
  /** Where the link goes. Rendered as a real `href`, so the link works before any script runs. */
  href: string
  /**
   * Called with `href` on a plain click instead of the browser following the link — the app's
   * router, passed in. Left out, every click is the browser's.
   */
  navigate?: (href: string) => void
  /** Narrowed from Preact's `Signalish<string>`: the click rule reads it as a plain value. */
  target?: string
  /** Narrowed from Preact's `Signalish<…>`: the click rule reads it as a plain value. */
  download?: string | boolean
  /** Runs first, on every click; call `preventDefault()` in it to keep `navigate` out of one. */
  onClick?: (event: JSX.TargetedMouseEvent<HTMLAnchorElement>) => void
  /** Plain utilities. The link has no look of its own. */
  class?: string
  children?: ComponentChildren
}

/**
 * A real `<a href>` that hands plain clicks to a `navigate` port.
 *
 * Server-rendered screens shared between a single-page app and a multi-page site cannot import a
 * router; each app passes its own `navigate` instead. With one, a plain click calls
 * `navigate(href)` and the browser does not navigate; a click with Ctrl, Meta, Shift or Alt, a
 * middle click, a click on a link with another `target` or a `download`, and a click something
 * already cancelled stay the browser's — see {@link followLinkClick}. Without one it is an ordinary
 * link. Every other anchor attribute passes through, and the link carries no classes but `class`.
 */
export function Link(
  { href, navigate, target, download, onClick, class: className, children, ...rest }: LinkProps,
): JSX.Element {
  return (
    <a
      {...rest}
      href={href}
      target={target}
      download={download}
      class={className}
      onClick={(event) => {
        onClick?.(event)
        followLinkClick(event, { href, navigate, target, download })
      }}
    >
      {children}
    </a>
  )
}
