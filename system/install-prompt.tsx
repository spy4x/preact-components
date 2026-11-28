/**
 * `InstallPrompt` — a small, dismissible card that offers to install the app: an Install button
 * where the browser has an install dialog, and the Share, then Add to Home Screen steps on an
 * iPhone or iPad, where it has none. In an in-app browser on iOS, which has no Add to Home Screen,
 * it asks the person to open the page in Safari first.
 *
 * It takes the mode and two callbacks, so it renders from `createInstallPrompt` in
 * `@spy4x/preact-signals` or from anything else that knows the same five modes.
 */

import { cn } from "@spy4x/preact-cn"
import { IconDownload, IconShare } from "@spy4x/preact-icons"
import { Button } from "@spy4x/preact-ui/button"
import { useFocusFallback } from "@spy4x/preact-ui/use-focus-after-removal"
import type { JSX } from "preact"
import { useRef, useState } from "preact/hooks"
import { useLabels } from "@spy4x/preact-ui/i18n"

/** Every word {@link InstallPrompt} shows, each with an English default. */
export interface InstallPromptLabels {
  /** The card's accessible name and heading. Defaults to `"Install this app"`. */
  title: string
  /** The sentence beside the Install button. */
  body: string
  /** The sentence on iPhone and iPad, before the Share icon. Defaults to `"Tap"`. */
  iosBefore: string
  /** The Share icon's accessible name. Defaults to `"Share"`. */
  iosShare: string
  /** The sentence on iPhone and iPad, after the Share icon. */
  iosAfter: string
  /** The sentence in an in-app browser on iPhone and iPad, which must hand over to Safari. */
  iosInApp: string
  /** The Install button. Defaults to `"Install"`. */
  install: string
  /** The dismiss button. Defaults to `"Not now"`. */
  dismiss: string
  /** Shown in the card when `onInstall` or `onDismiss` returns a promise that rejects. */
  failed: string
}

/** The English words {@link InstallPrompt} shows when the caller passes none. */
export const DEFAULT_INSTALL_PROMPT_LABELS: InstallPromptLabels = {
  title: "Install this app",
  body: "Open it from your home screen, and use it offline.",
  iosBefore: "Tap",
  iosShare: "Share",
  iosAfter: "then Add to Home Screen.",
  iosInApp: "Open this page in Safari first, then tap Share and Add to Home Screen.",
  install: "Install",
  dismiss: "Not now",
  failed: "That didn't work. Try again.",
}

export interface InstallPromptProps {
  /**
   * What to offer: `prompt` shows the Install button, `ios` the Share steps, `ios-in-app` the
   * sentence asking to open the page in Safari first, and `installed` or `unavailable` render
   * nothing, except that a card whose action is running or failed stays on `unavailable` to show
   * `labels.failed`. `createInstallPrompt().mode` in `@spy4x/preact-signals` fits.
   */
  mode: "prompt" | "ios" | "ios-in-app" | "installed" | "unavailable"
  /**
   * Opens the browser's install dialog. A returned promise keeps the button busy until it ends; a
   * rejection or a throw is caught here and shows `labels.failed`.
   */
  onInstall: () => void | Promise<unknown>
  /**
   * Hides the card for good. The caller stores that and stops rendering it. A throw, or a returned
   * promise that rejects, is caught here and shows `labels.failed`.
   */
  onDismiss: () => void | Promise<unknown>
  /**
   * Where focus goes when the card leaves while focus is inside it, after "Not now" or an accepted
   * install. It must return a focusable element, such as the button that opened a menu, or an
   * element with `tabIndex={-1}`. Without it, focus falls to the page body.
   */
  returnFocus?: () => HTMLElement | null | undefined
  /** Words to replace. */
  labels?: Partial<InstallPromptLabels>
  /** Utilities for the card. */
  class?: string
}

/**
 * Offer to install the app, or explain how to on iOS. Renders nothing when there is nothing to
 * offer. It is not a live region and never takes focus on arrival: it is an offer, not news. When
 * it leaves with focus inside, focus moves to `returnFocus`.
 */
export function InstallPrompt(
  { mode, onInstall, onDismiss, labels, returnFocus, class: className }: InstallPromptProps,
): JSX.Element | null {
  const words = useLabels("InstallPrompt", DEFAULT_INSTALL_PROMPT_LABELS, labels)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const card = useRef<HTMLElement>(null)
  /** The last mode that offered something, to draw the card by while it shows a failure. */
  const offered = useRef<"prompt" | "ios" | "ios-in-app">("prompt")
  if (mode === "prompt" || mode === "ios" || mode === "ios-in-app") offered.current = mode
  const drawn = offered.current
  // A store ends the offer when the install dialog fails to open, so an `unavailable` card stays
  // while Install runs and while its failure shows: it says what happened instead of vanishing.
  const shown = mode === drawn || (mode === "unavailable" && (busy || failed))
  // The card leaving, by `mode` or by the caller unmounting it, hands focus to `returnFocus`.
  useFocusFallback(card, () => returnFocus?.())

  if (!shown) return null

  const run = (action: () => void | Promise<unknown>, showBusy: boolean) => {
    setFailed(false)
    let result: void | Promise<unknown>
    try {
      result = action()
    } catch {
      // A port that throws at once, such as blocked storage, fails like a rejected promise.
      setFailed(true)
      return
    }
    if (!result) return
    if (showBusy) setBusy(true)
    result.then(() => {}, () => setFailed(true)).finally(() => setBusy(false))
  }

  return (
    <section
      ref={card}
      aria-label={words.title}
      data-install-mode={drawn}
      class={cn("pc-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center", className)}
    >
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" class="shrink-0 text-muted">
          <IconDownload class="size-6" />
        </span>
        <div class="flex min-w-0 flex-col gap-1">
          <p class="font-medium">{words.title}</p>
          {drawn === "prompt"
            ? <p class="text-sm text-muted">{words.body}</p>
            : drawn === "ios-in-app"
            ? <p class="text-sm text-muted">{words.iosInApp}</p>
            : (
              <p class="text-sm text-muted">
                {words.iosBefore}{" "}
                <IconShare class="inline size-4 align-text-bottom" aria-label={words.iosShare} />
                {" "}
                {words.iosAfter}
              </p>
            )}
          {failed ? <p aria-hidden="true" class="text-sm text-danger">{words.failed}</p> : null}
          <p role="status" class="sr-only">{failed ? words.failed : ""}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        {drawn === "prompt"
          ? (
            <Button variant="primary" busy={busy} onClick={() => run(onInstall, true)}>
              {words.install}
            </Button>
          )
          : null}
        <Button variant="ghost" onClick={() => run(onDismiss, false)}>{words.dismiss}</Button>
      </div>
    </section>
  )
}
