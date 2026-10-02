import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

export interface ErrorStateProps {
  /** Message to show. Empty, `null` or `undefined` renders nothing. */
  message?: string | null
  class?: string
}

/**
 * Inline error banner.
 *
 * The source component read the message out of the app's error signal. It is a prop here, and
 * the component still renders nothing for a falsy message so callers can pass a possibly-empty
 * value straight through.
 *
 * The panel reads the theme's danger tokens: `--color-danger` for its text and border,
 * `--color-danger-soft` for its background. An app that repaints them sees the panel follow.
 */
export function ErrorState({ message, class: className }: ErrorStateProps): JSX.Element | null {
  if (!message) return null

  return (
    <div
      role="alert"
      class={cn(
        "mx-auto max-w-[650px] rounded-lg border border-danger bg-danger-soft p-4 text-center text-danger",
        className,
      )}
    >
      <p>{message}</p>
    </div>
  )
}
