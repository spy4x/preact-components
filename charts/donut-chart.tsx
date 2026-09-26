import type { JSX } from "preact"
import {
  DEFAULT_SURFACE_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TRACK_COLOR,
  seriesColor,
} from "./colors.ts"

export interface DonutDatum {
  label: string
  value: number
  /** Overrides the palette entry for this slice. */
  color?: string
  href?: string
}

export interface DonutSegment {
  label: string
  value: number
  color: string
  /** Fraction of the total, `0…1`. */
  share: number
  /** `share` as a fixed-point percentage string, e.g. `"33.3%"`. */
  percent: string
  /** Where the slice starts, in percent of the ring. */
  startPercent: number
  /** Where the slice ends, in percent of the ring. */
  endPercent: number
}

export interface DonutGeometry {
  /** A ready-to-use `conic-gradient(…)` value. */
  gradient: string
  segments: DonutSegment[]
  /** Sum of the plotted values; `0` when nothing is plottable. */
  total: number
}

export interface DonutGeometryOptions {
  colors?: readonly string[]
  /** Colour of the full ring when no slice has a positive value. */
  emptyColor?: string
}

/**
 * Slice maths for {@link DonutChart}: cumulative shares plus the `conic-gradient` string.
 *
 * Pure and exported on its own so the geometry is testable without a renderer. Non-finite and
 * negative values count as `0`, and a dataset with no positive value produces a flat empty ring
 * rather than the invalid `conic-gradient` the source component emitted for an all-zero total.
 */
export function donutGeometry(
  data: readonly DonutDatum[],
  options: DonutGeometryOptions = {},
): DonutGeometry {
  const emptyColor = options.emptyColor ?? DEFAULT_TRACK_COLOR
  const values = data.map((datum) =>
    Number.isFinite(datum.value) && datum.value > 0 ? datum.value : 0
  )
  const total = values.reduce((sum, value) => sum + value, 0)

  if (!(total > 0)) {
    return {
      gradient: `conic-gradient(${emptyColor} 0% 100%)`,
      total: 0,
      segments: data.map((datum, index) => ({
        label: datum.label,
        value: values[index],
        color: datum.color ?? seriesColor(index, options.colors),
        share: 0,
        percent: "0.0%",
        startPercent: 0,
        endPercent: 0,
      })),
    }
  }

  const segments: DonutSegment[] = []
  const stops: string[] = []
  let offset = 0

  for (const [index, datum] of data.entries()) {
    const share = values[index] / total
    const startPercent = roundPercent(offset * 100)
    offset += share
    const endPercent = roundPercent(offset * 100)
    const color = datum.color ?? seriesColor(index, options.colors)

    stops.push(`${color} ${startPercent}% ${endPercent}%`)
    segments.push({
      label: datum.label,
      value: values[index],
      color,
      share,
      percent: `${(share * 100).toFixed(1)}%`,
      startPercent,
      endPercent,
    })
  }

  return { gradient: `conic-gradient(${stops.join(", ")})`, segments, total }
}

export interface DonutChartProps {
  data: DonutDatum[]
  /** Small caption under the centre value. */
  centerLabel?: string
  centerValue?: string | number
  title?: string
  /** Slice colours, in order. Defaults to the shared chart palette. */
  colors?: readonly string[]
  trackColor?: string
  textColor?: string
  surfaceColor?: string
  /** Defaults to `true`. */
  showLegend?: boolean
  emptyLabel?: string
  /** Overrides the accessible name. Defaults to `title`. */
  ariaLabel?: string
  class?: string
}

/**
 * Server-rendered donut built from a single CSS `conic-gradient` — zero JavaScript.
 *
 * The share maths lives in {@link donutGeometry}; this component only lays the ring out next to a
 * legend whose rows link out when a datum carries an `href`.
 */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  title,
  colors,
  trackColor = DEFAULT_TRACK_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  surfaceColor = DEFAULT_SURFACE_COLOR,
  showLegend = true,
  emptyLabel = "No data",
  ariaLabel,
  class: className,
}: DonutChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div class={className}>
        {title ? <h3 class="mb-2 text-sm font-medium">{title}</h3> : null}
        <p class="text-sm" style={{ color: textColor }}>{emptyLabel}</p>
      </div>
    )
  }

  const geometry = donutGeometry(data, { colors, emptyColor: trackColor })

  return (
    <div
      class={className
        ? `flex flex-wrap items-center gap-6 ${className}`
        : "flex flex-wrap items-center gap-6"}
    >
      {title ? <h3 class="w-full text-sm font-medium">{title}</h3> : null}
      <div
        class="relative size-40 shrink-0 rounded-full"
        role="img"
        aria-label={ariaLabel ?? title ?? `Donut chart of ${data.length} slices`}
        style={{ background: geometry.gradient }}
      >
        <div
          class="absolute inset-[15%] grid place-items-center rounded-full"
          style={{ background: surfaceColor }}
        >
          <div class="text-center leading-tight">
            <strong class="block text-lg">{centerValue}</strong>
            <span class="block text-xs" style={{ color: textColor }}>{centerLabel}</span>
          </div>
        </div>
      </div>

      {showLegend
        ? (
          <ul class="flex min-w-48 flex-1 flex-col gap-1 text-sm">
            {geometry.segments.map((segment, index) => {
              const body = (
                <>
                  <span
                    class="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ background: segment.color }}
                  >
                  </span>
                  <span class="flex-1">{segment.label}</span>
                  <strong class="tabular-nums">{segment.percent}</strong>
                </>
              )

              return (
                <li key={`${segment.label}-${index}`} class="flex items-center gap-2">
                  {data[index].href
                    ? (
                      <a
                        class="flex flex-1 items-center gap-2 hover:underline"
                        href={data[index].href}
                      >
                        {body}
                      </a>
                    )
                    : <div class="flex flex-1 items-center gap-2">{body}</div>}
                </li>
              )
            })}
          </ul>
        )
        : null}
    </div>
  )
}

/** Percentages rounded to two decimals, so the gradient string is stable across renders. */
function roundPercent(value: number): number {
  return Math.round(value * 100) / 100
}
