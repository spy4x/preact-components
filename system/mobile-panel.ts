/**
 * The open/close behaviour a `<details>`-based mobile panel needs, shared by every component that
 * collapses its navigation into a disclosure on small screens (`SiteHeader` today, the app shell's
 * side navigation next — see #135).
 *
 * `<details>`/`<summary>` is the disclosure itself: a click on `<summary>` opens and closes it with
 * no JavaScript at all, which is what keeps a caller's links reachable before hydration or with
 * scripts off, and Chromium already exposes that open/closed state to assistive tech natively —
 * `pages/checks/system.ts`'s `siteHeaderNativeExpandedStateCheck` reads it off the accessibility tree
 * with nothing but the platform element rendered. What the platform element does not do on its own
 * is close on Escape and hand focus back to the button that opened it, or close itself when a link
 * inside it is activated for a client-side navigation — this hook adds those, plus an `aria-expanded`
 * kept in step with the element's own state as a redundant, explicit signal for tooling that reads
 * ARIA rather than the accessibility tree Chromium builds from the native element. The Escape
 * listener lives on `document`, so it can hear a press from anywhere inside the panel, but it acts
 * only on a press that started inside this disclosure — a dialog open on top of it, or the panel
 * itself hidden by a wider viewport while a stray click had left it "open", must not be closed by
 * an Escape meant for something else.
 *
 * There is no pure logic here to unit test: every behaviour is a `document` listener or a focus
 * move, neither of which a string render executes (see `AGENTS.md` → Behaviour needs a second
 * pair). `pages/checks/system.ts` drives all of it in a real browser instead.
 */

import { useSignal } from "@preact/signals"
import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/** What {@link useMobilePanel} hands back to the component rendering the disclosure. */
export interface MobilePanelController {
  /**
   * Whether the panel is open, or `undefined` before the hook has read the element's own state.
   *
   * Server-rendered markup is always closed, so `undefined` only ever appears in a browser, for the
   * instant between paint and the mount effect below — the gap in which a no-JavaScript click, or a
   * click that lands before hydration finishes, can leave the native element open while nothing
   * here has looked yet. Rendering `aria-expanded` from `undefined` (which Preact omits) rather than
   * printing a stale `"false"` is the point of exposing this as three states instead of two.
   */
  open: boolean | undefined
  /** Ref for the `<details>` element; attach it so the hook can read and set its `open` property. */
  detailsRef: RefObject<HTMLDetailsElement>
  /** Ref for the `<summary>` (or other) element that opens the panel; Escape returns focus here. */
  triggerRef: RefObject<HTMLElement>
  /**
   * Bind to the `<details>` element's `onToggle`. Keeps `open` in step with a click on `<summary>`,
   * which toggles the element natively and fires no other event this hook could read instead.
   */
  handleToggle: () => void
  /**
   * Close the panel programmatically.
   *
   * @param returnFocus Move focus back to `triggerRef`. Defaults to `true`; a caller that closes
   * because focus is about to move somewhere else on its own — a link inside the panel navigating
   * away — passes `false`, so this does not fight that move.
   */
  close: (returnFocus?: boolean) => void
}

/**
 * Track a `<details>`-based disclosure's open state and give Escape, and a navigating link inside
 * it, the close behaviour the platform element does not have on its own.
 *
 * `open` starts `undefined` on every render, including the server's — see
 * {@link MobilePanelController.open} — and the mount effect below reads the element's real state
 * once a ref is attached, which is what makes the hook correct for a panel a visitor already opened
 * before this ran. Nothing here touches `document` outside an effect, which keeps the component
 * server-renderable.
 */
export function useMobilePanel(): MobilePanelController {
  const isOpen = useSignal<boolean | undefined>(undefined)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const triggerRef = useRef<HTMLElement>(null)

  const close = (returnFocus = true) => {
    if (detailsRef.current) detailsRef.current.open = false
    isOpen.value = false
    if (returnFocus) triggerRef.current?.focus()
  }

  // A visitor can open the native `<details>` — a real click needs no script to do it — before this
  // effect ever runs: while the bundle is still loading, or in the gap between paint and the first
  // effect on an already-loaded page. Reading the element once on mount is the only way to learn
  // that happened; nothing dispatches an event for state this hook did not itself change.
  // Empty dependency array, deliberately: this reads the DOM's own state once at mount, not a
  // reaction to anything in scope changing.
  useEffect(() => {
    isOpen.value = detailsRef.current?.open ?? false
  }, [])

  // Attached once, unconditionally, rather than only while `isOpen.value` is `true`. `isOpen`
  // updates a render behind the DOM: `handleToggle` sets it from the `toggle` event, but Preact
  // runs the effect that (re)attaches this listener *after* that render commits, not synchronously
  // with it. A press that lands in that gap — measured, not assumed: `aria-expanded` already read
  // `"true"` while this listener had not attached yet in two runs out of fifteen — would find no
  // listener here at all if attaching depended on `isOpen.value` having caught up first. Reading
  // `detailsRef.current.open` straight off the element instead has no such gap: the browser sets it
  // synchronously as part of the click that opened the panel, before any of Preact's own scheduling
  // runs.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // Listening on `document` is what lets Escape close this panel from anywhere inside it — a
      // link deep in the panel, not only the button — but the same listener sees every Escape on
      // the page, including one meant for a layer above this one entirely. A modal dialog on top
      // does not stop this keydown from bubbling to `document`, and `detailsRef.current.open`
      // cannot tell the two cases apart on its own: the panel stays open while a dialog sits over
      // it, so a press aimed at the dialog would still read `open === true` here. Requiring the
      // press to have started inside this disclosure — on the button, or on a link once the panel
      // is open — is what a document-level listener needs to behave like a component-scoped one.
      if (!detailsRef.current?.contains(event.target as Node)) return
      if (!detailsRef.current.open) return
      event.preventDefault()
      close(true)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return {
    open: isOpen.value,
    detailsRef,
    triggerRef,
    handleToggle: () => isOpen.value = detailsRef.current?.open ?? false,
    close,
  }
}
