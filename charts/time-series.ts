/**
 * The vocabulary every time-series module shares, kept free of `d3` on purpose.
 *
 * `D3LineChart` owns `TIME_FRAMES`, `TimeFrame` and `TimeSeriesPoint`, but `payload.ts` and
 * `metric-panel.tsx` only need the vocabulary: a validated payload and a panel around the chart.
 * While those two imported the d3-backed module — even for types alone — type-checking a
 * zero-dependency consumer still had to resolve `d3`. They import from here instead, so the
 * `scales` / `bars` / `donut-chart` / `kpi` / `line-chart` / `colors` / `payload` / `metric-panel`
 * side of the package reaches no `d3` specifier at all.
 *
 * This module imports nothing. Anything added here must stay that way.
 */

/** The bucket granularities a series can be aggregated at. */
export const TIME_FRAMES = ["minutes", "hours", "days"] as const

/** Bucket granularity of a series, which decides the X tick format. */
export type TimeFrame = typeof TIME_FRAMES[number]

export interface TimeSeriesPoint {
  /** Bucket timestamp. An ISO string, an epoch number or a `Date` are all accepted. */
  timeGroup: string | number | Date
  value: number
}
