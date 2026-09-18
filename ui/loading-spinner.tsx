import { cn } from "@preact-components/signals/cn"

/** Rendered size of a {@link LoadingSpinner}. */
export type SpinnerSize = "sm" | "md" | "lg"

export interface LoadingSpinnerProps {
  /** Visible caption under the spinner. Omitted, only a screen-reader "Loading" remains. */
  label?: string
  /** Defaults to `"md"`. */
  size?: SpinnerSize
  class?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "size-5",
  md: "size-8",
  lg: "size-12",
}

const strokeWidths: Record<SpinnerSize, string> = {
  sm: "3",
  md: "3",
  lg: "2.5",
}

/**
 * Inline spinner with an accessible live region.
 *
 * Contains no application state: the source component returned `null` unless the app's
 * `isLoading` signal was set. Render it conditionally instead — `<Show>` or `&&` — so the
 * primitive stays presentational.
 */
export function LoadingSpinner(
  { label, size = "md", class: className }: LoadingSpinnerProps,
) {
  return (
    <div
      class={cn("flex flex-col items-center justify-center gap-3 py-10", className)}
      role="status"
      aria-live="polite"
    >
      <svg
        class={cn("animate-spin text-purple-900 dark:text-purple-400", sizeClasses[size])}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width={strokeWidths[size]}
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
        />
      </svg>
      {label
        ? <p class="text-sm text-gray-600 dark:text-gray-300">{label}</p>
        : <span class="sr-only">Loading</span>}
    </div>
  )
}
