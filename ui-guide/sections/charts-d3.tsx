/**
 * The charts page's only way to the modules that import d3.
 *
 * `charts/d3-line-chart.tsx` imports d3 at module scope, and `charts/compare-chart.tsx` imports it
 * in turn, so a static import of either — or of the `@spy4x/preact-charts` barrel, which
 * re-exports both — puts d3 into every app that mounts the guide. The charts sections reach them
 * only through the two loaders here, whose dynamic `import()` runs from an effect when a card on the
 * charts page mounts (`../lazy.ts`). Until it resolves, a card shows a placeholder, on the server
 * and in the browser alike.
 *
 * Types are imported with `import type`, which leaves nothing behind in the bundle.
 */

import type { CompareChartProps } from "@spy4x/preact-charts/compare-chart"
import type { D3LineChartProps } from "@spy4x/preact-charts/d3-line-chart"
import type { JSX } from "preact"
import { lazyModule, type LazyModuleState } from "../lazy.ts"

/** `charts/d3-line-chart.tsx`, loaded when the first card that needs it mounts. */
export const d3LineChartModule = lazyModule(() => import("@spy4x/preact-charts/d3-line-chart"))

/** `charts/compare-chart.tsx`, loaded when its card mounts. */
export const compareChartModule = lazyModule(() => import("@spy4x/preact-charts/compare-chart"))

/**
 * What a d3 card shows until its module has loaded, or instead of it when the load failed.
 *
 * @param props.state The module's load state; only `loading` and `failed` reach here.
 * @param props.label The chart's accessible name, so the placeholder says which chart is coming.
 */
function ChartPending(
  { state, label }: { state: LazyModuleState<unknown>; label: string },
): JSX.Element {
  if (state.status === "failed") {
    return (
      <p role="alert" data-e2e="d3-chart-failed" class="text-sm text-red-700 dark:text-red-400">
        {label}: the chart's d3 module did not load — {state.message}
      </p>
    )
  }
  return (
    <div
      role="status"
      data-e2e="d3-chart-loading"
      class="flex min-h-48 items-center justify-center rounded border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
    >
      Loading {label}…
    </div>
  )
}

/**
 * `D3LineChart`, loaded on first mount.
 *
 * @param props The chart's own props, passed through unchanged.
 */
export function LazyD3LineChart(props: D3LineChartProps): JSX.Element {
  const state = d3LineChartModule.use()
  if (state.status !== "loaded") {
    return <ChartPending state={state} label={props.ariaLabel ?? "Line chart"} />
  }
  const { D3LineChart } = state.module
  return <D3LineChart {...props} />
}

/**
 * `CompareChart`, loaded on first mount.
 *
 * @param props The chart's own props, passed through unchanged.
 */
export function LazyCompareChart(props: CompareChartProps): JSX.Element {
  const state = compareChartModule.use()
  if (state.status !== "loaded") {
    return <ChartPending state={state} label={props.ariaLabel ?? "Comparison chart"} />
  }
  const { CompareChart } = state.module
  return <CompareChart {...props} />
}
