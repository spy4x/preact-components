# `@spy4x/preact-charts`

Charts for Preact that render complete on the server and become interactive in the browser, plus
the axis and loading helpers behind them.

- **Server-rendered, finished without JavaScript** — `LineChart`, `Bars`, `DonutChart`, `Kpi`,
  `KpiGrid`. The markup a server sends is the whole chart: axes, lines, bars, legend, a native
  tooltip on every point.
- **Interactive once hydrated** — `LineChart` adds a crosshair and a tooltip that follow the pointer,
  and steps through its points with the arrow keys, Home and End; `DonutChart` gives every slice a
  tooltip with its label, value and share, by pointer and by keyboard. Both tooltips stay inside the
  chart and the viewport, flipping to the other side of the point near an edge.
- **No charting library.** Nothing here imports d3 or any other: the axis maths is `scales.ts`, the
  time ticks are `time-ticks.ts`, and the hover layer is plain Preact.

## Rules this package follows

- **Props and ports, never a global store.** No component imports an app's state singleton and no
  module-level signal holds app data. Data arrives as props; loading arrives as a `loadStats`
  callback; colours arrive as props.
- **Colours are props, with theme tokens as the default.** The defaults are CSS custom properties
  with an inline fallback, so a chart picks up `theme/` when it is loaded and still renders
  standalone. They are applied through `style`, because `var()` does not resolve inside SVG
  presentation attributes such as `fill="…"`.
- **A series palette for both themes.** `DEFAULT_CHART_PALETTE` is five colours — blue, orange,
  green, violet, magenta — with a light and a dark step each. A chart's root sets them as `--chart-1`
  … `--chart-5`, switching to the dark steps under a `.dark` ancestor. Every step reaches 3:1
  against its page (white and gray-50 light; gray-800, gray-900 and the ink palette's card and page
  dark), and neighbours stay apart for colour-blind readers. An app recolours a slot with
  `--color-chart-1` … `--color-chart-5`, or passes `colors`.
- **Server-renderable.** `document`, `window`, `IntersectionObserver` and `ResizeObserver` are touched
  inside effects and event handlers only. What the server prints, the browser prints too: the time
  axis lays its ticks on the wall clock of `UTC` and prints them in `en-GB` unless told otherwise
  (`timeZone`, `locale`), so hydration never has to replace text.
- **No sibling package imports.** `charts/` depends on `preact`, `arktype` and `@spy4x/platform`'s
  axis maths, and nothing else in the workspace, so it stays independent of `ui/` and `signals/`.

## Components

| Component    | Subpath       | Interactive in a browser               | Key props / ports                                                                              |
| ------------ | ------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `LineChart`  | `line-chart`  | crosshair, tooltip, arrow-key stepping | `series`, `xAxis`, `height`, `yFormat`, `xFormat`, `yDomain`, `referenceValue`, `ignoreZeroes` |
| `Bars`       | `bars`        | no                                     | `data`, `max`, `format`, `labelWidth`, `colors`                                                |
| `DonutChart` | `donut-chart` | slice tooltip, arrow-key stepping      | `data`, `centerValue`, `centerLabel`, `valueFormat`, `showLegend`, `colors`                    |
| `Kpi`        | `kpi`         | no                                     | `label`, `value`, `sub`, `tone`                                                                |
| `KpiGrid`    | `kpi`         | no                                     | `children`, `minWidth`                                                                         |

Hooks and helpers: `useInView` (`use-in-view`), `previousPeriod` / `loadChartPayload` /
`chartPayloadSchema` (`payload`), the `TIME_FRAMES` / `TimeFrame` / `TimeSeriesPoint` vocabulary
(`time-series`), and the axis maths in `scales` — `niceStep`, `ticks`, `niceScale`, `paddedDomain`,
`linearScale`, `extent`, `xLabelStride`.

## Usage

```tsx
import { Bars, DonutChart, Kpi, KpiGrid, LineChart } from "@spy4x/preact-charts"
```

Series over categories:

```tsx
<LineChart
  title="Runs per month"
  series={[{ name: "Runs", points: months.map((m) => ({ x: m.label, y: m.runs })) }]}
  yFormat={(value) => `${value} km`}
/>
```

A time series against the period before it, with a target line. `x` takes an ISO string, epoch
milliseconds or a `Date`; ticks land on round hours, days or months; a `null` value breaks the line
and a dashed grey segment bridges the gap:

```tsx
const shifted = previous.data.map((p) => ({ x: +new Date(p.timeGroup) + span, y: p.value }))

<LineChart
  xAxis="time"
  title="Power, kW"
  series={[
    { name: "This week", points: current.data.map((p) => ({ x: p.timeGroup, y: p.value })) },
    { name: "Last week", dashed: true, showPoints: false, points: shifted },
  ]}
  referenceValue={42}
  referenceLabel="Contracted"
/>
```

A comparison is the caller's data: load the earlier window with `loadChartPayload` and
`previousPeriod`, move its instants forward by the window's length, and pass it as a dashed series.

### Moving from `D3LineChart` and `CompareChart`

Both were removed in favour of the one `LineChart` (#356), and `MetricPanel` with them.

| Before                                             | Now                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `<D3LineChart data timeFrame />`                   | `<LineChart xAxis="time" series={[{ name, points }]} />`, `points` mapped from `{ timeGroup, value }` to `{ x, y }` |
| `ticks`, `tickFormat`                              | `yTicks`, `yFormat`                                                                                                 |
| `tickValues` (labels for a numeric index)          | `yFormat={(value) => labels[value]}`                                                                                |
| `timeTickFormat`, `tooltipFormat`                  | `xFormat` (axis and tooltip heading), `yFormat` (tooltip value)                                                     |
| `referenceValue`, `ignoreZeroes`, `isLoading`      | the same names                                                                                                      |
| `missingValuesLabel`, `loadingLabel`, `emptyLabel` | the same names                                                                                                      |
| `colors.line`, `.axis`, `.text`, `.surface`        | a series' `color`, `axisColor`, `textColor`, `surfaceColor`                                                         |
| `colors.reference`                                 | `referenceColor`                                                                                                    |
| `aspectRatio`                                      | `height`, in pixels; the chart takes its parent's width                                                             |
| `LineChart`'s `width` (the `viewBox` width)        | gone: the chart is as wide as its parent                                                                            |
| `<CompareChart range data loadStats />`            | a second, `dashed` series; load it with `loadChartPayload(loadStats, previousPeriod(range))`                        |
| `CompareChart`'s `compareLabel` toggle             | the app's own toggle: add or drop the dashed series when it changes                                                 |
| `CompareChart`'s `rangePicker` slot                | the app's own picker, rendered beside the chart                                                                     |
| `CompareChart`'s `onError`                         | `loadChartPayload` returns `{ error }`; show it with `ui/`'s `ErrorState` or a toast                                |
| `<MetricPanel title unit error actions>`           | the app's own heading, `ui/`'s `ErrorState`, and a `LineChart`                                                      |
| `@spy4x/preact-charts/svg`                         | `@spy4x/preact-charts`: no module imports d3 any more                                                               |

`defaultTooltipFormat`, `formatTimeTick`, `yDomainFor`, `assertD3Available`,
`MISSING_D3_LINE_ERROR`, `DEFAULT_D3_LINE_CHART_COLORS`, `useMetricSeries` and `loadMetricSeries`
went with them, and so did the types `CompareChartProps`, `D3LineChartProps`, `D3LineChartColors`,
`MetricPanelProps`, `MetricError`, `MetricSeriesOptions` and `MetricSeriesState`. `LineChartProps`
lost `width`; its series are `LineSeries` (`{ name, points, color?, showPoints?, dashed? }`) of
`LinePoint` (`{ x, y }`, `x` a `LineX`). `d3` is no longer a dependency of anything in this repository.

## Axis behaviour

`scales.ts` is pure logic with no renderer, so it is where a real bug would hurt most and it is tested
hardest. `ticks` and `niceStep` themselves now live once, in `@spy4x/platform/universal/axis`
(spy4x/ts-libs#70, refs spy4x/preact-components#123), and are re-exported from here so `./scales`
keeps both names for its existing importers. `niceScale` takes its tick loop from the same module's
`stepAxis` (spy4x/ts-libs#201), described below. The rules that pair guarantees:

- `ticks(min, max)` expands outward to a nice step (`1, 2, 5, 10 × 10ⁿ`) and returns both ends
  inclusive — about `target + 1` values.
- `min === max` returns that single value instead of dividing by zero; `niceScale` widens a
  single-value or all-zero series into a plottable domain.
- Reversed bounds are swapped; non-finite bounds return an empty axis instead of throwing.
- Sub-nanosecond spans keep distinct tick values. Two source behaviours broke this and both are
  fixed: the step was floored at `Math.max(1e-9, raw)`, so below about `3e-9` the step became
  coarser than requested and below `1e-9` it exceeded the span itself — `ticks(0, 1e-12)` returned
  a single `0`; and ticks were rounded
  with `Number(v.toFixed(8))`, which collapsed every tick of such a span to `0`. Rounding is now
  relative to the step, so a step like `2e-13` survives, and no floor is applied.
- A step far below the float precision cannot hang the axis: `ticks(1e18, 1e18 + 100)` terminates
  (one ulp at `1e18` is 128 while the nice step is 20, so advancing a cursor with `v += step` never
  moves — the source looped forever). A dedicated test runs that call in a worker with a deadline,
  because a non-terminating loop would hang the suite rather than fail it.
- Non-positive, non-finite and subnormal spans never produce a `0`, `NaN` or infinite step.

`niceScale` has no tick loop of its own: it pads the domain, picks the step with `niceStep`, and
takes the rounded bounds and ticks from `@spy4x/platform/universal/axis`'s `stepAxis`
(spy4x/preact-components#306), which carries the same iteration cap as `ticks`. Moving onto it
changed five things. Every tick of a step with more than one significant digit now lands on the
step (`niceScale(0, 10, { target: 4 })` starts at `-2.5`, not `-2`). A padded domain that
overflows to `±Infinity` has no ticks instead of `[a, Infinity]`. `Infinity` is never a tick, and a
finite domain near the largest double no longer rounds its `max` up to `Infinity`. An absurd target
on a huge value (`niceScale(1e18, 1e18 + 100, { target: 1e300 })`) keeps finite bounds.

The re-exported `ticks` changed with ts-libs 1.4.0 too: every tick now lands on the step
(`ticks(0, 10, 4)` was `[0, 3, 5, 8, 10]` and is `[0, 2.5, 5, 7.5, 10]`), and `Infinity` is never a
tick. `LineChart` calls `ticks` when a caller passes an explicit `yDomain`, so such a chart with a
`yTicks` other than 1, 5 or 10 draws its gridlines in new places.

## Tests

`deno task test` from the repo root. `scales.test.ts` covers `extent`, `paddedDomain`, `niceScale`,
`linearScale` and `xLabelStride` — the axis helpers this package still owns — including degenerate,
negative, tiny, huge and boundary-tick cases, and runs `niceScale`'s own non-termination case
(`niceScale(1e6, 2e6, { target: 1e25 })`) and a termination check on the re-exported `ticks`
(`ticks(1e18, 1e18 + 100)`) each in a worker with a deadline — `deno test` has no per-test timeout, so
an in-process call would hang the suite instead of failing it. `ticks`/`niceStep` themselves are
tested once, in `@spy4x/platform`'s own `axis.test.ts`. `time-ticks.test.ts` covers the time-axis
steps and labels, `tooltip.test.ts` the tooltip's placement rules. The chart suites render each
component with `preact-render-to-string` and assert on real markup — path geometry for a known
dataset, gaps and bridges, time positions, tick labels, legend rows, percent widths, gradient stops
and empty states.

The tooltips live in effects and event handlers, which a server render never runs, so they are
proven in a real browser: `pages/checks/charts.ts` hovers the line chart's first and last point and
every donut slice, steps through both with the keyboard, and checks that each tooltip lies inside
its chart and the viewport at 375 and 1440 pixels wide.

## Not in this package

`MetricsList` (domain-coupled to metric catalogs and device ids — the layout idea lives on in
`Bars`), `DateTimeFilter` (a range picker belongs with the app or `ui/`), `Export` (drags in
`xlsx`), and `chooseChartRoute`, which is a proposal rather than implemented code.
