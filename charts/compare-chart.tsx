import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import {
  D3LineChart,
  type D3LineChartProps,
  type TimeFrame,
  type TimeSeriesPoint,
} from "./d3-line-chart.tsx"
import { type DateRange, loadChartPayload, previousPeriod } from "./payload.ts"

export interface CompareChartProps extends Omit<D3LineChartProps, "data" | "isLoading" | "class"> {
  /** The window the primary chart shows. */
  range: DateRange
  data: readonly TimeSeriesPoint[]
  timeFrame: TimeFrame
  /** Stats port for the previous window; replaces a source application's `state.chart.getStats`. */
  loadStats: (range: DateRange) => Promise<unknown>
  /** Whether the primary chart itself is still loading. */
  isLoading?: boolean
  /** Label of the toggle. Defaults to `"Compare with the previous period"`. */
  compareLabel?: string
  /** Rendered above the comparison chart, e.g. a date-range picker. */
  rangePicker?: ComponentChildren
  /** Called with the reason when the previous window cannot be loaded. */
  onError?: (message: string) => void
  class?: string
}

interface ComparisonState {
  loading: boolean
  data: TimeSeriesPoint[]
  timeFrame: TimeFrame | null
  error: string | null
}

const IDLE: ComparisonState = { loading: false, data: [], timeFrame: null, error: null }

/**
 * A time-series chart with a toggle that loads the window before it.
 *
 * The panel is application-agnostic: the caller passes the current range, the data it already has and
 * a `loadStats` port for the previous window. Ported from a source application, where the
 * comparison window was fetched straight out of the app's chart store and the toggle was the
 * app's `ToggleSwitch`.
 */
export function CompareChart({
  range,
  data,
  timeFrame,
  loadStats,
  isLoading = false,
  compareLabel = "Compare with the previous period",
  rangePicker,
  onError,
  class: className,
  ...chartProps
}: CompareChartProps): JSX.Element {
  const [comparing, setComparing] = useState(false)
  const [comparison, setComparison] = useState<ComparisonState>(IDLE)
  const panelRef = useRef<HTMLDivElement>(null)
  const from = range.from.getTime()
  const to = range.to.getTime()

  useEffect(() => {
    if (!comparing) return
    let cancelled = false

    setComparison((state) => ({ ...state, loading: true }))
    loadChartPayload(loadStats, previousPeriod(range)).then((result) => {
      if (cancelled) return
      setComparison({
        loading: false,
        data: result.payload?.data ?? [],
        timeFrame: result.payload?.timeFrame ?? null,
        error: result.error,
      })
      if (result.error) onError?.(result.error)
    })

    return () => {
      cancelled = true
    }
    // `from`/`to` stand in for the range object, so an inline `{ from, to }` literal is fine.
  }, [comparing, from, to, loadStats, onError])

  useEffect(() => {
    if (!comparing) return
    const panel = panelRef.current
    if (panel && typeof panel.scrollIntoView === "function") {
      panel.scrollIntoView({ behavior: "smooth" })
    }
  }, [comparing])

  return (
    <div class={className ? `space-y-4 ${className}` : "space-y-4"}>
      <div class="flex justify-end">
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="size-4 rounded border-gray-300"
            checked={comparing}
            onChange={(event) => setComparing(event.currentTarget.checked)}
          />
          {compareLabel}
        </label>
      </div>

      <D3LineChart {...chartProps} data={data} timeFrame={timeFrame} isLoading={isLoading} />

      {comparing
        ? (
          <div ref={panelRef} class="space-y-3">
            {rangePicker}
            {comparison.error
              ? (
                <p class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {comparison.error}
                </p>
              )
              : null}
            <D3LineChart
              {...chartProps}
              data={comparison.data}
              timeFrame={comparison.timeFrame ?? timeFrame}
              isLoading={comparison.loading}
              ariaLabel={chartProps.ariaLabel
                ? `${chartProps.ariaLabel} — previous period`
                : "Previous period"}
            />
          </div>
        )
        : null}
    </div>
  )
}
