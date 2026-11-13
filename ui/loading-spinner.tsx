import { cn } from "@spy4x/preact-cn"
import { IconSpinner } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { translate, useT } from "./i18n.tsx"

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

/**
 * Inline spinner with an accessible live region. It stands still when the system asks for reduced
 * motion.
 *
 * Contains no application state: the source component returned `null` unless the app's
 * `isLoading` signal was set. Render it conditionally instead — `<Show>` or `&&` — so the
 * primitive stays presentational.
 */
export function LoadingSpinner(
  { label, loadingLabel, size = "md", class: className }: LoadingSpinnerProps,
): JSX.Element {
  const translator = useT()
  const loadingText = loadingLabel ??
    translate(translator, "LoadingSpinner.loadingLabel", "Loading")
  return (
    <div
      class={cn("flex flex-col items-center justify-center gap-3 py-8", className)}
      role="status"
      aria-live="polite"
    >
      <IconSpinner class={cn("text-selected", sizeClasses[size])} />
      {label
        ? <p class="text-sm text-muted">{label}</p>
        : <span class="sr-only">{loadingText}</span>}
    </div>
  )
}
