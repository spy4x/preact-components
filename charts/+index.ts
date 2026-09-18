/**
 * `@preact-components/charts` — server-rendered SVG charts and interactive d3 wrappers.
 *
 * Two approaches live here side by side. `LineChart`, `Bars`, `DonutChart` and `Kpi` render plain
 * markup server-side with no JavaScript at all; `D3LineChart` and `CompareChart` are interactive
 * islands that draw with d3 in an effect. Both take their colours and their data through props —
 * nothing in this package reads an application store or a global signal.
 *
 * Import a single chart from its own subpath (`@preact-components/charts/bars`) when the barrel
 * would pull in d3 as well.
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
export { CompareChart, type CompareChartProps } from "./compare-chart.tsx"
export {
  D3LineChart,
  type D3LineChartColors,
  type D3LineChartProps,
  DEFAULT_D3_LINE_CHART_COLORS,
  defaultTooltipFormat,
  formatTimeTick,
  TIME_FRAMES,
  type TimeFrame,
  type TimeSeriesPoint,
  yDomainFor,
} from "./d3-line-chart.tsx"
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
export {
  createInViewObserver,
  type InViewHandle,
  type InViewOptions,
  useInView,
} from "./use-in-view.ts"
