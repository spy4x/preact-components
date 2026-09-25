/**
 * Pure axis maths for the charts in this package.
 *
 * Nothing here touches Preact, the DOM or `d3`: every function is a total, deterministic mapping
 * from numbers to numbers, which is why the axis behaviour is testable without a renderer. The
 * `niceStep`/`ticks` pair and the tick loop behind `niceScale` live once, in
 * `@spy4x/platform/universal/axis` (spy4x/ts-libs#70, spy4x/ts-libs#201,
 * spy4x/preact-components#123). `niceStep` and `ticks` are re-exported here so `./scales` — this
 * package's own public subpath — keeps both names for its existing importers (`ticks.worker.ts`,
 * `line-chart.tsx`, the package barrels).
 */
import { niceStep, stepAxis, ticks } from "@spy4x/platform/universal/axis"
export { niceStep, ticks }

/** Domain returned when the caller passes values that cannot be plotted. */
const FALLBACK_DOMAIN: readonly [number, number] = [0, 1]

export interface NiceScale {
  /** Lower bound, rounded outward to a multiple of {@link NiceScale.step}. */
  min: number
  /** Upper bound, rounded outward to a multiple of {@link NiceScale.step}. */
  max: number
  /** Distance between two ticks. */
  step: number
  /** Tick values covering `[min, max]`, both ends inclusive. */
  ticks: number[]
}

export interface NiceScaleOptions {
  /** Requested number of steps. Defaults to `5`, giving about six ticks. */
  target?: number
  /** Fraction of the span added below and above the data. Defaults to `0.1`. */
  padRatio?: number
}

/** Finite-only `[min, max]`, or `null` when nothing is plottable. */
export function extent(values: readonly number[]): readonly [number, number] | null {
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  return min <= max ? [min, max] : null
}

/** Pad a domain by a fraction of its span, so points never sit on the axis frame. */
export function paddedDomain(
  min: number,
  max: number,
  padRatio = 0.1,
): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: FALLBACK_DOMAIN[0], max: FALLBACK_DOMAIN[1] }
  }

  const [low, high] = min <= max ? [min, max] : [max, min]
  const ratio = Number.isFinite(padRatio) && padRatio > 0 ? padRatio : 0
  const span = high - low
  // A single value has no span to pad, so it falls back to 10% of its own magnitude (or 1).
  const pad = span > 0 ? span * ratio : Math.abs(high) * ratio || 1

  return { min: low - pad, max: high + pad }
}

/**
 * Padded, rounded-outward domain plus the tick values that go with it.
 *
 * This is what a chart actually wants: the caller hands in the raw data extent, and gets back a
 * domain whose bounds are multiples of {@link NiceScale.step} together with the matching ticks. A
 * single-value series still produces a usable, non-degenerate domain.
 *
 * Rounding and ticks come from `stepAxis`, so they follow its rules: every tick is an exact multiple
 * of the step, even a step like `2.5` (`niceScale(0, 10, { target: 4 })` starts at `-2.5`); a padded
 * domain that overflows to `±Infinity` has no ticks; `Infinity` is never a tick or a bound that a
 * finite domain rounds up to; and a step too fine for the domain leaves the bounds unrounded
 * instead of turning them into `Infinity`. A step `niceStep` cannot produce falls back to `1`.
 */
export function niceScale(min: number, max: number, options: NiceScaleOptions = {}): NiceScale {
  const padded = paddedDomain(min, max, options.padRatio)
  // `niceStep` treats a missing, non-finite or below-1 target as the default of 5.
  const nice = niceStep(padded.max - padded.min, options.target)
  const step = Number.isFinite(nice) && nice > 0 ? nice : 1
  const axis = stepAxis(padded.min, padded.max, step)
  return { min: axis.min, max: axis.max, step, ticks: axis.ticks }
}

/**
 * Map a domain onto a pixel range.
 *
 * A degenerate domain — one value, or non-finite input — maps everything to the middle of the
 * range, so a single-point series renders instead of producing `NaN` coordinates. Reversed ranges
 * are supported on purpose: that is how a Y axis is flipped (`[0, 10] → [height, 0]`).
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): (value: number) => number {
  const [domainStart, domainEnd] = domain
  const [rangeStart, rangeEnd] = range
  const middle = (rangeStart + rangeEnd) / 2

  if (
    !Number.isFinite(domainStart) || !Number.isFinite(domainEnd) ||
    !Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) ||
    domainStart === domainEnd
  ) {
    return () => middle
  }

  const factor = (rangeEnd - rangeStart) / (domainEnd - domainStart)
  return (value) => Number.isFinite(value) ? rangeStart + (value - domainStart) * factor : middle
}

/**
 * Draw every `stride`-th X label and always the last one, so a dense axis keeps a readable label
 * count without dropping the right-hand end.
 */
export function xLabelStride(count: number, maxLabels = 8): number {
  const limit = Number.isFinite(maxLabels) && maxLabels >= 1 ? Math.floor(maxLabels) : 8
  if (!Number.isFinite(count) || count <= 1) return 1
  return Math.max(1, Math.ceil(count / limit))
}
