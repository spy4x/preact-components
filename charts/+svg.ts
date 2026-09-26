/**
 * `@spy4x/preact-charts/svg` — every export of the package that never reaches `d3`.
 *
 * The issue's split made visible at the import site instead of in documentation: a server route, an
 * MPA or an SSR bundle imports this subpath and cannot accidentally take on the interactive islands,
 * because nothing this module re-exports imports `d3` (directly or through types). `D3LineChart` and
 * `CompareChart` stay on their own subpaths, and `@spy4x/preact-charts` keeps re-exporting both
 * halves for callers who already carry the dependency.
 *
 * The probe in `charts/probe/no-d3-dependency.ts` is meant to prove this: it type-checks and tests
 * this graph with the `d3` specifier remapped so it cannot resolve. It is not yet a proof. Neither
 * `deno task check` nor CI runs it, and on `main` it exits 1 unless `NO_COLOR=1` is set: it
 * searches the test output for a summary line, and colour codes in that output break the match
 * (#123).
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
  assertD3Available,
  type D3LineChartColors,
  DEFAULT_D3_LINE_CHART_COLORS,
  MISSING_D3_LINE_ERROR,
  yDomainFor,
} from "./d3-line-chart-core.ts"
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
export { LineChart, type LineChartProps, type LinePoint, type LineSeries } from "./line-chart.tsx"
export {
  loadMetricSeries,
  type MetricError,
  MetricPanel,
  type MetricPanelProps,
  type MetricSeriesOptions,
  type MetricSeriesState,
  useMetricSeries,
} from "./metric-panel.tsx"
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
export { TIME_FRAMES, type TimeFrame, type TimeSeriesPoint } from "./time-series.ts"
export {
  createInViewObserver,
  type InViewHandle,
  type InViewOptions,
  useInView,
} from "./use-in-view.ts"
