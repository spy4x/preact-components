/**
 * `@preact-components/charts` — server-rendered SVG charts and interactive d3 wrappers.
 *
 * Two approaches live here side by side, and the split is load-bearing. `LineChart`, `Bars`,
 * `DonutChart`, `Kpi` and `MetricPanel` render plain markup server-side with no JavaScript at all
 * and reach no `d3` specifier anywhere in their import graph. `D3LineChart` and `CompareChart` are
 * interactive islands that draw with d3 in an effect; they are the only reason this package needs
 * `d3`, which is why it is not in the root import map — a consumer adds it when they want the
 * islands (`charts/README.md`). Both take their colours and their data through props — nothing in
 * this package reads an application store or a global signal.
 *
 * This barrel does re-export the d3 islands, so importing it makes `d3` a resolvable specifier for
 * the importing package, and Deno has to type-check the island either way. Subpath imports
 * (`@preact-components/charts/bars`) avoid even that. They are not needed for bundle size: these are
 * side-effect-free ES modules, and Rollup eliminates a re-export nothing uses — issue #25 measured a
 * barrel consumer that renders only `Bars` at 42 bytes with no d3 marker, from a Vite build outside
 * this repo. Subpath imports are the robust choice, because they hold that guarantee with tree-shaking
 * off, `sideEffects` misconfigured, or a bundler that never had it — not because the barrel pulls d3
 * in.
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
export { TIME_FRAMES, type TimeFrame, type TimeSeriesPoint } from "./time-series.ts"
