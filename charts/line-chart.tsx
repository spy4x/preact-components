import type { JSX } from "preact"
import {
  DEFAULT_AXIS_COLOR,
  DEFAULT_GRID_COLOR,
  DEFAULT_SURFACE_COLOR,
  DEFAULT_TEXT_COLOR,
  seriesColor,
} from "./colors.ts"
import { extent, linearScale, niceScale, ticks, xLabelStride } from "./scales.ts"

export interface LinePoint {
  /** Position on the X axis. Repeated across series to line them up. */
  x: string
  y: number
}

export interface LineSeries {
  name: string
  points: LinePoint[]
  /** Overrides the palette entry for this series. */
  color?: string
  /** Draw a dot with a `<title>` tooltip at every point. Defaults to `true`. */
  showPoints?: boolean
}

export interface LineChartProps {
  series: LineSeries[]
  /** `viewBox` width. Defaults to `800`. */
  width?: number
  /** `viewBox` height. Defaults to `280`. */
  height?: number
  /** Y tick label format. Defaults to two decimals. */
  yFormat?: (value: number) => string
  /** Fixes the Y domain instead of deriving a padded one from the data. */
  yDomain?: readonly [number, number]
  /** Requested number of Y steps. Defaults to `5`. */
  yTicks?: number
  /** X label stride. Defaults to a stride that keeps about eight labels. */
  xStride?: number
  title?: string
  /** Overrides the accessible name. Defaults to `title`, then to a series count. */
  ariaLabel?: string
  /** Series colours, in draw order. Defaults to the shared chart palette. */
  colors?: readonly string[]
  axisColor?: string
  gridColor?: string
  textColor?: string
  surfaceColor?: string
  /** Defaults to `true` for a multi-series chart and `false` for a single one. */
  showLegend?: boolean
  emptyLabel?: string
  class?: string
}

const PAD_LEFT = 56
const PAD_RIGHT = 16
const PAD_TOP = 24
const PAD_BOTTOM = 36

/**
 * Server-rendered SVG line chart: no JavaScript, no hydration, no `d3`.
 *
 * Axis maths comes from `scales.ts`, so a degenerate series (one point, all-equal values, mixed
 * non-finite values) still renders something sane. Colours arrive as props and default to `theme/`
 * custom properties, which is why the source's hardcoded `#2a3556`/`#97a3bf` are gone: every colour
 * here is applied through `style`, since `var()` does not resolve in SVG presentation attributes.
 */
export function LineChart({
  series,
  width = 800,
  height = 280,
  yFormat = (value: number) => value.toFixed(2),
  yDomain,
  yTicks = 5,
  xStride,
  title,
  ariaLabel,
  colors,
  axisColor = DEFAULT_AXIS_COLOR,
  gridColor = DEFAULT_GRID_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  surfaceColor = DEFAULT_SURFACE_COLOR,
  showLegend,
  emptyLabel = "No data",
  class: className,
}: LineChartProps): JSX.Element {
  const drawable = series
    .map((entry) => ({
      ...entry,
      points: entry.points.filter((point) => Number.isFinite(point.y)),
    }))
    .filter((entry) => entry.points.length > 0)

  const values = drawable.flatMap((entry) => entry.points.map((point) => point.y))
  const bounds = extent(values)

  if (!bounds) {
    return (
      <div class={className}>
        {title ? <h3 class="mb-2 text-sm font-medium">{title}</h3> : null}
        <p class="text-sm" style={{ color: textColor }}>{emptyLabel}</p>
      </div>
    )
  }

  const y = resolveYDomain(yDomain, bounds, yTicks)
  const yTicksValues = y.ticks

  const plotWidth = width - PAD_LEFT - PAD_RIGHT
  const plotHeight = height - PAD_TOP - PAD_BOTTOM

  const uniqueX = [...new Set(drawable.flatMap((entry) => entry.points.map((point) => point.x)))]
  const xPositions = new Map(uniqueX.map((label, index) => [label, index] as const))
  const toX = linearScale([0, uniqueX.length - 1], [PAD_LEFT, PAD_LEFT + plotWidth])
  const toY = linearScale([y.min, y.max], [PAD_TOP + plotHeight, PAD_TOP])
  const stride = xStride ?? xLabelStride(uniqueX.length)
  const legend = showLegend ?? drawable.length > 1

  return (
    <div class={className ? `overflow-x-auto ${className}` : "overflow-x-auto"}>
      {title ? <h3 class="mb-2 text-sm font-medium">{title}</h3> : null}
      <svg
        class="block w-full min-w-[600px] rounded-lg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? title ?? `Line chart with ${drawable.length} series`}
        font-family="ui-sans-serif, system-ui, sans-serif"
        font-size="10"
        style={{ background: surfaceColor }}
      >
        {yTicksValues.map((tick) => (
          <g key={`tick-${tick}`}>
            <line
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={toY(tick)}
              y2={toY(tick)}
              stroke-dasharray="2 4"
              style={{ stroke: gridColor }}
            />
            <text
              x={PAD_LEFT - 6}
              y={toY(tick) + 4}
              text-anchor="end"
              style={{ fill: textColor }}
            >
              {yFormat(tick)}
            </text>
          </g>
        ))}

        <line
          x1={PAD_LEFT}
          x2={width - PAD_RIGHT}
          y1={PAD_TOP + plotHeight}
          y2={PAD_TOP + plotHeight}
          style={{ stroke: axisColor }}
        />

        {uniqueX.map((label, index) =>
          index % stride === 0 || index === uniqueX.length - 1
            ? (
              <text
                key={`x-${label}`}
                x={toX(xPositions.get(label) ?? 0)}
                y={height - PAD_BOTTOM + 16}
                text-anchor="middle"
                style={{ fill: textColor }}
              >
                {label}
              </text>
            )
            : null
        )}

        {drawable.map((entry, seriesIndex) => {
          const color = entry.color ?? seriesColor(seriesIndex, colors)
          return (
            <g key={`series-${entry.name}-${seriesIndex}`}>
              <path
                d={linePath(entry.points, (point) => toX(xPositions.get(point.x) ?? 0), (point) =>
                  toY(point.y))}
                fill="none"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style={{ stroke: color }}
              />
              {(entry.showPoints ?? true) && entry.points.map((point, pointIndex) => (
                <circle
                  key={`point-${entry.name}-${pointIndex}`}
                  cx={toX(xPositions.get(point.x) ?? 0)}
                  cy={toY(point.y)}
                  r="3"
                  style={{ fill: color }}
                >
                  <title>{`${entry.name} ${point.x}: ${yFormat(point.y)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>

      {legend
        ? (
          <div
            class="mt-2 flex flex-wrap gap-4 text-xs"
            style={{ color: textColor }}
          >
            {drawable.map((entry, seriesIndex) => (
              <span
                key={`legend-${entry.name}-${seriesIndex}`}
                class="inline-flex items-center gap-1.5"
              >
                <span
                  class="inline-block h-[3px] w-3"
                  style={{ background: entry.color ?? seriesColor(seriesIndex, colors) }}
                >
                </span>
                {entry.name}
              </span>
            ))}
          </div>
        )
        : null}
    </div>
  )
}

/** `M x,y L x,y …` for one series. Coordinates are rounded to one decimal to keep markup stable. */
function linePath(
  points: readonly LinePoint[],
  toX: (point: LinePoint) => number,
  toY: (point: LinePoint) => number,
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L"
      return `${command}${toX(point).toFixed(1)},${toY(point).toFixed(1)}`
    })
    .join(" ")
}

/**
 * Explicit domain when the caller gave one, otherwise a padded and rounded-outward one.
 *
 * An explicit domain is honoured exactly — a comparison chart needs two panels on one axis — but it
 * still gets ticks, and a single-value domain is widened so it cannot divide by zero.
 */
function resolveYDomain(
  override: readonly [number, number] | undefined,
  bounds: readonly [number, number],
  target: number,
): { min: number; max: number; ticks: number[] } {
  if (override && Number.isFinite(override[0]) && Number.isFinite(override[1])) {
    const [low, high] = override[0] <= override[1] ? override : [override[1], override[0]]
    if (low < high) return { min: low, max: high, ticks: ticks(low, high, target) }
  }

  return niceScale(bounds[0], bounds[1], { target })
}
