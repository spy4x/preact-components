/**
 * Pure axis maths for the charts in this package.
 *
 * Nothing here touches Preact, the DOM or `d3`: every function is a total, deterministic mapping
 * from numbers to numbers, which is why the axis behaviour is testable without a renderer. The
 * `niceStep`/`ticks` pair now lives once, in `@spy4x/platform/universal/axis` (spy4x/ts-libs#70,
 * spy4x/preact-components#123), and is re-exported here so `./scales` — this package's own public
 * subpath — keeps both names for its existing importers (`ticks.worker.ts`, `line-chart.tsx`, the
 * package barrels). `niceScale`'s own tick generation below is a different, package-local user of
 * the same step/round primitives and is unaffected.
 */
import { niceStep, ticks } from "@spy4x/platform/universal/axis"
export { niceStep, ticks }

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
 *
 * **Bounded by `MAX_TICKS`, not just its output.** `steps` is `(end - start) / step`, and an absurd
 * tick target (`niceScale(1e6, 2e6, { target: 1e25 })`, say) makes `step` many orders of magnitude
 * smaller than the float precision at `low`/`high`'s magnitude. Every `roundToStep` result then
 * collapses onto the same handful of doubles, so `out.length` almost stops growing while `index`
 * keeps climbing toward a `steps` that can itself be `1e25` — relying on `out.length < MAX_TICKS`
 * alone never terminates, which is exactly this bug: it shipped on `main` until it was found and
 * fixed the same way in `@spy4x/platform/universal/axis`'s copy (spy4x/ts-libs#70) and ported back.
 * Capping the loop itself at `Math.min(steps + 1, MAX_TICKS)` is the fix: return whichever ticks
 * distinguish themselves within `MAX_TICKS` iterations — as few as one, if the target is absurd
 * enough that nothing else is representable — rather than hang the page.
 */
function ticksForStep(low: number, high: number, step: number): number[] {
  const start = Math.floor(low / step) * step
  const end = Math.ceil(high / step) * step
  const steps = Math.round((end - start) / step)
  if (!Number.isFinite(steps) || steps < 0) return [low, high]

  const out: number[] = []
  const iterationCeiling = Math.min(steps + 1, MAX_TICKS)
  for (let index = 0; index <= iterationCeiling && out.length < MAX_TICKS; index++) {
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
