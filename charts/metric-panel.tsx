import type { ComponentChildren, JSX } from "preact"
import { useCallback, useEffect, useState } from "preact/hooks"
import { type DateRange, loadChartPayload } from "./payload.ts"
import type { TimeFrame, TimeSeriesPoint } from "./time-series.ts"

/** Human-readable failure, as a stats port reports it. */
export interface MetricError {
  message: string
  /** What the reader can do about it, e.g. "Widen the date range". */
  instruction?: string
}

export interface MetricSeriesState {
  data: TimeSeriesPoint[]
  timeFrame: TimeFrame
  error: MetricError | null
}

export interface MetricSeriesOptions {
  /** Stats port; the panel never reaches into an application store. */
  loadStats: (range: DateRange) => Promise<unknown>
  range: DateRange
  /** Multiplies every value — `0.001` shows watts as kilowatts. Defaults to `1`. */
  scale?: number
  /** Granularity used when the loader returns an empty payload. Defaults to `"minutes"`. */
  fallbackTimeFrame?: TimeFrame
  /** Skips the request until the caller says the panel is on screen. Defaults to `true`. */
  enabled?: boolean
}

export interface MetricPanelProps {
  title: string
  /** Unit shown next to the title, e.g. `"kW"`. */
  unit?: string
  error?: MetricError | null
  /** Export buttons and other panel actions. */
  actions?: ComponentChildren
  /** The chart body. */
  children: ComponentChildren
  class?: string
}

/**
 * Load one metric series through a stats port and unit-scale it.
 *
 * The single implementation behind what a source application's chart route duplicated for power and
 * energy: the two
 * panels differed only in their label and a `/1000` conversion, so the conversion is the `scale`
 * option here. A failing loader and an invalid payload both come back as a {@link MetricError}.
 */
export async function loadMetricSeries(options: MetricSeriesOptions): Promise<MetricSeriesState> {
  const { loadStats, range, scale = 1, fallbackTimeFrame = "minutes" } = options
  const result = await loadChartPayload(loadStats, range)

  if (!result.payload) {
    return {
      data: [],
      timeFrame: fallbackTimeFrame,
      error: { message: result.error ?? "Unknown error" },
    }
  }

  return {
    data: scale === 1 ? result.payload.data : result.payload.data.map((point) => ({
      timeGroup: point.timeGroup,
      value: point.value * scale,
    })),
    timeFrame: result.payload.timeFrame,
    error: null,
  }
}

/**
 * {@link loadMetricSeries} as a hook, for a panel that owns its own fetching.
 *
 * `reload` re-runs the request; changing the range or the loader re-runs it automatically.
 */
export function useMetricSeries(
  options: MetricSeriesOptions,
): MetricSeriesState & { isLoading: boolean; reload: () => void } {
  const { loadStats, range, scale = 1, fallbackTimeFrame = "minutes", enabled = true } = options
  const [state, setState] = useState<MetricSeriesState>({
    data: [],
    timeFrame: fallbackTimeFrame,
    error: null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [nonce, setNonce] = useState(0)
  const from = range.from.getTime()
  const to = range.to.getTime()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    setIsLoading(true)
    loadMetricSeries({
      loadStats,
      range: { from: new Date(from), to: new Date(to) },
      scale,
      fallbackTimeFrame,
    })
      .then((next) => {
        if (cancelled) return
        setState(next)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, from, to, scale, fallbackTimeFrame, loadStats, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { ...state, isLoading, reload }
}

/**
 * One metric panel: title, unit, export actions, error box and chart slot.
 *
 * A source application's chart route rendered this block twice — once for power, once for energy — with only the
 * heading and the unit conversion differing, and the two copies drifted. Both call sites now render
 * this component; the conversion belongs in {@link loadMetricSeries}.
 */
export function MetricPanel(
  { title, unit, error, actions, children, class: className }: MetricPanelProps,
): JSX.Element {
  return (
    <section class={className ? `flex flex-col gap-3 ${className}` : "flex flex-col gap-3"}>
      <header class="flex items-center gap-3">
        <h2 class="text-sm font-medium text-gray-900 dark:text-gray-100">
          {unit ? `${title}, ${unit}` : title}
        </h2>
        {actions ? <div class="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>

      {error
        ? (
          <div class="rounded border border-red-200 bg-red-50 p-3 text-sm">
            <p class="font-medium text-red-800">{error.message}</p>
            {error.instruction ? <p class="mt-1 text-red-600">{error.instruction}</p> : null}
          </div>
        )
        : null}

      {children}
    </section>
  )
}
