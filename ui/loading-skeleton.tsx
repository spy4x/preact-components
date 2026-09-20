import { cn } from "@preact-components/cn"

export interface LoadingSkeletonProps {
  /** Number of placeholder cards below the header card. Defaults to 3. */
  rows?: number
  class?: string
}

const card = "rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
const bar = "animate-pulse rounded bg-gray-200 dark:bg-gray-700"

/**
 * Placeholder layout shown while a result loads.
 *
 * `aria-hidden` on the whole tree: a screen reader should hear the caller's single polite
 * status message, not a stack of empty boxes.
 */
export function LoadingSkeleton({ rows = 3, class: className }: LoadingSkeletonProps) {
  return (
    <div class={cn("mt-8 space-y-3", className)} aria-hidden="true">
      <div class={cn(card, "flex items-center gap-4")}>
        <div class="inline-flex size-10 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300">
          <svg
            class="size-5 animate-pulse"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class={cn(bar, "mb-2 h-4 w-48")} />
          <div class={cn(bar, "h-3 w-32")} />
        </div>
      </div>

      {Array.from(
        { length: Math.max(0, rows) },
        (_, index) => (
          <div key={index} class={cn(card, "sm:p-6")}>
            <div class="mb-4 flex items-center gap-3">
              <div class={cn(bar, "size-8 shrink-0 rounded-lg")} />
              <div class={cn(bar, "h-4 w-32")} />
            </div>
            <div class="space-y-2.5">
              <div class={cn(bar, "h-4 w-full")} />
              <div class={cn(bar, "h-4 w-5/6")} />
              <div class={cn(bar, "h-4 w-2/3")} />
            </div>
          </div>
        ),
      )}
    </div>
  )
}
