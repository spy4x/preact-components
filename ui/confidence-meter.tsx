import { cn } from "@preact-components/signals/cn"

/** Coarse banding of a confidence score. */
export type ConfidenceTier = "low" | "medium" | "high"

export interface ConfidenceMeterProps {
  /** Score, clamped into `0…100`. */
  value: number
  /** Optional caption rendered next to the percentage. */
  label?: string
  class?: string
}

const tierLabels: Record<ConfidenceTier, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

const tierTextClasses: Record<ConfidenceTier, string> = {
  low: "text-red-600 dark:text-red-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  high: "text-green-600 dark:text-green-400",
}

/**
 * Clamp a score into `0…100` and band it.
 *
 * @param value Raw score; `NaN` bands as `"low"` because the comparisons are all false.
 * @returns The clamped score and its {@link ConfidenceTier}.
 */
export function clampConfidence(value: number): { value: number; tier: ConfidenceTier } {
  const clamped = Math.max(0, Math.min(100, value))
  const tier: ConfidenceTier = clamped >= 75 ? "high" : clamped >= 50 ? "medium" : "low"
  return { value: clamped, tier }
}

/**
 * Horizontal meter for a `0…100` confidence score.
 *
 * Width is rendered inline, so the filled portion is correct in the server-rendered HTML; the
 * CSS transition animates later changes. The source component instead set the width from a
 * `requestAnimationFrame` effect, which left the pre-hydration markup empty.
 */
export function ConfidenceMeter({ value, label, class: className }: ConfidenceMeterProps) {
  const { value: clamped, tier } = clampConfidence(value)

  return (
    <div class={cn("flex min-w-0 items-center gap-3", className)}>
      <div class="min-w-[120px] flex-1">
        <div
          class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            class="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-[width] duration-500 ease-out"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <span class={cn("text-xs font-semibold tabular-nums", tierTextClasses[tier])}>
          {Math.round(clamped)}%
        </span>
        {label && <span class="text-xs text-gray-500 dark:text-gray-400">{label}</span>}
      </div>
      <span class="sr-only">{tierLabels[tier]} confidence</span>
    </div>
  )
}
