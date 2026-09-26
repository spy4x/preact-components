/**
 * The parts of `D3LineChart` that need no d3: its colour defaults, the missing-d3 guard and its
 * message, and the Y-domain maths.
 *
 * They live apart from `d3-line-chart.tsx` so a caller can use them without `d3` in its graph — the
 * UI guide imports them statically and prints their output on the server, while the island itself
 * loads only when the charts page opens. `d3-line-chart.tsx` re-exports every one of them, so its
 * import path keeps working. Nothing here may import `d3`, directly or through a type:
 * `probe/no-d3-dependency.ts` checks this module with `d3` unresolvable.
 */

import { DEFAULT_AXIS_COLOR, DEFAULT_SURFACE_COLOR, DEFAULT_TEXT_COLOR } from "./colors.ts"
import type { TimeSeriesPoint } from "./time-series.ts"

export interface D3LineChartColors {
  line: string
  /** The second, greyed-out path drawn when zeroes are ignored. */
  ignoredLine: string
  point: string
  axis: string
  reference: string
  surface: string
  text: string
  tooltipBackground: string
  tooltipBorder: string
  tooltipText: string
}

export const DEFAULT_D3_LINE_CHART_COLORS: D3LineChartColors = {
  line: "var(--color-primary, oklch(0.38 0.17 293))",
  ignoredLine: "var(--color-muted-foreground, oklch(0.551 0.027 264.364))",
  point: "var(--color-primary, oklch(0.38 0.17 293))",
  axis: DEFAULT_AXIS_COLOR,
  reference: "var(--color-warning, oklch(0.646 0.222 41.116))",
  surface: DEFAULT_SURFACE_COLOR,
  text: DEFAULT_TEXT_COLOR,
  tooltipBackground: DEFAULT_SURFACE_COLOR,
  tooltipBorder: "var(--color-border-subtle, oklch(0.928 0.006 264.531))",
  tooltipText: "var(--color-foreground, oklch(0.13 0.028 261.692))",
}

/** Actionable message for a consumer whose bundler handed this island a `d3` that carries nothing. */
export const MISSING_D3_LINE_ERROR =
  "@spy4x/preact-charts/d3-line-chart needs d3, which is an optional peer of this package: " +
  "the SVG charts (bars, donut-chart, kpi, line-chart, scales) and metric-panel never load it. " +
  "Add the dependency yourself — `deno add npm:d3@7.9.0` or `npm i d3@7.9.0` — or import only the " +
  "zero-JS charts."

/**
 * Refuse to draw unless d3 offers its line generator.
 *
 * `d3` is deliberately not in the root import map (see `charts/README.md`), so a consumer who never
 * adds it fails to resolve the specifier at all — Deno and every bundler report that loudly at build
 * time, which is the good outcome. This guard covers the case that survives to runtime: `d3`
 * resolves to something that carries no generator (a stub, a failed optional dependency, a wrong
 * package pinned under the name). Without it the failure is `d3.line is not a function` inside a
 * `useEffect`, with no hint that the fix is a dependency.
 *
 * Exported and unit-tested precisely because the effect that calls it needs a DOM.
 */
export function assertD3Available(candidate: unknown): void {
  const line = (candidate as { line?: unknown } | null | undefined)?.line
  if (typeof line !== "function") throw new Error(MISSING_D3_LINE_ERROR)
}

/**
 * Y domain for a time series: `0` is always in range, the maximum keeps 20% headroom and a
 * reference marker is included even when it sits above every value.
 *
 * `ignoreZeroes` starts the domain at the smallest non-zero value, which is what makes a sparse
 * energy series readable. A domain that would collapse — an empty series, all zeroes — widens to
 * `[0, 1]` instead of producing `NaN` coordinates.
 */
export function yDomainFor(
  points: readonly TimeSeriesPoint[],
  options: { ignoreZeroes?: boolean; referenceValue?: number; headroom?: number } = {},
): [number, number] {
  const headroom = Number.isFinite(options.headroom) && (options.headroom as number) > 0
    ? options.headroom as number
    : 1.2

  let min = 0
  let max = 0

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue
    if (point.value > max) max = point.value
    if (options.ignoreZeroes) {
      if (point.value !== 0 && (min === 0 || point.value < min)) min = point.value
    } else if (point.value < min) min = point.value
  }

  if (options.referenceValue !== undefined && Number.isFinite(options.referenceValue)) {
    max = Math.max(max, options.referenceValue)
  }

  const upper = max > 0 ? max * headroom : 0
  return upper > min ? [min, upper] : [min, min + 1]
}
