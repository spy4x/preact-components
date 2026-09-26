/**
 * The Charts section.
 *
 * Every component the package exports is live here. The split the package itself makes is the
 * section's structure — the zero-JS half
 * (`Bars`, `LineChart`, `DonutChart`, `Kpi`, `KpiGrid`, `MetricPanel`) renders plain markup and
 * hydrates nothing, and the interactive half (`D3LineChart`, `CompareChart`) draws imperatively
 * with d3 in an effect.
 *
 * Two honesty notes a reader should have before the cards:
 *
 * 1. **The d3 islands are inert in this page's server render, and that is the component's contract,
 *    not a defect.** `D3LineChart` renders an empty, labelled `<svg>` and draws into it from an
 *    effect; this page also loads the component only when it shows, so the prerendered card is a
 *    placeholder. The card says so. Confirming that the axes and the path actually appear needs a
 *    browser, which the `ui-guide/` suite deliberately does not have.
 * 2. **No date comes from the machine clock.** Every time series here is built from explicit ISO
 *    instants in `Z`, and the `CompareChart` range is two fixed `Date`s, so a build on any machine
 *    in any zone renders the same markup.
 *
 * Imports are subpaths rather than the barrel, which is what `charts/README.md` recommends: a
 * consumer who only draws SVG charts then reaches no `d3` specifier at all. The two d3 islands are
 * not imported here at all: `charts-d3.tsx` loads them with a dynamic `import()` when this page
 * shows, so an app that mounts the guide loads d3 only once someone opens the charts page. Until
 * the module arrives — which includes the server render — their cards show a placeholder.
 */

import { type BarDatum, Bars } from "@spy4x/preact-charts/bars"
import { DonutChart } from "@spy4x/preact-charts/donut-chart"
import { Kpi, type KpiTone } from "@spy4x/preact-charts/kpi"
import { KpiGrid } from "@spy4x/preact-charts/kpi"
import { LineChart } from "@spy4x/preact-charts/line-chart"
import { MetricPanel } from "@spy4x/preact-charts/metric-panel"
import type { ChartPayload, DateRange } from "@spy4x/preact-charts/payload"
import type { TimeSeriesPoint } from "@spy4x/preact-charts/time-series"
import { Button } from "@spy4x/preact-ui"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"
import { LazyCompareChart, LazyD3LineChart } from "./charts-d3.tsx"

/** A handful of rows in the shape `Bars` takes — no helper, no fetch, no scale to compute. */
const bars: BarDatum[] = [
  { label: "Starter", value: 41 },
  { label: "Team", value: 27 },
  { label: "Business", value: 12 },
  { label: "Enterprise", value: 6 },
]

/** Months, spelled out, so nothing has to parse or localise a date to draw the axis. */
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const

/**
 * Two series over the same X labels — the case `LineChart`'s legend defaults on for.
 *
 * The values are literals. A chart deriving them from `Date.now()` would render different markup
 * every build, which is the one thing a prerendered guide cannot have.
 */
const orders = [
  {
    name: "Orders",
    points: months.map((month, index) => ({ x: month, y: [41, 27, 12, 6, 48, 21][index] })),
  },
  {
    name: "Returns",
    points: months.map((month, index) => ({ x: month, y: [28, 19, 9, 4, 33, 14][index] })),
  },
]

/** Four slices summing to 100, so the legend percentages read as a whole. */
const traffic: { label: string; value: number; href?: string }[] = [
  { label: "Organic", value: 52 },
  { label: "Referral", value: 24, href: "?source=referral" },
  { label: "Direct", value: 15 },
  { label: "Email", value: 9 },
]

/** One label per tone — a tone with no label does not compile. */
const tones: Record<KpiTone, string> = {
  accent: "Accent",
  positive: "Positive",
  warning: "Warning",
  negative: "Negative",
  neutral: "Neutral",
}

/**
 * Every tone at one value, which is the only thing that distinguishes the five cards.
 *
 * The value is identical on purpose: a reader comparing the tones is not also comparing numbers.
 */
function KpiToneMatrix() {
  return (
    <KpiGrid minWidth="8rem">
      {entries(tones).map(([tone, label]) => (
        <Kpi key={tone} label={label} value={42} sub={`tone="${tone}"`} tone={tone} />
      ))}
    </KpiGrid>
  )
}

/** An explicit window, both ends in `Z`, so the panel's chart and its heading are reproducible. */
const range: DateRange = {
  from: new Date("2026-03-01T00:00:00.000Z"),
  to: new Date("2026-03-02T00:00:00.000Z"),
}

/** Hourly buckets for the primary chart, all on one fixed day. */
const revenue: TimeSeriesPoint[] = [
  { timeGroup: "2026-03-01T00:00:00.000Z", value: 6.1 },
  { timeGroup: "2026-03-01T04:00:00.000Z", value: 5.4 },
  { timeGroup: "2026-03-01T08:00:00.000Z", value: 9.8 },
  { timeGroup: "2026-03-01T12:00:00.000Z", value: 12.4 },
  { timeGroup: "2026-03-01T16:00:00.000Z", value: 10.2 },
  { timeGroup: "2026-03-01T20:00:00.000Z", value: 7.3 },
]

/**
 * A `loadStats` port answering the comparison window out of a constant.
 *
 * `CompareChart` only calls it after its toggle is switched on, so the server render never reaches
 * it. The payload is the documented shape rather than a stub, so a browser that does toggle it gets
 * a real second series.
 */
function loadPreviousWindow(): Promise<unknown> {
  const payload: ChartPayload = {
    timeFrame: "hours",
    data: [
      { timeGroup: "2026-02-28T00:00:00.000Z", value: 5.2 },
      { timeGroup: "2026-02-28T04:00:00.000Z", value: 4.9 },
      { timeGroup: "2026-02-28T08:00:00.000Z", value: 8.4 },
      { timeGroup: "2026-02-28T12:00:00.000Z", value: 11.1 },
      { timeGroup: "2026-02-28T16:00:00.000Z", value: 9.6 },
      { timeGroup: "2026-02-28T20:00:00.000Z", value: 6.8 },
    ],
  }
  return Promise.resolve(payload)
}

export const chartsDemos = {
  Bars: {
    summary:
      "A labelled bar chart drawn as a table of proportions: no d3, no client JavaScript, no width to measure.",
    wide: false,
    props: [
      { name: "data", type: "BarDatum[]", description: "The rows: a label and a value each." },
      {
        name: "max",
        type: "number",
        default: "the largest value",
        description: "The value the longest bar stands for, to compare two lists.",
      },
      {
        name: "format",
        type: "(value: number) => string",
        default: "String",
        description: "How the trailing number is printed.",
      },
      { name: "title", type: "string", description: "The heading, and the table's name." },
    ],
    snippet: `<Bars data={[{ label: "Starter", value: 41 }]} title="Orders by plan" />`,
    render: () => <Bars data={bars} title="Orders by plan" />,
  },
  DonutChart: {
    summary:
      "A server-rendered donut drawn with one CSS `conic-gradient`, whose legend rows turn into links when a slice has an `href`.",
    wide: false,
    snippet: `<DonutChart
  data={[{ label: "Organic", value: 52 }, { label: "Referral", value: 24, href: "/referral" }]}
  centerValue="12.4k"
  centerLabel="sessions"
  title="Traffic sources"
/>`,
    render: () => (
      <DonutChart
        data={traffic}
        centerValue="12.4k"
        centerLabel="sessions"
        title="Traffic sources"
      />
    ),
  },
  LineChart: {
    summary:
      "A server-rendered SVG line chart over one or more series that still draws when a series is one point, flat or has a gap.",
    wide: true,
    props: [
      { name: "series", type: "LineSeries[]", description: "Each line: a name and its points." },
      {
        name: "yDomain",
        type: "[number, number]",
        default: "padded from the data",
        description: "Fixes the Y axis, which is how two panels share one scale.",
      },
      {
        name: "yFormat",
        type: "(value: number) => string",
        default: "two decimals",
        description: "How a Y tick is printed.",
      },
      {
        name: "showLegend",
        type: "boolean",
        default: "true for two or more series",
        description: "Shows the series names under the chart.",
      },
    ],
    snippet: `<LineChart
  title="Orders per month"
  series={[{ name: "Orders", points: months.map((m) => ({ x: m.label, y: m.orders })) }]}
  yFormat={(value) => value.toFixed(0)}
  xStride={2}
/>`,
    render: () => (
      <LineChart
        series={orders}
        title="Orders per month"
        yFormat={(v) => v.toFixed(0)}
      />
    ),
  },
  Kpi: {
    summary:
      "One key figure with its label and caption, in five tones that say what the number is for.",
    wide: true,
    snippet: `<Kpi label="Uptime" value="99.95%" sub="last 30 days" tone="positive" />`,
    render: () => <KpiToneMatrix />,
  },
  KpiGrid: {
    summary:
      "A responsive grid of `Kpi` cards whose column width is the `minWidth` prop; the two grids below differ only in it.",
    wide: true,
    snippet: `<KpiGrid minWidth="12rem">
  <Kpi label="Uptime" value="99.95%" tone="positive" />
  <Kpi label="Errors" value={3} tone="negative" />
</KpiGrid>`,
    render: () => (
      <div class="flex flex-col gap-3">
        <KpiGrid minWidth="7rem">
          <Kpi label="Uptime" value="99.95%" sub="last 30 days" tone="positive" />
          <Kpi label="Errors" value={3} tone="negative" />
          <Kpi label="Pending" value={18} tone="warning" />
          <Kpi label="Users" value={1204} />
          <Kpi label="Latency" value="84 ms" />
        </KpiGrid>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          the same five cards at minWidth="16rem"
        </p>
        <KpiGrid minWidth="16rem">
          <Kpi label="Uptime" value="99.95%" sub="last 30 days" tone="positive" />
          <Kpi label="Errors" value={3} tone="negative" />
          <Kpi label="Pending" value={18} tone="warning" />
          <Kpi label="Users" value={1204} />
          <Kpi label="Latency" value="84 ms" />
        </KpiGrid>
      </div>
    ),
  },
  MetricPanel: {
    summary:
      "The frame one metric is shown in — heading with unit, actions, an error box and the chart — which loads nothing itself.",
    wide: true,
    snippet: `<MetricPanel
  title="Revenue"
  unit="k€"
  error={error}
  actions={<ExportButtons />}
>
  <D3LineChart data={revenue.data} timeFrame={revenue.timeFrame} ariaLabel="Revenue, k€" />
</MetricPanel>`,
    render: () => (
      <div class="flex flex-col gap-6">
        <MetricPanel
          title="Revenue"
          unit="k€"
          actions={<Button variant="outline" size="sm">Export CSV</Button>}
        >
          <LineChart series={orders} height={200} title="Orders and returns" />
        </MetricPanel>
        <MetricPanel
          title="Sessions"
          unit="per day"
          error={{
            message: "The stats endpoint returned 502.",
            instruction: "Widen the date range and try again.",
          }}
          actions={<Button variant="outline" size="sm">Export CSV</Button>}
        >
          <LineChart series={[]} height={200} title="No series" />
        </MetricPanel>
      </div>
    ),
  },
  D3LineChart: {
    summary:
      "The interactive line chart: d3 draws it in the browser with tooltips, a target line and gaps for missing values.",
    wide: true,
    snippet: `<D3LineChart
  data={revenue.data}
  timeFrame="hours"
  referenceValue={12}
  ignoreZeroes
  tickFormat={(value) => value.toFixed(1)}
  ariaLabel="Revenue, k€"
/>`,
    render: () => (
      <div class="flex flex-col gap-6">
        <LazyD3LineChart
          data={revenue}
          timeFrame="hours"
          referenceValue={12}
          ariaLabel="Revenue, k€"
          tickFormat={(value) => value.toFixed(1)}
        />
        <LazyD3LineChart
          data={[...revenue, { timeGroup: "2026-03-01T22:00:00.000Z", value: 0 }]}
          timeFrame="hours"
          ignoreZeroes
          ariaLabel="Revenue with a gap for missing values"
        />
      </div>
    ),
  },
  CompareChart: {
    summary:
      "A `D3LineChart` with a toggle that loads the previous window through a `loadStats` port and draws it beside the current one.",
    wide: true,
    snippet: `<CompareChart
  range={range}
  data={revenue.data}
  timeFrame="hours"
  loadStats={(window) => api.stats({ ...window, kind: "revenue" })}
  onError={(message) => app.toast.error({ body: message })}
/>`,
    render: () => (
      <LazyCompareChart
        range={range}
        data={revenue}
        timeFrame="hours"
        loadStats={loadPreviousWindow}
        compareLabel="Compare with the day before"
        ariaLabel="Revenue, k€"
      />
    ),
  },
} satisfies DemoFragment
