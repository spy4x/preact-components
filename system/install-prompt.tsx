/**
 * `InstallPrompt` — a small, dismissible card that offers to install the app: an Install button
 * where the browser has an install dialog, and the Share, then Add to Home Screen steps on an
 * iPhone or iPad, where it has none.
 *
 * It takes the mode and two callbacks, so it renders from `createInstallPrompt` in
 * `@spy4x/preact-signals` or from anything else that knows the same four modes.
 */

import { cn } from "@spy4x/preact-cn"
import { IconDownload, IconShare } from "@spy4x/preact-icons"
import { Button } from "@spy4x/preact-ui/button"
import type { JSX } from "preact"
import { useState } from "preact/hooks"

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
  /** The Install button. Defaults to `"Install"`. */
  install: string
  /** The dismiss button. Defaults to `"Not now"`. */
  dismiss: string
}

/** The English words {@link InstallPrompt} shows when the caller passes none. */
export const DEFAULT_INSTALL_PROMPT_LABELS: InstallPromptLabels = {
  title: "Install this app",
  body: "Open it from your home screen, and use it offline.",
  iosBefore: "Tap",
  iosShare: "Share",
  iosAfter: "then Add to Home Screen.",
  install: "Install",
  dismiss: "Not now",
}

export interface InstallPromptProps {
  /**
   * What to offer: `prompt` shows the Install button, `ios` the Share steps, and `installed` or
   * `unavailable` render nothing. `createInstallPrompt().mode` in `@spy4x/preact-signals` fits.
   */
  mode: "prompt" | "ios" | "installed" | "unavailable"
  /** Opens the browser's install dialog. A returned promise keeps the button busy until it ends. */
  onInstall: () => void | Promise<unknown>
  /** Hides the card for good. The caller stores that and stops rendering it. */
  onDismiss: () => void
  /** Words to replace. */
  labels?: Partial<InstallPromptLabels>
  /** Utilities for the card. */
  class?: string
}

/**
 * Offer to install the app, or explain how to on iOS. Renders nothing when there is nothing to
 * offer. It is not a live region and never takes focus: it is an offer, not news.
 */
export function InstallPrompt(
  { mode, onInstall, onDismiss, labels, class: className }: InstallPromptProps,
): JSX.Element | null {
  const words = { ...DEFAULT_INSTALL_PROMPT_LABELS, ...labels }
  const [busy, setBusy] = useState(false)
  if (mode !== "prompt" && mode !== "ios") return null

  const install = () => {
    const result = onInstall()
    if (!result) return
    setBusy(true)
    result.finally(() => setBusy(false))
  }

  return (
    <section
      aria-label={words.title}
      data-install-mode={mode}
      class={cn("pc-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center", className)}
    >
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" class="shrink-0 text-muted">
          <IconDownload class="size-6" />
        </span>
        <div class="flex min-w-0 flex-col gap-1">
          <p class="font-medium">{words.title}</p>
          {mode === "prompt"
            ? <p class="text-sm text-muted">{words.body}</p>
            : (
              <p class="text-sm text-muted">
                {words.iosBefore}{" "}
                <IconShare class="inline size-4 align-text-bottom" aria-label={words.iosShare} />
                {" "}
                {words.iosAfter}
              </p>
            )}
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        {mode === "prompt"
          ? (
            <Button variant="primary" busy={busy} onClick={install}>
              {words.install}
            </Button>
          )
          : null}
        <Button variant="ghost" onClick={onDismiss}>{words.dismiss}</Button>
      </div>
    </section>
  )
}
