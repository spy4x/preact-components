/**
 * The charts page's only way to the modules that import d3.
 *
 * `charts/d3-line-chart.tsx` imports d3 at module scope, and `charts/compare-chart.tsx` imports it
 * in turn, so a static import of either — or of the `@spy4x/preact-charts` barrel, which re-exports
 * both — puts d3 into every app that mounts the guide. The charts sections reach them only through
 * the two loaders here, whose dynamic `import()` runs from an effect when a card on the charts page
 * mounts (`../lazy.ts`). Until it resolves, a card shows a placeholder, on the server and in the
 * browser alike.
 *
 * Types are imported with `import type`, which leaves nothing behind in the bundle.
 */

import type { CompareChartProps } from "@spy4x/preact-charts/compare-chart"
import type { D3LineChartProps } from "@spy4x/preact-charts/d3-line-chart"
import type { JSX } from "preact"
import { lazyModule } from "../lazy.ts"
import { LazySlot } from "../lazy-slot.tsx"

/** `charts/d3-line-chart.tsx`, loaded when the first card that needs it mounts. */
export const d3LineChartModule = lazyModule(() => import("@spy4x/preact-charts/d3-line-chart"))

/** `charts/compare-chart.tsx`, loaded when its card mounts. */
export const compareChartModule = lazyModule(() => import("@spy4x/preact-charts/compare-chart"))

/** Where a d3 card's placeholder says the chart is drawn, and what the failure line names. */
const D3_SLOT = {
  drawnWith: "d3",
  module: "the chart's d3 module",
  e2e: "d3-chart",
  boxClass: "min-h-48 rounded",
} as const

/**
 * `D3LineChart`, loaded on first mount.
 *
 * @param props The chart's own props, passed through unchanged.
 */
export function LazyD3LineChart(props: D3LineChartProps): JSX.Element {
  return (
    <LazySlot state={d3LineChartModule.use()} label={props.ariaLabel ?? "Line chart"} {...D3_SLOT}>
      {({ D3LineChart }) => <D3LineChart {...props} />}
    </LazySlot>
  )
}

/**
 * `CompareChart`, loaded on first mount.
 *
 * @param props The chart's own props, passed through unchanged.
 */
export function LazyCompareChart(props: CompareChartProps): JSX.Element {
  return (
    <LazySlot
      state={compareChartModule.use()}
      label={props.ariaLabel ?? "Comparison chart"}
      {...D3_SLOT}
    >
      {({ CompareChart }) => <CompareChart {...props} />}
    </LazySlot>
  )
}
