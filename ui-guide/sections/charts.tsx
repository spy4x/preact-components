/**
 * The Charts section.
 *
 * Every chart here renders complete on the server and hydrates with the page: `LineChart` and
 * `DonutChart` add their tooltips once the browser runs them, and nothing on this page loads a
 * charting library.
 *
 * No date comes from the machine clock. Every time series here is built from explicit ISO instants
 * in `Z`, and the time axis prints in UTC by default, so a build on any machine in any zone renders
 * the same markup, and the browser prints what the server did.
 */

import { type BarDatum, Bars } from "@spy4x/preact-charts/bars"
import { DonutChart } from "@spy4x/preact-charts/donut-chart"
import { Kpi, type KpiTone } from "@spy4x/preact-charts/kpi"
import { KpiGrid } from "@spy4x/preact-charts/kpi"
import { LineChart, type LineSeries } from "@spy4x/preact-charts/line-chart"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

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

/** Hourly revenue on one fixed day, with a reading missing at 14:00. */
const today = [6.1, 5.4, 7.2, 9.8, 11.6, 12.4, 12.9, null, 10.2, 8.8, 7.3, 6.6]

/** The same hours a week earlier, drawn dashed on the same axis for comparison. */
const lastWeek = [5.2, 4.9, 6.1, 8.4, 9.9, 11.1, 11.8, 10.9, 9.6, 8.1, 6.8, 6.0]

/** Two-hourly instants from midnight, in `Z`, so every build and every browser agree. */
const hours = today.map((_, index) => `2026-03-01T${String(index * 2).padStart(2, "0")}:00:00Z`)

/** Today against the week before, on a time axis. */
const revenue: LineSeries[] = [
  { name: "Today", points: hours.map((x, index) => ({ x, y: today[index] })) },
  {
    name: "A week earlier",
    dashed: true,
    showPoints: false,
    points: hours.map((x, index) => ({ x, y: lastWeek[index] })),
  },
]

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
      "A donut drawn with one CSS `conic-gradient` whose slices show their value and share on hover or by the arrow keys, and whose legend rows turn into links when a slice has an `href`.",
    wide: false,
    props: [
      { name: "data", type: "DonutDatum[]", description: "The slices: a label and a value each." },
      {
        name: "valueFormat",
        type: "(value: number) => string",
        default: "String",
        description: "How a slice's value is printed in its tooltip.",
      },
      {
        name: "centerValue",
        type: "string | number",
        description: "The figure in the hole, usually the total.",
      },
    ],
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
        valueFormat={(value) => `${value * 124} sessions`}
      />
    ),
  },
  LineChart: {
    summary:
      "The line chart: drawn complete on the server, with a crosshair and a tooltip that follow the pointer or the arrow keys, over categories or over time.",
    wide: true,
    props: [
      { name: "series", type: "LineSeries[]", description: "Each line: a name and its points." },
      {
        name: "xAxis",
        type: `"category" | "time"`,
        default: `"category"`,
        description: "Evenly spaced labels, or instants placed by time with round ticks.",
      },
      {
        name: "yFormat",
        type: "(value: number) => string",
        default: "at most two decimals",
        description: "How a Y tick and a tooltip value are printed.",
      },
      {
        name: "referenceValue",
        type: "number",
        description: "A dashed target line, always inside the Y axis.",
      },
      {
        name: "ignoreZeroes",
        type: "boolean",
        default: "false",
        description: "Treat a zero as missing: the line breaks and a dashed bridge spans the gap.",
      },
    ],
    snippet: `<LineChart
  title="Revenue, k€"
  xAxis="time"
  series={[
    { name: "Today", points: today.map((p) => ({ x: p.time, y: p.value })) },
    { name: "A week earlier", dashed: true, points: lastWeek.map((p) => ({ x: p.time, y: p.value })) },
  ]}
  referenceValue={12}
  referenceLabel="Target"
/>`,
    render: () => (
      <div class="flex flex-col gap-6">
        <LineChart
          series={revenue}
          xAxis="time"
          title="Revenue, k€"
          referenceValue={12}
          referenceLabel="Target"
          yFormat={(value) => value.toFixed(1)}
        />
        <LineChart
          series={orders}
          title="Orders per month"
          height={180}
          yDomain={[0, 60]}
          yFormat={(value) => value.toFixed(0)}
        />
      </div>
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
} satisfies DemoFragment
