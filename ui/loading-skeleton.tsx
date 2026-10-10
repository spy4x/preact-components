import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

export interface LoadingSkeletonProps {
  /** Number of placeholder cards below the header card. Defaults to 3. */
  rows?: number
  class?: string
}

const card = "rounded-lg border border-subtle bg-surface p-4"
const bar = "animate-pulse rounded bg-track motion-reduce:animate-none"

/**
 * Placeholder layout shown while a result loads. Its pulse stops when the system asks for reduced
 * motion.
 *
 * `aria-hidden` on the whole tree: a screen reader should hear the caller's single polite
 * status message, not a stack of empty boxes.
 */
export function LoadingSkeleton({ rows = 3, class: className }: LoadingSkeletonProps): JSX.Element {
  return (
    <div class={cn("space-y-3", className)} aria-hidden="true">
      <div class={cn(card, "flex items-center gap-4")}>
        <div class="inline-flex size-10 items-center justify-center rounded-xl border border-subtle bg-selected-soft text-selected">
          <svg
            class="size-5 animate-pulse motion-reduce:animate-none"
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
            <div class="space-y-2">
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
