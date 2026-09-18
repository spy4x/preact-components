# `@preact-components/charts`

Chart components extracted from `warthunder-stats`, `gb` and `metric-rollup-prep`.

Two approaches live side by side, and the split is deliberate:

- **Zero-JS SVG, server-rendered** — `LineChart`, `Bars`, `DonutChart`, `Kpi`. Plain markup with no
  hydration and no client bundle. These are what an MPA or an SSR route should reach for.
- **Interactive d3 islands** — `D3LineChart`, `CompareChart`. Imperative d3 v7 render in an effect,
  resize-aware, with a tooltip. Use these only where the interaction earns the JavaScript.

Both share one pure axis module, `scales.ts`.

## Rules this package follows

- **Props and ports, never a global store.** No component imports an app's state singleton and no
  module-level signal holds app data. Data arrives as props; loading arrives as a `loadStats`
  callback; colours arrive as props.
- **Colours are props, with theme tokens as the default.** The defaults are CSS custom properties of
  the form `var(--color-primary-muted, oklch(…))`, so a chart picks up `theme/` when it is loaded and
  still renders standalone. They are applied through `style`, because `var()` does not resolve inside
  SVG presentation attributes such as `fill="…"`. The sources' hardcoded `#2a3556`/`#97a3bf` are gone.
- **Server-renderable.** `document`, `window`, `IntersectionObserver` and `ResizeObserver` are touched
  inside effects, behind feature checks, only.
- **No sibling package imports.** `charts/` depends on `preact`, `d3` and `arktype` and nothing else in
  the workspace, so it stays independent of `ui/` and `signals/`.

## Components

| Component      | Subpath         | Kind    | Key props / ports                                                     |
| -------------- | --------------- | ------- | --------------------------------------------------------------------- |
| `LineChart`    | `line-chart`    | zero-JS | `series`, `width`, `height`, `yFormat`, `yDomain`, `xStride`, colours |
| `Bars`         | `bars`          | zero-JS | `data`, `max`, `format`, `labelWidth`, `colors`                       |
| `DonutChart`   | `donut-chart`   | zero-JS | `data`, `centerValue`, `centerLabel`, `showLegend`, `colors`          |
| `Kpi`          | `kpi`           | zero-JS | `label`, `value`, `sub`, `tone`                                       |
| `KpiGrid`      | `kpi`           | zero-JS | `children`, `minWidth`                                                |
| `D3LineChart`  | `d3-line-chart` | island  | `data`, `timeFrame`, `referenceValue`, `ignoreZeroes`, `colors`       |
| `CompareChart` | `compare-chart` | island  | `range`, `data`, `loadStats` (port), `rangePicker` (slot)             |
| `MetricPanel`  | `metric-panel`  | shell   | `title`, `unit`, `error`, `actions`, `children`                       |

Hooks and helpers: `useInView` (`use-in-view`), `useMetricSeries` / `loadMetricSeries`
(`metric-panel`), `previousPeriod` / `loadChartPayload` / `chartPayloadSchema` (`payload`), and the
axis maths in `scales` — `niceStep`, `ticks`, `niceScale`, `paddedDomain`, `linearScale`, `extent`,
`xLabelStride`.

## Usage

```tsx
import { Bars, DonutChart, Kpi, KpiGrid, LineChart } from "@preact-components/charts"
// or one chart at a time, so the barrel does not pull d3 into the server bundle
import { LineChart } from "@preact-components/charts/line-chart"
```

A zero-JS chart — this renders on the server and never hydrates:

```tsx
<LineChart
  title="Runs per month"
  series={[{ name: "Runs", points: months.map((m) => ({ x: m.label, y: m.runs })) }]}
  yFormat={(value) => `${value} kg`}
  colors={app.chartPalette}
/>
```

An interactive one, with data loading injected rather than imported:

```tsx
<CompareChart
  range={range}
  data={power.data}
  timeFrame="hours"
  loadStats={(window) => api.stats({ ...window, kind: "power" })}
  onError={(message) => app.toast.error({ body: message })}
  referenceValue={42}
/>
```

Deferring an expensive island until it is nearly on screen:

```tsx
function LazyChart() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return <div ref={ref}>{inView ? <CompareChart … /> : null}</div>
}
```

One metric panel, which is what `gb`'s chart route duplicated for power and energy — the two panels
differed only in their heading and a `/1000` conversion, so the conversion is the `scale` option:

```tsx
<MetricPanel title="Power" unit="kW" error={error} actions={<ExportButtons />}>
  <D3LineChart data={power.data} timeFrame={power.timeFrame} ariaLabel="Power, kW" />
</MetricPanel>
```

## Axis behaviour

`scales.ts` is pure logic with no renderer, so it is where a real bug would hurt most and it is tested
hardest. The rules it guarantees:

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

## Tests

`deno task test` from the repo root. `scales.test.ts` covers the axis maths including degenerate,
negative, tiny, huge and boundary-tick cases, and runs the non-termination case (`ticks(1e18, 1e18 +
100)`) in a worker with a deadline — `deno test` has no per-test timeout, so an in-process call would
hang the suite instead of failing it. The chart suites render each component with
`preact-render-to-string` and assert on real markup — tick counts, path geometry for a known dataset,
legend rows, percent widths, gradient stops and empty states. `d3-line-chart.test.tsx` additionally
covers the pure helpers behind the island (`yDomainFor`, `formatTimeTick`) and its server-rendered
shell, since d3 itself needs a DOM. `preact-render-to-string` is pinned in this package's `deno.json`
because the root import map has no renderer.

## Not in this package

`MetricsList` (domain-coupled to metric catalogs and device ids — the layout idea lives on in
`Bars`), `DateTimeFilter` (a range picker belongs with the app or `ui/`; `CompareChart` takes a
`rangePicker` slot instead), `Export` (drags in `xlsx`), and `chooseChartRoute` from
`metric-rollup-prep`, which is a proposal rather than implemented code.
