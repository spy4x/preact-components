import { type Type, type } from "arktype"
import { TIME_FRAMES, type TimeFrame, type TimeSeriesPoint } from "./time-series.ts"

/**
 * Data layer for the chart components: the shape a stats endpoint is expected to return, the loader
 * that validates it, and the date-range maths a comparison panel needs.
 *
 * No Preact and no I/O — a loader is always a port the caller supplies, which is what replaced a
 * source application's direct store call and its zod schema.
 */

export interface DateRange {
  from: Date
  to: Date
}

/** One bucket of a time series, as it arrives from an API. */
export const timeSeriesPointSchema: Type<TimeSeriesPoint> = type({
  timeGroup: "string | number | Date",
  value: "number",
})

/** Payload of a stats loader: the points plus the granularity they were bucketed at. */
export const chartPayloadSchema: Type<ChartPayload> = type({
  data: timeSeriesPointSchema.array(),
  timeFrame: type.enumerated(...TIME_FRAMES),
})

export type ChartPayload = {
  data: TimeSeriesPoint[]
  timeFrame: TimeFrame
}

export interface LoadPayloadResult {
  payload: ChartPayload | null
  /** Message from a rejected payload or a throwing loader; `null` on success. */
  error: string | null
}

/**
 * The window before `range`, ending exactly where `range` starts.
 *
 * `steps` walks back further: `2` gives the two windows before the current one. A range with no
 * usable span — a bad loader response, an inverted filter — falls back to one hour, so a comparison
 * request can never ask for an infinite window.
 */
export function previousPeriod(range: DateRange, steps = 1): DateRange {
  const from = toTime(range.from)
  const to = toTime(range.to)
  const span = to > from ? to - from : 60 * 60 * 1000
  const count = Number.isFinite(steps) && steps >= 1 ? Math.floor(steps) : 1

  const end = from - span * (count - 1)
  return { from: new Date(end - span), to: new Date(end) }
}

/**
 * Call a stats loader and validate what it returns.
 *
 * A rejection and an invalid payload are both reported as an `error` string rather than thrown: a
 * comparison panel should show the reason next to the chart it could not draw. Validation is
 * arktype, so a payload shaped like `{ data: [{ timeGroup, value }], timeFrame }` is the only thing
 * that reaches a chart.
 */
export async function loadChartPayload(
  loadStats: (range: DateRange) => Promise<unknown>,
  range: DateRange,
): Promise<LoadPayloadResult> {
  try {
    const raw = await loadStats(range)
    const result = chartPayloadSchema(raw)
    if (result instanceof type.errors) return { payload: null, error: result.summary }

    return { payload: { data: result.data, timeFrame: result.timeFrame }, error: null }
  } catch (cause) {
    return { payload: null, error: cause instanceof Error ? cause.message : String(cause) }
  }
}

/** Parse a date-ish value, falling back to the epoch for anything unusable. */
function toTime(value: Date | string | number): number {
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}
