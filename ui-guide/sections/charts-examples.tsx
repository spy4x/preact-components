/**
 * Examples of the helpers `charts/` exports beside its charts.
 *
 * Each card runs the real export when it renders; see `example.tsx`. Three kinds of export cannot
 * print their whole result there, because `run` is synchronous and has to print the same thing on
 * the server and in the browser:
 *
 * - The two loaders return promises. Their cards print what happens synchronously — the stats port
 *   being asked — and the schema verdict the loaders apply, and say in the summary what the promise
 *   resolves to.
 * - The two hooks are called inside `run`, which the card calls while it renders, so they are hooks
 *   of the card's output component. They print their first render, which is the same on both sides:
 *   `useInView` has no element to watch and `useMetricSeries` is given `enabled: false`.
 * - `createInViewObserver` needs `IntersectionObserver`, which the server render does not have. Its
 *   card installs a recording stand-in for the length of the call and puts the original back, so both
 *   renders print what the helper asked the observer for.
 */

import { barPercent } from "@spy4x/preact-charts/bars"
import {
  DEFAULT_AXIS_COLOR,
  DEFAULT_CHART_PALETTE,
  DEFAULT_GRID_COLOR,
  DEFAULT_SURFACE_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TRACK_COLOR,
  seriesColor,
} from "@spy4x/preact-charts/colors"
import { donutGeometry } from "@spy4x/preact-charts/donut-chart"
import { loadMetricSeries, useMetricSeries } from "@spy4x/preact-charts/metric-panel"
import {
  chartPayloadSchema,
  loadChartPayload,
  previousPeriod,
  timeSeriesPointSchema,
} from "@spy4x/preact-charts/payload"
import {
  extent,
  linearScale,
  niceScale,
  niceStep,
  paddedDomain,
  ticks,
  xLabelStride,
} from "@spy4x/preact-charts/scales"
import { TIME_FRAMES } from "@spy4x/preact-charts/time-series"
import { createInViewObserver, useInView } from "@spy4x/preact-charts/use-in-view"
import { type } from "arktype"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"
import type { LazyModuleState } from "../lazy.ts"
import { d3LineChartModule } from "./charts-d3.tsx"

/**
 * What an example that needs `charts/d3-line-chart` prints until the charts page has loaded it.
 *
 * That module imports d3, so these examples reach it through {@link d3LineChartModule} rather
 * than a static import (see `charts-d3.tsx`). The served page and the browser's first render print
 * this line, and the real output replaces it once the module arrives. With scripts off it never
 * changes, so it says where the output is computed rather than promising a load.
 *
 * @param state The module's load state, when it is not loaded.
 * @returns The line the card prints instead of its output.
 */
function pendingD3Output(state: LazyModuleState<unknown>): string {
  return state.status === "failed"
    ? `<charts/d3-line-chart did not load: ${state.message}>`
    : "<computed in the browser: needs charts/d3-line-chart, which imports d3>"
}

/**
 * The stats port of the `useMetricSeries` card. It lives outside the card because the hook reloads
 * whenever its `loadStats` changes, so a new function on every render would reload on every render.
 */
const loadEmptyStats = () => Promise.resolve({ data: [], timeFrame: "hours" })

const examples: ExampleFragment = {
  extent: {
    title: "extent()",
    summary:
      "The smallest and largest finite value of a series, or `null` when it has none: the domain a scale starts from.",
    snippet: `import { extent } from "@spy4x/preact-charts"

[extent([3, 9, 1, Number.NaN]), extent([])]`,
    covers: ["extent"],
    run: () => [extent([3, 9, 1, Number.NaN]), extent([])],
  },
  niceScale: {
    title: "paddedDomain() and niceScale()",
    summary:
      "`paddedDomain` widens a data range so no point sits on the frame; `niceScale` pads it too, then rounds it outward to round numbers and returns the ticks to draw.",
    snippet: `import { niceScale, paddedDomain } from "@spy4x/preact-charts"

[paddedDomain(12, 87), niceScale(12, 87)]`,
    covers: ["paddedDomain", "niceScale"],
    run: () => [paddedDomain(12, 87), niceScale(12, 87)],
  },
  ticks: {
    title: "niceStep() and ticks()",
    summary:
      "`niceStep` picks a round distance between ticks for a span, and `ticks` lists the round values that cover a range.",
    snippet: `import { niceStep, ticks } from "@spy4x/preact-charts"

({ step: niceStep(75), ticks: ticks(0, 100, 5) })`,
    covers: ["niceStep", "ticks"],
    run: () => ({ step: niceStep(75), ticks: ticks(0, 100, 5) }),
  },
  linearScale: {
    title: "linearScale()",
    summary:
      "Maps a data domain onto a pixel range; a reversed range is how a Y axis puts larger values higher up.",
    snippet: `import { linearScale } from "@spy4x/preact-charts"

const y = linearScale([0, 100], [200, 0])
console.log([y(0), y(25), y(100)])`,
    covers: ["linearScale"],
    run: () => {
      const y = linearScale([0, 100], [200, 0])
      return [y(0), y(25), y(100)]
    },
  },
  xLabelStride: {
    title: "xLabelStride()",
    summary:
      "How many X labels to skip between two drawn ones, so a dense axis stays readable: 5 points draw every label, 30 draw every fourth.",
    snippet: `import { xLabelStride } from "@spy4x/preact-charts"

[xLabelStride(5), xLabelStride(30), xLabelStride(30, 6)]`,
    covers: ["xLabelStride"],
    run: () => [xLabelStride(5), xLabelStride(30), xLabelStride(30, 6)],
  },
  barPercent: {
    title: "barPercent()",
    summary:
      "A bar's width as a percentage of the longest one, clamped to 0–100, and 0 for a value or maximum that cannot be drawn.",
    snippet: `import { barPercent } from "@spy4x/preact-charts"

[barPercent(30, 120), barPercent(150, 120), barPercent(5, 0)]`,
    covers: ["barPercent"],
    run: () => [barPercent(30, 120), barPercent(150, 120), barPercent(5, 0)],
  },
  donutGeometry: {
    title: "donutGeometry()",
    summary:
      "The slice maths behind `DonutChart`: each slice's share and the `conic-gradient` that paints the ring.",
    snippet: `import { donutGeometry } from "@spy4x/preact-charts"

const ring = donutGeometry(
  [
    { label: "Desktop", value: 620 },
    { label: "Mobile", value: 310 },
    { label: "Tablet", value: 70 },
  ],
  { colors: ["#4f46e5", "#16a34a", "#f59e0b"] },
)
console.log({
  total: ring.total,
  slices: ring.segments.map((slice) => \`\${slice.label} \${slice.percent}\`),
  gradient: ring.gradient,
})`,
    covers: ["donutGeometry"],
    run: () => {
      const ring = donutGeometry(
        [
          { label: "Desktop", value: 620 },
          { label: "Mobile", value: 310 },
          { label: "Tablet", value: 70 },
        ],
        { colors: ["#4f46e5", "#16a34a", "#f59e0b"] },
      )
      return {
        total: ring.total,
        slices: ring.segments.map((slice) => `${slice.label} ${slice.percent}`),
        gradient: ring.gradient,
      }
    },
  },
  seriesColor: {
    title: "Series colours",
    summary:
      "`seriesColor` picks the colour for a series by its index, wrapping around the palette; `DEFAULT_CHART_PALETTE` is the palette used when you pass none.",
    snippet: `import { DEFAULT_CHART_PALETTE, seriesColor } from "@spy4x/preact-charts"

({
  paletteSize: DEFAULT_CHART_PALETTE.length,
  first: seriesColor(0),
  third: seriesColor(2, ["#2563eb", "#dc2626"]),
})`,
    covers: ["DEFAULT_CHART_PALETTE", "seriesColor"],
    run: () => ({
      paletteSize: DEFAULT_CHART_PALETTE.length,
      first: seriesColor(0),
      third: seriesColor(2, ["#2563eb", "#dc2626"]),
    }),
  },
  DEFAULT_AXIS_COLOR: {
    title: "Default chart colours",
    summary:
      "The colours every chart uses when the caller passes none: each reads a `theme/` token and falls back to a fixed colour, so a chart renders with or without the theme.",
    snippet: `import {
  DEFAULT_AXIS_COLOR,
  DEFAULT_D3_LINE_CHART_COLORS,
  DEFAULT_GRID_COLOR,
  DEFAULT_SURFACE_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TRACK_COLOR,
} from "@spy4x/preact-charts"

({
  axis: DEFAULT_AXIS_COLOR,
  grid: DEFAULT_GRID_COLOR,
  text: DEFAULT_TEXT_COLOR,
  surface: DEFAULT_SURFACE_COLOR,
  track: DEFAULT_TRACK_COLOR,
  d3Line: DEFAULT_D3_LINE_CHART_COLORS.line,
})`,
    covers: [
      "DEFAULT_AXIS_COLOR",
      "DEFAULT_GRID_COLOR",
      "DEFAULT_TEXT_COLOR",
      "DEFAULT_SURFACE_COLOR",
      "DEFAULT_TRACK_COLOR",
      "DEFAULT_D3_LINE_CHART_COLORS",
    ],
    run: () => {
      const d3Line = d3LineChartModule.use()
      if (d3Line.status !== "loaded") return pendingD3Output(d3Line)
      const { DEFAULT_D3_LINE_CHART_COLORS } = d3Line.module
      return {
        axis: DEFAULT_AXIS_COLOR,
        grid: DEFAULT_GRID_COLOR,
        text: DEFAULT_TEXT_COLOR,
        surface: DEFAULT_SURFACE_COLOR,
        track: DEFAULT_TRACK_COLOR,
        d3Line: DEFAULT_D3_LINE_CHART_COLORS.line,
      }
    },
  },
  formatTimeTick: {
    title: "Time labels",
    summary:
      "`TIME_FRAMES` lists the bucket sizes a series can have, `formatTimeTick` labels an X tick to suit the bucket size, and `defaultTooltipFormat` is the text `D3LineChart` shows on hover. Both print local time.",
    snippet:
      `import { defaultTooltipFormat, formatTimeTick, TIME_FRAMES } from "@spy4x/preact-charts"

const at = new Date(2026, 2, 14, 9, 30)
console.log({
  ticks: TIME_FRAMES.map((frame) => \`\${frame}: \${formatTimeTick(at, frame)}\`),
  tooltip: defaultTooltipFormat({ timeGroup: at, value: 42 }),
})`,
    covers: ["TIME_FRAMES", "formatTimeTick", "defaultTooltipFormat"],
    run: () => {
      const d3Line = d3LineChartModule.use()
      if (d3Line.status !== "loaded") return pendingD3Output(d3Line)
      const { defaultTooltipFormat, formatTimeTick } = d3Line.module
      const at = new Date(2026, 2, 14, 9, 30)
      return {
        ticks: TIME_FRAMES.map((frame) => `${frame}: ${formatTimeTick(at, frame)}`),
        tooltip: defaultTooltipFormat({ timeGroup: at, value: 42 }),
      }
    },
  },
  yDomainFor: {
    title: "yDomainFor()",
    summary:
      "The Y range `D3LineChart` draws: from 0 (or the smallest non-zero value with `ignoreZeroes`) to the maximum plus 20% headroom, stretched to include a reference line.",
    snippet: `import { yDomainFor } from "@spy4x/preact-charts"

const points = [0, 8, 20, 14].map((value, hour) => ({ timeGroup: hour * 3_600_000, value }))
console.log([
  yDomainFor(points),
  yDomainFor(points, { ignoreZeroes: true }),
  yDomainFor(points, { referenceValue: 50 }),
])`,
    covers: ["yDomainFor"],
    run: () => {
      const d3Line = d3LineChartModule.use()
      if (d3Line.status !== "loaded") return pendingD3Output(d3Line)
      const { yDomainFor } = d3Line.module
      const points = [0, 8, 20, 14].map((value, hour) => ({ timeGroup: hour * 3_600_000, value }))
      return [
        yDomainFor(points),
        yDomainFor(points, { ignoreZeroes: true }),
        yDomainFor(points, { referenceValue: 50 }),
      ]
    },
  },
  assertD3Available: {
    title: "assertD3Available()",
    summary:
      "The check `D3LineChart` makes before drawing: a `d3` with no line generator throws `MISSING_D3_LINE_ERROR`, which tells the reader to add the dependency.",
    snippet:
      `import { assertD3Available, MISSING_D3_LINE_ERROR } from "@spy4x/preact-charts/d3-line-chart"

assertD3Available({ line: () => {} }) // a d3 with a line generator passes
let message = ""
try {
  assertD3Available({})
} catch (error) {
  message = (error as Error).message
}
console.log({ isTheExportedMessage: message === MISSING_D3_LINE_ERROR, message })`,
    covers: ["assertD3Available", "MISSING_D3_LINE_ERROR"],
    run: () => {
      const d3Line = d3LineChartModule.use()
      if (d3Line.status !== "loaded") return pendingD3Output(d3Line)
      const { assertD3Available, MISSING_D3_LINE_ERROR } = d3Line.module
      assertD3Available({ line: () => {} })
      let message = ""
      try {
        assertD3Available({})
      } catch (error) {
        message = (error as Error).message
      }
      return { isTheExportedMessage: message === MISSING_D3_LINE_ERROR, message }
    },
  },
  previousPeriod: {
    title: "previousPeriod()",
    summary:
      "The window of the same length that ends where a range starts; `steps` walks further back.",
    snippet: `import { previousPeriod } from "@spy4x/preact-charts"

const week = { from: new Date("2026-03-08T00:00:00Z"), to: new Date("2026-03-15T00:00:00Z") }
console.log([previousPeriod(week), previousPeriod(week, 2)])`,
    covers: ["previousPeriod"],
    run: () => {
      const week = { from: new Date("2026-03-08T00:00:00Z"), to: new Date("2026-03-15T00:00:00Z") }
      return [previousPeriod(week), previousPeriod(week, 2)]
    },
  },
  loadChartPayload: {
    title: "Stats payloads and their loaders",
    summary:
      "`timeSeriesPointSchema` and `chartPayloadSchema` are the arktype shape a stats endpoint returns. `loadChartPayload` asks your `loadStats` port for a range and resolves to `{ payload, error }`, with a rejected payload as the error; `loadMetricSeries` does the same and multiplies every value by `scale`. The loaders resolve after this card renders, so it prints the calls they made to the port and the verdicts they apply.",
    snippet:
      `import { chartPayloadSchema, loadChartPayload, loadMetricSeries, timeSeriesPointSchema } from "@spy4x/preact-charts"
import { type } from "arktype"

const range = { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-03-02T00:00:00Z") }
const asked: string[] = []
const loadStats = (period: typeof range) => {
  asked.push(\`\${period.from.toISOString()} → \${period.to.toISOString()}\`)
  return Promise.resolve({ data: [{ timeGroup: "2026-03-01T00:00:00Z", value: 1200 }], timeFrame: "hours" })
}
void loadChartPayload(loadStats, range) // resolves to { payload, error }
void loadMetricSeries({ loadStats, range, scale: 0.001 }) // resolves to { data, timeFrame, error }
const rejected = chartPayloadSchema({ data: [], timeFrame: "weeks" })
console.log({
  asked,
  point: timeSeriesPointSchema({ timeGroup: "2026-03-01T00:00:00Z", value: 1200 }),
  rejected: rejected instanceof type.errors ? rejected.summary : rejected,
})`,
    covers: ["timeSeriesPointSchema", "chartPayloadSchema", "loadChartPayload", "loadMetricSeries"],
    run: () => {
      const range = { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-03-02T00:00:00Z") }
      const asked: string[] = []
      const loadStats = (period: typeof range) => {
        asked.push(`${period.from.toISOString()} → ${period.to.toISOString()}`)
        return Promise.resolve({
          data: [{ timeGroup: "2026-03-01T00:00:00Z", value: 1200 }],
          timeFrame: "hours",
        })
      }
      void loadChartPayload(loadStats, range)
      void loadMetricSeries({ loadStats, range, scale: 0.001 })
      const rejected = chartPayloadSchema({ data: [], timeFrame: "weeks" })
      return {
        asked,
        point: timeSeriesPointSchema({ timeGroup: "2026-03-01T00:00:00Z", value: 1200 }),
        rejected: rejected instanceof type.errors ? rejected.summary : rejected,
      }
    },
  },
  useMetricSeries: {
    title: "useMetricSeries()",
    summary:
      "`loadMetricSeries` as a hook, for a panel that loads its own data: it loads when `enabled` is true and the range or port changes, and returns the series with `isLoading` and `reload`. This card calls it with `enabled: false`, so it prints the state a panel renders before its first load.",
    snippet: `import { useMetricSeries } from "@spy4x/preact-charts"

// Outside the component: a new function on every render would reload on every render.
const loadStats = () => Promise.resolve({ data: [], timeFrame: "hours" })

// Inside a component:
const { data, timeFrame, error, isLoading } = useMetricSeries({
  loadStats,
  range: { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-03-02T00:00:00Z") },
  enabled: false,
})
console.log({ data, timeFrame, error, isLoading })`,
    covers: ["useMetricSeries"],
    run: () => {
      const { data, timeFrame, error, isLoading } = useMetricSeries({
        loadStats: loadEmptyStats,
        range: { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-03-02T00:00:00Z") },
        enabled: false,
      })
      return { data, timeFrame, error, isLoading }
    },
  },
  useInView: {
    title: "useInView()",
    summary:
      "Tells a component when its element has scrolled near the viewport, so a chart can wait to load until then. Attach `ref` to the element; `inView` turns true 200px before it shows. This card attaches the ref to nothing, so it prints the first render: `inView` is false until an element is watched.",
    snippet: `import { useInView } from "@spy4x/preact-charts"

// Inside a component, before <div ref={ref}> has mounted:
const { ref, inView } = useInView<HTMLDivElement>()
console.log({ element: ref.current, inView })`,
    covers: ["useInView"],
    run: () => {
      const { ref, inView } = useInView<HTMLDivElement>()
      return { element: ref.current, inView }
    },
  },
  createInViewObserver: {
    title: "createInViewObserver()",
    summary:
      "The observer wiring behind `useInView`: it watches one element and reports each change, and returns `null` where there is no `IntersectionObserver`, as on a server. A recording stand-in replaces `IntersectionObserver` for the length of the call, so the output shows what the helper asked for.",
    snippet: `import { createInViewObserver } from "@spy4x/preact-charts"

const log: unknown[] = []
const scope = globalThis as Record<string, unknown>
const original = scope.IntersectionObserver
scope.IntersectionObserver = class {
  constructor(private report: (entries: { isIntersecting: boolean }[]) => void, options: object) {
    log.push({ options })
  }
  observe(target: { id: string }) {
    log.push({ observe: target.id })
    this.report([{ isIntersecting: true }]) // the browser reports once the element is observed
  }
  disconnect() { log.push("disconnect") }
}
try {
  const chart = { id: "revenue-chart" } as unknown as Element
  const handle = createInViewObserver(chart, (visible) => log.push({ visible }), { rootMargin: "100px" })
  handle?.disconnect()
} finally {
  if (original === undefined) delete scope.IntersectionObserver
  else scope.IntersectionObserver = original
}
console.log(log)`,
    covers: ["createInViewObserver"],
    run: () => {
      const log: unknown[] = []
      const scope = globalThis as Record<string, unknown>
      const original = scope.IntersectionObserver
      scope.IntersectionObserver = class {
        constructor(
          private report: (entries: { isIntersecting: boolean }[]) => void,
          options: object,
        ) {
          log.push({ options })
        }
        observe(target: { id: string }) {
          log.push({ observe: target.id })
          this.report([{ isIntersecting: true }])
        }
        disconnect() {
          log.push("disconnect")
        }
      }
      try {
        const chart = { id: "revenue-chart" } as unknown as Element
        const handle = createInViewObserver(chart, (visible) => log.push({ visible }), {
          rootMargin: "100px",
        })
        handle?.disconnect()
      } finally {
        if (original === undefined) delete scope.IntersectionObserver
        else scope.IntersectionObserver = original
      }
      return log
    },
  },
}

/** The `charts/` examples, as registry cards. */
export const chartsExamples = toExampleDemos(examples)
