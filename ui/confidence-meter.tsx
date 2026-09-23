import { cn } from "@preact-components/cn"
import type { JSX } from "preact"

/** Coarse banding of a confidence score. */
export type ConfidenceTier = "low" | "medium" | "high"

export interface ConfidenceMeterProps {
  /**
   * Score, clamped into `0…100`.
   *
   * `null` and `undefined` mean the caller has no score yet, and a non-finite number is a broken
   * measurement rather than a score — both read as unknown and publish nothing.
   */
  value?: number | null
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
 * Clamp a score into `0…100` and band it, or report that there is no score to band.
 *
 * `NaN`, `±Infinity`, `null` and `undefined` all mean "not a reading": a `NaN` has no order to
 * clamp and no honest `aria-valuenow`, and an infinite score is outside the `0…100` a confidence
 * is defined on — clamping it would publish a maximal-confidence reading that nobody measured.
 * Both bands and value are therefore `null`, and the meter renders no fill, no percentage and no
 * `aria-valuenow`. {@link clampProgress} agrees on `NaN` and on an absent reading — both are
 * unmeasurable there too — and on nothing else: it has a `max` to clamp onto, so it spends
 * `±Infinity` on a bound (`-Infinity` → `0`, `Infinity` → `max`), while a confidence is defined on
 * a fixed `0…100` this component takes no `max` for. Clamping an infinite score onto `100` would
 * therefore publish a maximal-confidence reading nobody measured, which is the fabrication the
 * whole unmeasurable branch exists to avoid. Kept as its own function rather than shared: the
 * ranges, the `±Infinity` policy and the return shape all differ, and a shared helper would need a
 * `{ max, onNonFinite }` policy argument to cover both.
 *
 * @param value Raw score; may be out of range or not a number at all.
 * @returns The clamped score and its {@link ConfidenceTier}, both `null` when unmeasurable.
 */
export function clampConfidence(
  value: number | null | undefined,
): { value: number | null; tier: ConfidenceTier | null } {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { value: null, tier: null }
  }

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
 *
 * An unknown reading keeps the track, the `progressbar` role and the spoken descriptor, and drops
 * only the three things it cannot support: no `aria-valuenow` (WAI-ARIA 1.2 says an author SHOULD
 * NOT set one for an unknown value), no fill element, so no `width:…%` declaration, and no
 * percentage — `NaN%` is visible nonsense rather than a missing reading.
 */
export function ConfidenceMeter(
  { value, label, class: className }: ConfidenceMeterProps,
): JSX.Element {
  const { value: clamped, tier } = clampConfidence(value)
  // The two arrive together or not at all: an unmeasurable reading has no band either.
  const known = clamped !== null && tier !== null

  return (
    <div class={cn("flex min-w-0 items-center gap-3", className)}>
      <div class="min-w-[120px] flex-1">
        <div
          class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
          role="progressbar"
          aria-valuenow={clamped ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {known && (
            <div
              class="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-[width] duration-500 ease-out"
              style={{ width: `${clamped}%` }}
            />
          )}
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        {known && (
          <span class={cn("text-xs font-semibold tabular-nums", tierTextClasses[tier])}>
            {Math.round(clamped)}%
          </span>
        )}
        {label && <span class="text-xs text-gray-500 dark:text-gray-400">{label}</span>}
      </div>
      <span class="sr-only">{known ? `${tierLabels[tier]} confidence` : "Unknown confidence"}</span>
    </div>
  )
}
