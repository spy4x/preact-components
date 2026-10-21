import { type Type, type } from "arktype"
import type { TimeFrame, TimeSeriesPoint } from "./time-series.ts"

/**
 * The shape a stats endpoint is expected to return for a chart, and its arktype schema.
 *
 * No Preact and no I/O: loading is the caller's, and a caller validates a response with
 * {@link timeSeriesPointSchema} before mapping it to chart points.
 */

/** One bucket of a time series, as it arrives from an API. */
export const timeSeriesPointSchema: Type<TimeSeriesPoint> = type({
  timeGroup: "string | number | Date",
  value: "number",
})

/** Payload of a stats loader: the points plus the granularity they were bucketed at. */
export type ChartPayload = {
  data: TimeSeriesPoint[]
  timeFrame: TimeFrame
}
