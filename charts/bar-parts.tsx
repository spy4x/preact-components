/**
 * What `Bars` and `RankedBars` share: a row's total, the scale, and the bar drawn on its track.
 *
 * Not an entry point: `bars.tsx` re-exports `barPercent` and `barTotal`, and each chart imports
 * the rest, so a page that renders one of them carries none of the other's own markup.
 *
 * @module
 */

import type { JSX } from "preact"
import type { BarDatum, BarReference, StackedBarDatum } from "./bars.tsx"
import { seriesColor } from "./colors.ts"

/** Whether a row is drawn as stacked segments. */
export function isStacked(datum: BarDatum | StackedBarDatum): datum is StackedBarDatum {
  return "segments" in datum && Array.isArray(datum.segments)
}

/**
 * A row's total: its value, or the sum of its segments' finite, positive values.
 *
 * A negative or non-finite segment adds nothing, as it would draw nothing.
 */
export function barTotal(datum: BarDatum | StackedBarDatum): number {
  if (!isStacked(datum)) return datum.value
  return datum.segments.reduce(
    (sum, segment) =>
      Number.isFinite(segment.value) && segment.value > 0 ? sum + segment.value : sum,
    0,
  )
}

/**
 * Percentage of the longest bar, clamped to `[0, 100]`.
 *
 * Non-finite values, negatives and a non-positive maximum all collapse to `0`, so a dirty dataset
 * renders an empty bar instead of a `NaN%` width or a bar wider than its track.
 */
export function barPercent(value: number, top: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(top) || top <= 0) return 0
  const percent = (value / top) * 100
  if (!Number.isFinite(percent)) return 0
  return Math.round(Math.min(100, Math.max(0, percent)) * 100) / 100
}

/**
 * The value a full bar stands for: `max` when given, else the largest row's total, stretched to
 * keep a reference line inside the track.
 */
export function barTop(
  data: readonly (BarDatum | StackedBarDatum)[],
  max?: number,
  reference?: BarReference,
): number {
  const largest = data.reduce((most, datum) => {
    const total = barTotal(datum)
    return Number.isFinite(total) ? Math.max(most, total) : most
  }, 0)
  return max ??
    (reference && Number.isFinite(reference.value) ? Math.max(largest, reference.value) : largest)
}

/** How {@link barTrack} draws a row. */
export interface BarTrackOptions {
  /** The value of a full bar, from {@link barTop}. */
  top: number
  colors?: readonly string[]
  trackColor: string
  /** The colour of a stacked segment's series; only a list with stacked rows needs it. */
  colorOf?: (series: string) => string
}

/** A row's bar on its track: one bar coloured by rank or by the row's `color`, or stacked segments. */
export function barTrack(
  datum: BarDatum | StackedBarDatum,
  index: number,
  { top, colors, trackColor, colorOf }: BarTrackOptions,
): JSX.Element {
  const total = barTotal(datum)
  return (
    <span
      class="h-2 flex-1 overflow-hidden rounded-sm"
      style={{ background: trackColor }}
    >
      {isStacked(datum)
        ? (
          <span class="flex h-full" style={{ width: `${barPercent(total, top)}%` }}>
            {datum.segments.map((segment) => (
              <span
                key={segment.series}
                data-series={segment.series}
                class="block h-full"
                style={{
                  width: `${barPercent(segment.value, total)}%`,
                  background: colorOf?.(segment.series),
                }}
              />
            ))}
          </span>
        )
        : (
          <span
            class="block h-full rounded-sm"
            style={{
              width: `${barPercent(datum.value, top)}%`,
              background: datum.color ?? seriesColor(index, colors),
            }}
          >
          </span>
        )}
    </span>
  )
}
