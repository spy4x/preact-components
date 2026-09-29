import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

/** Rendered size of a {@link LoadingSpinner}. */
export type SpinnerSize = "sm" | "md" | "lg"

export interface LoadingSpinnerProps {
  /**
   * Visible caption under the spinner, which a screen reader also hears. Omitted, only the hidden
   * {@link LoadingSpinnerProps.loadingLabel} remains.
   */
  label?: string
  /**
   * The word a screen reader hears when there is no `label`; it is not shown. Defaults to
   * `"Loading"`. Ignored when `label` is given, since the caption is then what is announced.
   */
  loadingLabel?: string
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
  { label, loadingLabel = "Loading", size = "md", class: className }: LoadingSpinnerProps,
): JSX.Element {
  return (
    <div
      class={cn("flex flex-col items-center justify-center gap-3 py-8", className)}
      role="status"
      aria-live="polite"
    >
      <svg
        class={cn("animate-spin text-selected", sizeClasses[size])}
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
        ? <p class="text-sm text-muted">{label}</p>
        : <span class="sr-only">{loadingLabel}</span>}
    </div>
  )
}
