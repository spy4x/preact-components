/**
 * The vocabulary of a time series as a stats endpoint returns it: bucket timestamps and values,
 * and the granularity they were bucketed at. `payload.ts` validates it; a `LineChart` with
 * `xAxis="time"` draws it once each point is mapped to `{ x: timeGroup, y: value }`.
 *
 * This module imports nothing.
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
