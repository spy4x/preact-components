/**
 * The open/close behaviour a `<details>`-based mobile panel needs, shared by every component that
 * collapses its navigation into a disclosure on small screens (`SiteHeader` today, the app shell's
 * side navigation next — see #135).
 *
 * `<details>`/`<summary>` is the disclosure itself: a click on `<summary>` opens and closes it with
 * no JavaScript at all, which is what keeps a caller's links reachable before hydration or with
 * scripts off. What the platform element does not do on its own is close on Escape and hand focus
 * back to the button that opened it, and reflect its state as `aria-expanded` — this hook adds
 * exactly those three things, and nothing this hook does is required for the disclosure to open,
 * close or reach its links.
 *
 * There is no pure logic here to unit test: every behaviour is a `document` listener or a focus
 * move, neither of which a string render executes (see `AGENTS.md` → Behaviour needs a second
 * pair). `pages/checks/system.ts` drives all three in a real browser instead.
 */

import { useSignal } from "@preact/signals"
import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/** What {@link useMobilePanel} hands back to the component rendering the disclosure. */
export interface MobilePanelController {
  /** Whether the panel is open right now. */
  open: boolean
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
   * because focus already left for somewhere else of its own accord passes `false`.
   */
  close: (returnFocus?: boolean) => void
}

/**
 * Track a `<details>`-based disclosure's open state and give Escape the close behaviour the
 * platform element does not have on its own.
 *
 * `open` starts `false` on every render, including the server's, so the panel is closed until a
 * click — native or scripted — says otherwise; nothing here touches `document` outside the effect
 * below, which keeps the component server-renderable.
 */
export function useMobilePanel(): MobilePanelController {
  const isOpen = useSignal(false)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const triggerRef = useRef<HTMLElement>(null)

  const close = (returnFocus = true) => {
    if (detailsRef.current) detailsRef.current.open = false
    isOpen.value = false
    if (returnFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!isOpen.value) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      close(true)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen.value])

  return {
    open: isOpen.value,
    detailsRef,
    triggerRef,
    handleToggle: () => isOpen.value = detailsRef.current?.open ?? false,
    close,
  }
}
