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

import { type BarDatum, Bars, type StackedBarDatum } from "@spy4x/preact-charts/bars"
import { DotPlot, type DotPlotRow } from "@spy4x/preact-charts/dot-plot"
import { DonutChart } from "@spy4x/preact-charts/donut-chart"
import { Kpi, type KpiTone } from "@spy4x/preact-charts/kpi"
import { KpiGrid } from "@spy4x/preact-charts/kpi"
import { LineChart, type LineSeries } from "@spy4x/preact-charts/line-chart"
import { type RankedBarColumns, RankedBars } from "@spy4x/preact-charts/ranked-bars"
import { useInView } from "@spy4x/preact-charts/use-in-view"
import { useSignal } from "@preact/signals"
import { useEffect } from "preact/hooks"
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

/**
 * Thirty days of sign-ups, one point a day: enough dates that the axis has to leave labels out.
 * Literal day labels and values, so every build renders the same markup.
 */
const signups = [{
  name: "Sign-ups",
  points: Array.from({ length: 30 }, (_, day) => ({
    x: `Oct ${day + 1}`,
    y: [12, 15, 9, 14, 18, 22, 17][day % 7] + day,
  })),
}]

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

/** A ranked list's columns: visits draw the bar, order clicks and the rate follow it. */
const sourceColumns: RankedBarColumns = {
  label: "Source",
  value: "Visits",
  extra: [{ label: "Order clicks" }, {
    label: "Order rate",
    format: (value) => `${value.toFixed(1)}%`,
  }],
}

/** Visits per source with their order clicks; a source with too few visits has no rate. */
const sourceRows = [
  { label: "Zalo group A", value: 480, values: [24, 5] },
  { label: "Facebook: Da Nang market, second-hand and handmade", value: 310, values: [14, 4.5] },
  { label: "Instagram", value: 90, values: [2, 2.2] },
  { label: "Friends", value: 8, values: [0, null], lowSample: true },
  { label: "No source", value: 360, values: [12, 3.3] },
]

/** A 40 px square of one colour, standing in for an item's photo. */
function swatch(fill: string): string {
  return `data:image/svg+xml,${
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${fill}"/></svg>`,
    )
  }`
}

/**
 * `RankedBars` two ways: sources whose rows are buttons that set a filter, and items with a photo
 * and a note whose rows are links. The filter line under the first says which source was chosen.
 */
function RankedBarsDemo() {
  const source = useSignal<string | null>(null)
  return (
    <div class="flex flex-col gap-6" data-e2e="bars-ranked">
      <div class="flex flex-col gap-2">
        <RankedBars
          title="Where visits come from"
          columns={sourceColumns}
          data={sourceRows.map((row) => ({ ...row, onSelect: () => source.value = row.label }))}
        />
        <p class="text-xs text-muted" data-e2e="bars-ranked-filter">
          Chart shows: {source.value ?? "All sources"}
        </p>
      </div>
      <RankedBars
        title="Most ordered"
        columns={{ label: "Item", value: "Order clicks", extra: [{ label: "Views" }] }}
        data={[
          {
            label: "Linen shirt, sand",
            value: 9,
            values: [210],
            href: "?item=linen-shirt",
            image: { src: swatch("#d6c3a1"), alt: "" },
            note: "mostly Zalo A",
          },
          {
            label: "Áo dài lụa hoa sen",
            value: 6,
            values: [150],
            href: "?item=ao-dai",
            image: { src: swatch("#e7a1b0"), alt: "" },
            note: "mostly Facebook",
          },
          {
            label: "Cotton dress",
            value: 4,
            values: [96],
            href: "?item=cotton-dress",
            image: { src: swatch("#8fb3c9"), alt: "" },
          },
        ]}
      />
    </div>
  )
}

/** Three key figures with their change against the period before, as a stats page draws them. */
function KpiChangeDemo() {
  return (
    <div data-e2e="kpi-change">
      <KpiGrid minWidth="9rem">
        <Kpi
          label="Visits"
          value="1,240"
          change={{ text: "+120 vs previous 30 days", direction: "up", tone: "positive" }}
        />
        <Kpi
          label="Order clicks"
          value={52}
          change={{ text: "−3 vs previous 30 days", direction: "down", tone: "negative" }}
        />
        <Kpi
          label="Order rate"
          value="4.2%"
          sub="52 of 1,240 visits"
          change={{ text: "No change vs previous 30 days", direction: "flat" }}
        />
      </KpiGrid>
    </div>
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

/**
 * A chart behind a loading state, drawn once it scrolls into view: the element `useInView` watches
 * only exists after the loading bar is gone, which is the case the browser check for #863 guards.
 * Neither state has text of its own, so the served card reads the same as the hydrated one.
 */
function DeferredDonut() {
  const loaded = useSignal(false)
  const { ref, inView } = useInView<HTMLDivElement>()
  // Stands in for data arriving after hydration; the server render shows the loading bar.
  useEffect(() => {
    loaded.value = true
  }, [])
  if (!loaded.value) {
    return (
      <div
        aria-hidden="true"
        class="h-4 w-32 animate-pulse rounded bg-track motion-reduce:animate-none"
      />
    )
  }
  return (
    <div ref={ref} data-e2e="chart-deferred" class="min-h-16">
      {inView
        ? (
          <DonutChart
            data={traffic}
            showLegend={false}
            ariaLabel="Traffic sources, drawn when scrolled into view"
            valueFormat={(value) => `${value * 124} sessions`}
          />
        )
        : null}
    </div>
  )
}

/** Monthly spending split into three series, for the stacked `Bars` demo. */
const spending: StackedBarDatum[] = [
  {
    label: "January",
    segments: [{ series: "Rent", value: 900 }, { series: "Food", value: 420 }, {
      series: "Transport",
      value: 130,
    }],
  },
  {
    label: "February",
    segments: [{ series: "Rent", value: 900 }, { series: "Food", value: 380 }, {
      series: "Transport",
      value: 210,
    }],
  },
  {
    label: "March",
    segments: [{ series: "Rent", value: 900 }, { series: "Food", value: 510 }, {
      series: "Transport",
      value: 90,
    }],
  },
]

/** Hours of sleep by age group, with one group too small to trust and one not surveyed. */
const sleep: DotPlotRow[] = [
  { id: "18-24", label: "18 to 24", value: 7.6, detail: "1,204 people" },
  { id: "25-34", label: "25 to 34", value: 6.9, detail: "2,310 people" },
  { id: "35-49", label: "35 to 49", value: 6.4, detail: "1,876 people" },
  { id: "50-64", label: "50 to 64", value: 6.8, detail: "1,102 people" },
  { id: "65+", label: "65 and over", value: 7.9, muted: true, note: "Only 48 people" },
  { id: "under-18", label: "Under 18", value: null, detail: "Not surveyed" },
]

export const chartsDemos = {
  Bars: {
    summary:
      "A labelled bar chart drawn as a table of proportions: no d3, no client JavaScript, no width to measure.",
    wide: false,
    props: [
      {
        name: "data",
        type: "(BarDatum | StackedBarDatum)[]",
        description: "The rows: a label and a value each, or a label and stacked `segments`.",
      },
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
      {
        name: "headingLevel",
        type: "2 | 3 | 4 | 5 | 6",
        default: "3",
        description: "The level of the title's heading, so it fits the page's outline.",
      },
      {
        name: "reference",
        type: "{ value, label }",
        description: "A dashed line at one value across every bar, named in the legend.",
      },
    ],
    snippet: `<Bars data={[{ label: "Starter", value: 41 }]} title="Orders by plan" />
<Bars
  title="Spending by month"
  data={[{ label: "March", segments: [{ series: "Rent", value: 900 }, { series: "Food", value: 510 }] }]}
  reference={{ value: 1500, label: "Budget" }}
/>`,
    render: () => (
      <div class="flex flex-col gap-6">
        <Bars data={bars} title="Orders by plan" />
        <Bars
          data={spending}
          title="Spending by month"
          reference={{ value: 1480, label: "Budget" }}
          labelWidth="6rem"
        />
      </div>
    ),
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
      {
        name: "axisColor",
        type: "string",
        default: "the control border token",
        description: "The tooltip's border colour, as LineChart's axisColor.",
      },
      {
        name: "headingLevel",
        type: "2 | 3 | 4 | 5 | 6",
        default: "3",
        description: "The level of the title's heading, so it fits the page's outline.",
      },
    ],
    snippet: `<DonutChart
  data={[{ label: "Organic", value: 52 }, { label: "Referral", value: 24, href: "/referral" }]}
  centerValue="12.4k"
  centerLabel="sessions"
  title="Traffic sources"
/>`,
    render: () => (
      <div class="flex flex-col gap-6">
        <DonutChart
          data={traffic}
          centerValue="12.4k"
          centerLabel="sessions"
          title="Traffic sources"
          valueFormat={(value) => `${value * 124} sessions`}
        />
        <div class="flex flex-col gap-3">
          <p class="text-xs text-muted">the same donut, drawn once it scrolls into view</p>
          <DeferredDonut />
        </div>
      </div>
    ),
  },
  DotPlot: {
    summary:
      "A dot plot read as a list: one row per item, a dot on a shared scale, shaded bands named in a legend, and a bolder summary row.",
    wide: true,
    props: [
      {
        name: "rows",
        type: "{ id, label, value, detail?, muted?, note? }[]",
        description: "The rows; a `null` value draws no dot and a muted one a hollow dot.",
      },
      { name: "summary", type: "DotPlotRow", description: "A bolder last row under a hairline." },
      { name: "domain", type: "[number, number]", description: "The ends of the scale." },
      {
        name: "bands",
        type: "{ from, to, label, strength }[]",
        description: "Shaded stretches behind the dots, each named in the legend.",
      },
      {
        name: "zero",
        type: "boolean",
        default: "false",
        description: "A rule at zero, when zero is inside the domain.",
      },
      {
        name: "format",
        type: "(value: number) => string",
        default: "String",
        description: "How a value and the scale's ends print.",
      },
    ],
    snippet: `<DotPlot
  ariaLabel="Hours of sleep by age"
  domain={[5, 9]}
  rows={[{ id: "18-24", label: "18 to 24", value: 7.6, detail: "1,204 people" }]}
  summary={{ id: "all", label: "Everyone", value: 7 }}
  bands={[{ from: 7, to: 9, label: "Recommended, 7 to 9 hours", strength: 1 }]}
  format={(value) => \`\${value} h\`}
/>`,
    render: () => (
      <DotPlot
        ariaLabel="Hours of sleep by age"
        domain={[5, 9]}
        rows={sleep}
        summary={{ id: "all", label: "Everyone", value: 7 }}
        bands={[{ from: 7, to: 9, label: "Recommended, 7 to 9 hours", strength: 1 }]}
        format={(value) => `${value} h`}
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
      {
        name: "headingLevel",
        type: "2 | 3 | 4 | 5 | 6",
        default: "3",
        description: "The level of the title's heading, so it fits the page's outline.",
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
        <div data-e2e="chart-30-days">
          <LineChart
            series={signups}
            title="Sign-ups per day"
            height={160}
            yFormat={(value) => value.toFixed(0)}
          />
        </div>
      </div>
    ),
  },
  Kpi: {
    summary:
      "One key figure with its label and caption, in five tones that say what the number is for, or with a change line that alone takes the tone.",
    wide: true,
    props: [
      { name: "label", type: "string", description: "What the number counts." },
      { name: "value", type: "string | number", description: "The number, in tabular figures." },
      {
        name: "tone",
        type: `"accent" | "positive" | "warning" | "negative" | "neutral"`,
        default: `"accent"`,
        description: "The value's colour; with `change` the value stays the foreground colour.",
      },
      {
        name: "change",
        type: `{ text, direction: "up" | "down" | "flat", tone? }`,
        description:
          "A line under the value with a trend icon and the change in words; only it takes `tone`, muted by default.",
      },
    ],
    snippet: `<Kpi label="Uptime" value="99.95%" sub="last 30 days" tone="positive" />
<Kpi
  label="Visits"
  value="1,240"
  change={{ text: "+120 vs previous 30 days", direction: "up", tone: "positive" }}
/>`,
    render: () => (
      <div class="flex flex-col gap-6">
        <KpiToneMatrix />
        <KpiChangeDemo />
      </div>
    ),
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
        <p class="text-xs text-muted">
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
  RankedBars: {
    summary:
      "A ranked list with several numbers per row, such as visits per source: a bar under each label, one to three more right-aligned columns, and rows that are links or buttons.",
    wide: true,
    props: [
      {
        name: "data",
        type: "{ label, value, values?, href?, onSelect?, lowSample?, image?, note? }[]",
        description:
          "The rows, ranked by the caller; `values` fills the extra columns, `null` printing a dash. `image` (`{ src, alt }`) draws a 40 px thumbnail before the label, `note` a muted line under it. A row with `onSelect` needs JavaScript.",
      },
      {
        name: "columns",
        type: "{ label, value, extra }",
        description:
          "The headers of the label, the bar's number and one to three `extra` columns, each with an optional `format`.",
      },
      {
        name: "format",
        type: "(value: number) => string",
        default: "String",
        description: "How the bar's own number is printed.",
      },
      { name: "title", type: "string", description: "The heading, and the table's name." },
    ],
    snippet: `<RankedBars
  title="Where visits come from"
  columns={{ label: "Source", value: "Visits", extra: [{ label: "Order clicks" }] }}
  data={[{ label: "Zalo group A", value: 480, values: [24], onSelect: () => filter("zalo") }]}
/>`,
    render: () => <RankedBarsDemo />,
  },
} satisfies DemoFragment
