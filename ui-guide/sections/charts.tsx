/**
 * The Charts section.
 *
 * All eight of the package's components are live here: the seven that were on the worklist plus
 * `Bars`. The split the package itself makes is the section's structure — the zero-JS half
 * (`Bars`, `LineChart`, `DonutChart`, `Kpi`, `KpiGrid`, `MetricPanel`) renders plain markup and
 * hydrates nothing, and the interactive half (`D3LineChart`, `CompareChart`) draws imperatively
 * with d3 in an effect.
 *
 * Two honesty notes a reader should have before the cards:
 *
 * 1. **The d3 islands are inert in this page's server render, and that is the component's
 *    contract, not a defect.** `D3LineChart` renders an empty, labelled `<svg>` and draws into it
 *    from an effect, so the prerendered card for it is an empty box plus its tooltip `<div>`. The
 *    card says so. Confirming that the axes and the path actually appear needs a browser, which the
 *    `ui-guide/` suite deliberately does not have.
 * 2. **No date comes from the machine clock.** Every time series here is built from explicit ISO
 *    instants in `Z`, and the `CompareChart` range is two fixed `Date`s, so a build on any machine
 *    in any zone renders the same markup.
 *
 * Imports are subpaths rather than the barrel, which is what `charts/README.md` recommends: a
 * consumer who only draws SVG charts then reaches no `d3` specifier at all.
 */

import { type BarDatum, Bars } from "@preact-components/charts/bars"
import { CompareChart } from "@preact-components/charts/compare-chart"
import { D3LineChart } from "@preact-components/charts/d3-line-chart"
import { DonutChart } from "@preact-components/charts/donut-chart"
import { Kpi, type KpiTone } from "@preact-components/charts/kpi"
import { KpiGrid } from "@preact-components/charts/kpi"
import { LineChart } from "@preact-components/charts/line-chart"
import { MetricPanel } from "@preact-components/charts/metric-panel"
import type { ChartPayload, DateRange } from "@preact-components/charts/payload"
import type { TimeSeriesPoint } from "@preact-components/charts/time-series"
import { Button } from "@preact-components/ui"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

/** A handful of rows in the shape `Bars` takes — no helper, no fetch, no scale to compute. */
const bars: BarDatum[] = [
  { label: "alpha", value: 41 },
  { label: "beta", value: 27 },
  { label: "gamma", value: 12 },
  { label: "delta", value: 6 },
]

/** Months, spelled out, so nothing has to parse or localise a date to draw the axis. */
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const

/**
 * Two series over the same X labels — the case `LineChart`'s legend defaults on for.
 *
 * The values are literals. A chart deriving them from `Date.now()` would render different markup
 * every build, which is the one thing a prerendered guide cannot have.
 */
const runs = [
  {
    name: "Planes",
    points: months.map((month, index) => ({ x: month, y: [41, 27, 12, 6, 48, 21][index] })),
  },
  {
    name: "Sorties",
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
    <KpiGrid>
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
const power: TimeSeriesPoint[] = [
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
      "A labelled bar chart from `data` alone, rendered as a table of proportions: no d3, no client JavaScript, no width to measure.",
    snippet: `<Bars data={[{ label: "alpha", value: 41 }]} title="Top planes" />`,
    render: () => <Bars data={bars} title="Planes shot down" />,
  },
  LineChart: {
    summary:
      "Server-rendered SVG line chart over one or more series, taking its X labels from the points themselves. Axis maths lives in `scales.ts`, so a degenerate series — one point, all-equal values, a non-finite `y` — still renders instead of producing NaN coordinates. `showLegend` defaults on for a multi-series chart and off for a single one, and a `yDomain` the caller supplies is honoured exactly, which is what puts two panels on one axis.",
    snippet: `<LineChart
  title="Runs per month"
  series={[{ name: "Runs", points: months.map((m) => ({ x: m.label, y: m.runs })) }]}
  yFormat={(value) => \`\${value} kg\`}
  xStride={2}
/>`,
    render: () => <LineChart series={runs} title="Runs per month" yFormat={(v) => v.toFixed(0)} />,
  },
  DonutChart: {
    summary:
      "Server-rendered donut drawn as one CSS `conic-gradient`, with the centre value in a hole cut by an inset circle. The share maths is exported as `donutGeometry` and tested on its own, which is why a dataset with no positive value renders a flat empty ring instead of the invalid gradient an all-zero total would produce. A datum carrying `href` turns its legend row into a link.",
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
  Kpi: {
    summary:
      "One key-performance-indicator card: label, value, optional caption. Values use tabular figures so a row of them does not jitter as they change. `tone` says what the number is for — `accent` by default, plus `positive`, `warning`, `negative` and `neutral` — rather than the source's `good`/`warn`/`bad` vocabulary.",
    snippet: `<Kpi label="Uptime" value="99.95%" sub="last 30 days" tone="positive" />`,
    render: () => <KpiToneMatrix />,
  },
  KpiGrid: {
    summary:
      "Responsive grid for `Kpi` cards: `repeat(auto-fit, minmax(minWidth, 1fr))`. The column minimum is an inline style rather than a class, because a Tailwind class cannot vary with a prop. `children` may be anything that belongs in the grid, not only `Kpi` — the two grids below differ only in `minWidth`.",
    snippet: `<KpiGrid minWidth="12rem">
  <Kpi label="Uptime" value="99.95%" tone="positive" />
  <Kpi label="Errors" value={3} tone="negative" />
</KpiGrid>`,
    render: () => (
      <div class="space-y-3">
        <KpiGrid minWidth="7rem">
          <Kpi label="Uptime" value="99.95%" sub="last 30 days" tone="positive" />
          <Kpi label="Errors" value={3} tone="negative" />
          <Kpi label="Pending" value={18} tone="warning" />
        </KpiGrid>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          the same three cards at minWidth="14rem"
        </p>
        <KpiGrid minWidth="14rem">
          <Kpi label="Uptime" value="99.95%" sub="last 30 days" tone="positive" />
          <Kpi label="Errors" value={3} tone="negative" />
          <Kpi label="Pending" value={18} tone="warning" />
        </KpiGrid>
      </div>
    ),
  },
  MetricPanel: {
    summary:
      "The shell one metric panel is made of: a heading with its unit, an actions slot, an error box and the chart body as children. Presentational only — it loads nothing. The fetching half is the exported `loadMetricSeries` (and the `useMetricSeries` hook), which takes a `loadStats` port and a `scale` multiplier; that pair is what let `gb`'s two near-identical power and energy panels become one component.",
    snippet: `<MetricPanel
  title="Power"
  unit="kW"
  error={error}
  actions={<ExportButtons />}
>
  <D3LineChart data={power.data} timeFrame={power.timeFrame} ariaLabel="Power, kW" />
</MetricPanel>`,
    render: () => (
      <div class="space-y-6">
        <MetricPanel
          title="Power"
          unit="kW"
          actions={<Button variant="outline" size="sm">Export CSV</Button>}
        >
          <LineChart series={runs} height={200} title="Inverter output" />
        </MetricPanel>
        <MetricPanel
          title="Energy"
          unit="kWh"
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
      "The interactive island: d3 v7 draws into the svg from an effect, re-renders on resize and shows a tooltip built by `tooltipFormat`. It server-renders as an empty, labelled `<svg>` because nothing touches the DOM before the effect runs — so the card below is genuinely empty in this page's server-rendered markup, and confirming that the axes and the path appear needs a browser. `ignoreZeroes` draws zeroes as a gap with a legend note, and `referenceValue` adds a dashed target marker. Needs `d3`, an optional peer declared in `charts/deno.json` and absent from the root import map.",
    snippet: `<D3LineChart
  data={power.data}
  timeFrame="hours"
  referenceValue={12}
  ignoreZeroes
  tickFormat={(value) => value.toFixed(1)}
  ariaLabel="Power, kW"
/>`,
    render: () => (
      <div class="space-y-6">
        <D3LineChart
          data={power}
          timeFrame="hours"
          referenceValue={12}
          ariaLabel="Power, kW"
          tickFormat={(value) => value.toFixed(1)}
        />
        <D3LineChart
          data={[...power, { timeGroup: "2026-03-01T22:00:00.000Z", value: 0 }]}
          timeFrame="hours"
          ignoreZeroes
          ariaLabel="Power with a gap for missing values"
        />
      </div>
    ),
  },
  CompareChart: {
    summary:
      "A `D3LineChart` plus a toggle that loads the window before the current one through a `loadStats` port — the fetch stays with the caller, which is what replaced `gb`'s direct call into its chart store. A failed load becomes a red box beside the second chart instead of a thrown error, and `rangePicker` is a slot for the caller's own date control. It server-renders with the toggle off, so the second chart does not exist until a browser clicks it.",
    snippet: `<CompareChart
  range={range}
  data={power.data}
  timeFrame="hours"
  loadStats={(window) => api.stats({ ...window, kind: "power" })}
  onError={(message) => app.toast.error({ body: message })}
/>`,
    render: () => (
      <CompareChart
        range={range}
        data={power}
        timeFrame="hours"
        loadStats={loadPreviousWindow}
        compareLabel="Compare with the day before"
        ariaLabel="Power, kW"
      />
    ),
  },
} satisfies DemoFragment
