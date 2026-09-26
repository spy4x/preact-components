/**
 * `@spy4x/preact-charts` — charts that render complete on the server and become interactive in a
 * browser, plus the axis and loading helpers behind them.
 *
 * `LineChart`, `Bars`, `DonutChart` and `Kpi` render plain markup with no JavaScript. `LineChart`
 * and `DonutChart` add a tooltip, by pointer and by keyboard, once they run in a browser. Nothing in
 * the package imports a charting library, and nothing reads an application store or a global
 * signal: colours and data arrive through props.
 */

export { type BarDatum, barPercent, Bars, type BarsProps } from "./bars.tsx"
export {
  DEFAULT_AXIS_COLOR,
  DEFAULT_CHART_PALETTE,
  DEFAULT_GRID_COLOR,
  DEFAULT_SURFACE_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TRACK_COLOR,
  seriesColor,
} from "./colors.ts"
export {
  DonutChart,
  type DonutChartProps,
  type DonutDatum,
  type DonutGeometry,
  donutGeometry,
  type DonutGeometryOptions,
  type DonutSegment,
} from "./donut-chart.tsx"
export { Kpi, KpiGrid, type KpiGridProps, type KpiProps, type KpiTone } from "./kpi.tsx"
export {
  LineChart,
  type LineChartProps,
  type LinePoint,
  type LineSeries,
  type LineX,
} from "./line-chart.tsx"
export {
  type ChartPayload,
  chartPayloadSchema,
  type DateRange,
  loadChartPayload,
  type LoadPayloadResult,
  previousPeriod,
  timeSeriesPointSchema,
} from "./payload.ts"
export {
  extent,
  linearScale,
  type NiceScale,
  niceScale,
  type NiceScaleOptions,
  niceStep,
  paddedDomain,
  ticks,
  xLabelStride,
} from "./scales.ts"
export {
  createInViewObserver,
  type InViewHandle,
  type InViewOptions,
  useInView,
} from "./use-in-view.ts"
export { TIME_FRAMES, type TimeFrame, type TimeSeriesPoint } from "./time-series.ts"
