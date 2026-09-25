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
 */
export function ErrorState({ message, class: className }: ErrorStateProps): JSX.Element | null {
  if (!message) return null

  return (
    <div
      role="alert"
      class={cn(
        "mx-auto my-4 max-w-[650px] rounded-lg border border-red-500 bg-red-50 p-4 text-center text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
        className,
      )}
    >
      <p>{message}</p>
    </div>
  )
}
