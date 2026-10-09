/**
 * The page-level scroll lock every overlay in this package shares.
 *
 * `Modal` and `CommandPalette` both lock the page behind them, and either can open over the other,
 * so the lock counts its holders: the first one records the page's styles and locks, the last one
 * to let go restores them, whatever order they let go in. The three steps the lock is made of —
 * {@link clientWidthWithoutScrollbar}, {@link scrollLockPadding} and {@link applyScrollLock} — stay
 * exported for an overlay that has to lock some other document.
 *
 * @module
 */

/**
 * Padding, in pixels, that keeps a scroll-locked page from shifting.
 *
 * Locking the page removes its scrollbar, which widens the layout by the scrollbar's width and slides
 * every centred element sideways — measured in headless Chromium at a 1000px viewport, the document's
 * `clientWidth` goes 985 → 1000. Padding the body by exactly that gain cancels it, so this is the
 * difference between the width inside the scrollbar container and the width with it removed:
 * `clientWidthLocked - clientWidthBefore`. Overlay scrollbars measure equal, give `0`, and write no
 * padding.
 *
 * The two widths come from {@link clientWidthWithoutScrollbar} and a plain read at the call site, so
 * the arithmetic itself is unit-testable and free of layout. Reading the *after* value once the lock
 * is in place instead would be a bug with a shape: the subtraction collapses to `0` and the page
 * still shifts, which is exactly what the first version of this component did until a browser said
 * otherwise.
 *
 * @param clientWidthBefore `document.documentElement.clientWidth` before the lock.
 * @param clientWidthLocked The same read with the scrollbar clamped away.
 * @returns A non-negative pixel count; `0` when the page reserves no width.
 */
export function scrollLockPadding(clientWidthBefore: number, clientWidthLocked: number): number {
  return Math.max(0, clientWidthLocked - clientWidthBefore)
}

/** The scrollable element whose scrollbar a lock removes. A structural subset of `HTMLElement`. */
export interface ScrollLockHost {
  /** Inline `overflow` — read in, saved, and written back. */
  style: { overflow: string }
  /** `Element.clientWidth`: the layout width inside the scrollbar. */
  readonly clientWidth: number
}

/**
 * Read the layout width once the scrollbar clamping is in place.
 *
 * The gain the lock causes is not a constant and not readable in advance: it is the scrollbar the
 * page currently shows, `0` when it shows none. The only honest way to get it is to clamp and read —
 * `overflow: hidden` is written, `clientWidth` is read back, the previous value is restored in
 * `finally`. The component then writes the lock itself, and
 * {@link scrollLockPadding} turns the before/after pair into padding.
 *
 * Structurally typed (see {@link ScrollLockHost}) so the write/read/restore sequence is drivable with
 * a stub, and a browser is needed only to prove the DOM's answer matches the arithmetic.
 *
 * @param host The scroll container, normally `document.documentElement`.
 * @returns `clientWidth` with the scrollbar removed.
 */
export function clientWidthWithoutScrollbar(host: ScrollLockHost): number {
  const previousOverflow = host.style.overflow
  try {
    host.style.overflow = "hidden"
    return host.clientWidth
  } finally {
    host.style.overflow = previousOverflow
  }
}

/** The two elements a page-level scroll lock has to touch, and the styles it replaces. */
export interface ScrollLockTarget {
  /** The scrolling element: `html` in standards mode, `body` in quirks mode. */
  scrollingElement: { style: { overflow: string } } | null
  /** The body, which carries the compensating padding. */
  body: { style: { overflow: string; paddingRight: string } }
}

/** A held lock, undone by {@link ScrollLock.release}. */
export interface ScrollLock {
  /** Restore both elements to what they had before the lock. */
  release: () => void
}

/**
 * Lock page scrolling without moving the page, and hand back how to undo it.
 *
 * Two things, and the second is the one that is easy to get wrong: `overflow: hidden` on `body` alone
 * does **not** stop the page scrolling — measured in headless Chromium, `window.scrollTo(0, 900)` with
 * `body { overflow: hidden }` set moved the page to 1623 — because the default scroll container is the
 * document element. So the lock is written on `document.scrollingElement` (the platform's own answer
 * to "which element scrolls this document"; quirks mode answers `body`), and the padding is written on
 * the body, which is where a page's content is.
 *
 * Both previous inline values are captured and restored, not blanked, so a host that had its own
 * `overflow` or `padding-right` keeps them. Structurally typed (see {@link ScrollLockTarget}) so which
 * element a document gets locked through is a decision a unit test can hold, with no DOM.
 *
 * @param document The document to lock; `globalThis.document` at the call site.
 * @param padding Pixels of right padding that cancel the width the scrollbar was taking.
 * @returns The held lock.
 */
export function applyScrollLock(document: ScrollLockTarget, padding: number): ScrollLock {
  const scroller = document.scrollingElement
  const previousScrollerOverflow = scroller?.style.overflow
  const previousBodyOverflow = document.body.style.overflow
  const previousPadding = document.body.style.paddingRight

  if (scroller) scroller.style.overflow = "hidden"
  document.body.style.overflow = "hidden"
  document.body.style.paddingRight = `${padding}px`

  return {
    release: () => {
      if (scroller) scroller.style.overflow = previousScrollerOverflow ?? ""
      document.body.style.overflow = previousBodyOverflow
      document.body.style.paddingRight = previousPadding
    },
  }
}

/** The computed `overflow-y` of the page's root element and of its body. */
export interface PageOverflow {
  /** `getComputedStyle(document.documentElement).overflowY`. */
  html: string
  /** `getComputedStyle(document.body).overflowY`. */
  body: string
}

/** Whether an `overflow-y` value stops its box scrolling. */
function stopsScrolling(overflow: string): boolean {
  return overflow === "hidden" || overflow === "clip"
}

/**
 * Whether something already keeps the page from scrolling, by an inline style or by a class.
 *
 * Which box scrolls the page depends on the root element. While `html` computes `overflow-y:
 * visible`, CSS hands the body's `overflow` to the viewport, so the body's value decides. Once
 * `html` sets an overflow of its own, the viewport takes that one and the body keeps its own: the
 * page is locked only when `html` stops scrolling and the body is not a scroller itself. That rules
 * out two layouts a read of either element alone gets wrong — `html { overflow-y: hidden }` over a
 * body that scrolls (`auto` or `scroll`), and `body { overflow: hidden }` under an `html` that
 * scrolls.
 *
 * @param page The computed `overflow-y` of `html` and `body`.
 * @returns `true` when the page cannot scroll now.
 */
export function pageScrollLocked(page: PageOverflow): boolean {
  if (page.html === "visible") return stopsScrolling(page.body)
  return stopsScrolling(page.html) && page.body !== "auto" && page.body !== "scroll"
}

/** What a counted lock needs from the page: whether it is locked already, and how to lock it. */
export interface ScrollLockPage {
  /** Whether something other than this lock already keeps the page from scrolling. */
  locked: () => boolean
  /** Lock the page and hand back how to undo it. */
  lock: () => ScrollLock
}

/**
 * A scroll lock shared by any number of holders, over one page.
 *
 * The first holder asks the page whether it is locked already: if so, by an app's class or its own
 * inline style, the lock writes nothing, so that lock keeps its padding; if not, it locks the page.
 * Later holders only add to the count, so a second overlay never measures a page with no scrollbar
 * and zeroes the padding. The last holder to release restores what the first one recorded, so a
 * holder that lets go early leaves the page locked under the overlays still open. Releasing one
 * holder twice counts once.
 *
 * @param page The page to lock; {@link acquireScrollLock} uses the browser's `document`.
 * @returns A function that adds one holder and returns its lock.
 */
export function countedScrollLock(page: ScrollLockPage): () => ScrollLock {
  let holders = 0
  let held: ScrollLock | null = null
  return () => {
    if (holders === 0) held = page.locked() ? null : page.lock()
    holders++
    let released = false
    return {
      release: () => {
        if (released) return
        released = true
        holders--
        if (holders > 0) return
        held?.release()
        held = null
      },
    }
  }
}

/** The browser's page: its computed overflow, and the measure-then-lock sequence. */
const browserPage: ScrollLockPage = {
  locked: () =>
    pageScrollLocked({
      html: getComputedStyle(document.documentElement).overflowY,
      body: getComputedStyle(document.body).overflowY,
    }),
  lock: () => {
    // Both widths are read before the lock: once it is in place there is no scrollbar to measure.
    const widthBefore = document.documentElement.clientWidth
    const widthLocked = clientWidthWithoutScrollbar(document.documentElement)
    // The cast is the DOM's own gap: `Document.scrollingElement` is typed `Element | null` even
    // though the spec makes it an element with inline styles.
    return applyScrollLock(
      document as unknown as ScrollLockTarget,
      scrollLockPadding(widthBefore, widthLocked),
    )
  },
}

let acquire: (() => ScrollLock) | null = null

/**
 * Hold the page's scroll lock until the returned lock is released.
 *
 * The one lock `Modal` and `CommandPalette` share (see {@link countedScrollLock}): call it when an
 * overlay of your own opens, and release it when that overlay closes, so the page stays locked while
 * any overlay is open and gets its own styles back after the last one closes. Call it only in the
 * browser, from an effect or an event handler.
 *
 * @returns This holder's lock; releasing it twice counts once.
 */
export function acquireScrollLock(): ScrollLock {
  acquire ??= countedScrollLock(browserPage)
  return acquire()
}
