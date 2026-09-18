/**
 * Pure axis maths for the charts in this package.
 *
 * Nothing here touches Preact, the DOM or `d3`: every function is a total, deterministic mapping
 * from numbers to numbers, which is why the axis behaviour is testable without a renderer. The
 * `niceStep`/`ticks` pair comes from `warthunder-stats`; the degenerate, reversed and
 * extreme-magnitude cases are hardened here.
 */

/**
 * Hard ceiling on generated ticks. A safety net rather than a tested path: the index-driven loop
 * terminates on its own for every input the tests exercise.
 */
const MAX_TICKS = 1_000

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

/**
 * Round a positive span up to a sensible tick step at the requested tick count.
 *
 * The magnitude is chosen from the span (1, 2, 5 or 10 × 10ⁿ) and then divided by `target`, so the
 * result is a round number *and* the axis lands on roughly `target` steps.
 *
 * No floor is applied. The source clamped with `Math.max(1e-9, step)`, which below about `3e-9`
 * made the step coarser than requested and below `1e-9` made it exceed the span itself — so
 * `ticks(0, 1e-12)` returned a single `0` tick. Non-positive and non-finite spans still fall back
 * to `1`, and a span whose step underflows keeps the smallest positive step rather than collapsing
 * to `0`.
 */
export function niceStep(span: number, target = 5): number {
  if (!Number.isFinite(span) || span <= 0) return 1

  const wanted = normaliseTarget(target)
  const exponent = Math.floor(Math.log10(span))
  const fraction = span / 10 ** exponent

  let niceFraction: number
  if (fraction < 1.5) niceFraction = 1
  else if (fraction < 3) niceFraction = 2
  else if (fraction < 7) niceFraction = 5
  else niceFraction = 10

  const step = (niceFraction * 10 ** exponent) / wanted
  if (Number.isFinite(step) && step > 0) return step

  // Subnormal spans underflow here; keep the smallest positive step rather than returning 0,
  // which would make tick generation divide by zero.
  const fallback = span / wanted
  return Number.isFinite(fallback) && fallback > 0 ? fallback : Number.MIN_VALUE
}

/**
 * Tick values covering `[min, max]`, expanded outward to the next nice step.
 *
 * Reversed bounds are swapped rather than rejected, `min === max` returns that single value so a
 * degenerate axis divides by nothing, and non-finite bounds return an empty axis.
 */
export function ticks(min: number, max: number, maxTicks = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []

  const [low, high] = min <= max ? [min, max] : [max, min]
  if (low === high) return [low]

  const step = niceStep(high - low, maxTicks)
  if (!Number.isFinite(step) || step <= 0) return [low, high]
  return ticksForStep(low, high, step)
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
 */
export function niceScale(min: number, max: number, options: NiceScaleOptions = {}): NiceScale {
  const target = normaliseTarget(options.target)
  const padded = paddedDomain(min, max, options.padRatio)
  const step = niceStep(padded.max - padded.min, target)
  if (!Number.isFinite(step) || step <= 0) {
    return {
      min: padded.min,
      max: padded.max,
      step: 1,
      ticks: ticksForStep(padded.min, padded.max, 1),
    }
  }

  const low = roundToStep(Math.floor(padded.min / step) * step, step)
  const high = roundToStep(Math.ceil(padded.max / step) * step, step)

  return { min: low, max: high, step, ticks: ticksForStep(low, high, step) }
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

/**
 * Tick values for `[low, high]` at a given step, limited to the bounds ± half a step.
 *
 * Values are rounded relative to the step instead of to a fixed number of decimals: rounding to
 * eight decimals collapses every tick of a sub-nanosecond span to `0`, and a fixed-decimal form
 * cannot represent a step like `2e-13` at all.
 *
 * The loop advances by index rather than by cursor. Where the step is finer than the float precision
 * of the bounds, `v += step` is a no-op — `ticks(1e18, 1e18 + 100)` never terminates with a cursor,
 * because one ulp at `1e18` is 128 while the nice step is 20 — so the source looped forever there.
 * Multiplying the index moves the cursor in multiples of the step and always terminates; repeated
 * values collapse, leaving the representable bounds.
 */
function ticksForStep(low: number, high: number, step: number): number[] {
  const start = Math.floor(low / step) * step
  const end = Math.ceil(high / step) * step
  const steps = Math.round((end - start) / step)
  if (!Number.isFinite(steps) || steps < 0) return [low, high]

  const out: number[] = []
  for (let index = 0; index <= steps + 1 && out.length < MAX_TICKS; index++) {
    const value = roundToStep(start + index * step, step)
    if (value < low - step / 2 || value > high + step / 2) continue
    if (out.length > 0 && out[out.length - 1] === value) continue
    out.push(value)
  }

  return out.length > 0 ? out : [low, high]
}

/** Round to the precision implied by `step`, keeping only exactly representable magnitudes. */
function roundToStep(value: number, step: number): number {
  const decimals = -Math.floor(Math.log10(step))
  const factor = decimals > 0 ? 10 ** decimals : 1
  if (!Number.isFinite(factor) || factor === 0) return value

  const rounded = Math.round(value * factor) / factor
  return Number.isFinite(rounded) ? rounded : value
}

/** Coerce a tick target to a usable step count; garbage falls back to the default of 5. */
function normaliseTarget(target: number | undefined): number {
  return target !== undefined && Number.isFinite(target) && target >= 1 ? Math.floor(target) : 5
}
