# `@spy4x/preact-charts`

Chart components extracted from earlier source applications.

Two approaches live side by side, and the split is deliberate:

- **Zero-JS SVG, server-rendered** — `LineChart`, `Bars`, `DonutChart`, `Kpi`, `MetricPanel`, plus the
  shared maths in `scales.ts`, `time-series.ts`, `colors.ts` and the `payload.ts` loader. Plain markup
  with no hydration and no client bundle. These are what an MPA or an SSR route should reach for.
- **Interactive d3 islands** — `D3LineChart`, `CompareChart`. Imperative d3 v7 render in an effect,
  resize-aware, with a tooltip. Use these only where the interaction earns the JavaScript.

The split is also a dependency boundary: **only the islands need `d3`**, and only they import it.
Everything on the SVG side type-checks, tests and bundles with `d3` absent. See
[Do I need d3?](#do-i-need-d3).

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
- **No sibling package imports.** `charts/` depends on `preact`, `arktype`, `d3` for the islands only,
  and nothing else in the workspace, so it stays independent of `ui/` and `signals/`.
- **d3 is optional, and it is not in the root import map.** One module needs it, so the specifier is
  declared next to that module instead of being ambient for every consumer of every package. See
  [Do I need d3?](#do-i-need-d3).

## Components

| Component      | Subpath         | Kind    | Needs d3 | Key props / ports                                                     |
| -------------- | --------------- | ------- | -------- | --------------------------------------------------------------------- |
| `LineChart`    | `line-chart`    | zero-JS | no       | `series`, `width`, `height`, `yFormat`, `yDomain`, `xStride`, colours |
| `Bars`         | `bars`          | zero-JS | no       | `data`, `max`, `format`, `labelWidth`, `colors`                       |
| `DonutChart`   | `donut-chart`   | zero-JS | no       | `data`, `centerValue`, `centerLabel`, `showLegend`, `colors`          |
| `Kpi`          | `kpi`           | zero-JS | no       | `label`, `value`, `sub`, `tone`                                       |
| `KpiGrid`      | `kpi`           | zero-JS | no       | `children`, `minWidth`                                                |
| `D3LineChart`  | `d3-line-chart` | island  | **yes**  | `data`, `timeFrame`, `referenceValue`, `ignoreZeroes`, `colors`       |
| `CompareChart` | `compare-chart` | island  | **yes**  | `range`, `data`, `loadStats` (port), `rangePicker` (slot)             |
| `MetricPanel`  | `metric-panel`  | shell   | no       | `title`, `unit`, `error`, `actions`, `children`                       |

Hooks and helpers, all d3-free: `useInView` (`use-in-view`), `useMetricSeries` / `loadMetricSeries`
(`metric-panel`), `previousPeriod` / `loadChartPayload` / `chartPayloadSchema` (`payload`), the
`TIME_FRAMES` / `TimeFrame` / `TimeSeriesPoint` vocabulary (`time-series`), and the axis maths in
`scales` — `niceStep`, `ticks`, `niceScale`, `paddedDomain`, `linearScale`, `extent`, `xLabelStride`.

## Usage

```tsx
// The SVG half, through a barrel that imports nothing d3-backed.
import { Bars, DonutChart, Kpi, KpiGrid, LineChart, MetricPanel } from "@spy4x/preact-charts/svg"
// or one chart at a time
import { LineChart } from "@spy4x/preact-charts/line-chart"

// The interactive half, which needs d3 (see below).
import { D3LineChart } from "@spy4x/preact-charts/d3-line-chart"
import { CompareChart } from "@spy4x/preact-charts/compare-chart"
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

One metric panel, which is what a source application's chart route duplicated for power and energy — the two panels
differed only in their heading and a `/1000` conversion, so the conversion is the `scale` option:

```tsx
<MetricPanel title="Power" unit="kW" error={error} actions={<ExportButtons />}>
  <D3LineChart data={power.data} timeFrame={power.timeFrame} ariaLabel="Power, kW" />
</MetricPanel>
```

## Do I need d3?

No, unless you render `D3LineChart` or `CompareChart`. This is the full list:

| Needs `d3`                                      | Does not                                         |
| ----------------------------------------------- | ------------------------------------------------ |
| `d3-line-chart` (`D3LineChart`)                 | `scales`, `colors`, `time-series`, `payload`     |
| `compare-chart` (`CompareChart`)                | `line-chart`, `bars`, `donut-chart`, `kpi`       |
| the package barrel `.` (re-exports both halves) | `metric-panel`, `use-in-view`, the `svg` barrel  |
| `ui-guide`'s registry (imports the barrel)      | every suite here except `d3-line-chart.test.tsx` |
| `compare-chart.test.tsx`                        | —                                                |

`CompareChart` imports `D3LineChart`, so it needs d3 for that reason alone. Type-only imports count
too: `payload.ts` and `metric-panel.tsx` used to take `TimeFrame` / `TimeSeriesPoint` from
`d3-line-chart.tsx`, which the resolver follows even though TypeScript erases it, so both would have
needed d3 declared to be type-checked. They take it from `time-series.ts` now.

**If you only draw SVG charts, do nothing.** Import `@spy4x/preact-charts/svg` (or any single
subpath above) and there is no `d3` in your dependency graph, your type check or your bundle. `d3` is
not in the root import map of this repo either — the specifier lives in `charts/deno.json`, next to
the one module that uses it, which is the closest thing Deno has to an optional peer dependency.

**If you want the interactive islands, add d3 yourself**, at the version `charts/deno.json` pins:

```bash
deno add npm:d3@7.9.0
# or, in a Node project: npm i d3@7.9.0
```

`D3LineChart` and `CompareChart` draw inside an effect with d3 v7 only — they are the reason the
package depends on it at all. `MetricPanel` is a shell around whatever chart you put in it, so it
stays on the SVG side, as does the `payload` loader that validates what a stats endpoint returns
(`TIME_FRAMES`, `TimeFrame` and `TimeSeriesPoint` live in `time-series.ts` and are re-exported from
`payload`-side modules, never from a d3-backed one).

### What happens without d3

Two failures, both loud, and neither can be turned into a confusing one:

1. **Importing a d3-backed subpath without the dependency.** `d3-line-chart.tsx` has a static
   `import * as d3 from "d3"`, so resolution fails at build time, naming the file, the line and the
   command that fixes it:

   ```
   TS2307 [ERROR]: Import "d3" not a dependency and not in import map from "…/charts/d3-line-chart.tsx"
     hint: If you want to use the npm package, try running `deno add npm:d3`
       at …/charts/d3-line-chart.tsx:1:21
   ```

   Deno says the same thing for `deno check`, `deno test` and `deno run`. A static import is
   deliberate: the failure has to happen at build time, not silently at runtime. There is no way to
   wrap it in a friendlier message — a static import is resolved before module code runs — so the
   message you get is the resolver's. Deno has no `peerDependenciesMeta`, so this repo cannot express
   "optional" any better than by pointing the specifier at the module that needs it.

2. **A `d3` that resolves but cannot draw** (a stub, a failed optional install, the wrong package
   under that name). The effect calls `assertD3Available`, which throws
   `MISSING_D3_LINE_ERROR` — it names the package, says the dependency is an optional peer, gives the
   install command and points at the zero-JS charts as the alternative — instead of failing with
   `d3.line is not a function` in the middle of `render`. `MISSING_D3_LINE_ERROR` is exported for
   hosts that want to preflight it.

   Honest scope: this repo has no DOM, so the throw is verified through its unit test against the real
   `d3` namespace and against objects that lack a line generator
   (`d3-line-chart.test.tsx`), not by driving a browser without d3.

### The probe, and what it shows today

`charts/probe/no-d3-dependency.ts` is a runnable probe. No CI runs it, and on `main` today its
second step fails ([issue #123](https://github.com/spy4x/preact-components/issues/123) tracks the
fix), so what follows is what the probe is built to show, not what a passing run shows today:

```bash
deno task --cwd charts probe:no-d3
```

It copies `charts/` to a scratch directory, builds an import map from the root map with the `d3`
specifier pointed at a file that does not exist, and then

1. type-checks the eleven zero-dependency entry points and runs the eight suites plus
   `charts/probe/no-d3-path.test.ts` — which imports the whole SVG graph, so an import is not enough
   to pass — with `d3` unresolvable;
2. repeats the exercise for the three d3-backed entry points and the two suites that import them,
   which **must** fail; without that control the first step could pass vacuously;
3. repeats it with no `d3` entry in the map at all — what a consumer who never added the dependency
   has — and asserts the message names the file and the fix.

It prints each of its five assertions as `ok` or `FAIL`, and exits non-zero if any fails. No bundler
and no bundle-size tool is added for it, and none is used — the byte figures in issue #25 come from
a Vite build outside this repo and **are not reproducible from this repo**. What is reproducible
here is the structural claim: the barrel re-exports the d3 islands (assertion 1 of the control,
`+index.ts` in the failing set), so a consumer who imports it needs d3 resolvable, while a consumer
of `svg` or any single SVG subpath does not.

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
`yTicks` other than 1, 2, 5 or 10 draws its gridlines in new places.

## Tests

`deno task test` from the repo root. `scales.test.ts` covers `extent`, `paddedDomain`, `niceScale`,
`linearScale` and `xLabelStride` — the axis helpers this package still owns — including degenerate,
negative, tiny, huge and boundary-tick cases, and runs `niceScale`'s own non-termination case
(`niceScale(1e6, 2e6, { target: 1e25 })`) and a termination check on the re-exported `ticks`
(`ticks(1e18, 1e18 + 100)`) each in a worker with a deadline — `deno test` has no per-test timeout, so
an in-process call would hang the suite instead of failing it. `ticks`/`niceStep` themselves are
tested once, in `@spy4x/platform`'s own `axis.test.ts`. The chart suites render each component with
`preact-render-to-string` and assert on real markup — tick counts, path geometry for a known dataset,
legend rows, percent widths, gradient stops and empty states. `d3-line-chart.test.tsx` additionally
covers the pure helpers behind the island (`yDomainFor`, `formatTimeTick`), the missing-d3 guard
(`assertD3Available`) and its server-rendered shell, since d3 itself needs a DOM.
`preact-render-to-string` comes from the root import map, which pins it for every package's tests.

`charts/probe/no-d3-dependency.ts` is the dependency-boundary suite: it is a task, not a test, because
it spawns `deno check`/`deno test` subprocesses. `charts/probe/no-d3-path.test.ts` is picked up by
`deno task test` too, and passing there shows nothing on its own — it is the scratch-map run in the
probe that gives it its meaning.

## Not in this package

`MetricsList` (domain-coupled to metric catalogs and device ids — the layout idea lives on in
`Bars`), `DateTimeFilter` (a range picker belongs with the app or `ui/`; `CompareChart` takes a
`rangePicker` slot instead), `Export` (drags in `xlsx`), and `chooseChartRoute`, which is a
proposal rather than implemented code.
