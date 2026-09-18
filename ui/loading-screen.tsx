import { cn } from "@preact-components/signals/cn"
import { LoadingSpinner } from "./loading-spinner.tsx"

export interface LoadingScreenProps {
  /** Headline. Defaults to `"Loading…"`. */
  message?: string
  /** Second line. Pass `null` to drop it. Defaults to `"Please wait…"`. */
  description?: string | null
  class?: string
}

/**
 * Full-viewport loading overlay.
 *
 * The source component hardcoded "Syncing your financial data…" as the subtitle; the copy is
 * generic here and both lines are overridable.
 */
export function LoadingScreen(
  { message = "Loading…", description = "Please wait…", class: className }: LoadingScreenProps,
) {
  return (
    <div
      class={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900",
        className,
      )}
    >
      <div class="text-center">
        <LoadingSpinner size="lg" class="py-0" />
        <p class="text-lg font-medium text-gray-900 dark:text-gray-100">{message}</p>
        {description && <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>}
      </div>
    </div>
  )
}
