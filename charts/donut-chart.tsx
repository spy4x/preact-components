import type { JSX } from "preact"
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks"
import {
  CHART_PALETTE_CLASS,
  DEFAULT_AXIS_COLOR,
  DEFAULT_SURFACE_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TRACK_COLOR,
  seriesColor,
} from "./colors.ts"
import { positionTooltip, TOOLTIP_TEXT_COLOR } from "./tooltip.ts"

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
  /** How a slice's value is printed in its tooltip. Defaults to `String`. */
  valueFormat?: (value: number) => string
  /** Added to the accessible name once the ring responds to keys. */
  keyboardHint?: string
  class?: string
}

/** The hole's radius as a share of the ring's: the centre is inset 15% on every side. */
const HOLE = 0.7

/**
 * Server-rendered donut built from a single CSS `conic-gradient`.
 *
 * The share maths lives in {@link donutGeometry}; this component lays the ring out next to a
 * legend whose rows link out when a datum carries an `href`. With no JavaScript that is the whole
 * chart. In a browser each slice also has a tooltip — label, value and share — on hover, and by
 * keyboard: the ring takes focus, the arrow keys, Home and End step through the slices, and Escape
 * hides it. The tooltip stays inside the chart and the viewport.
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
  valueFormat = String,
  keyboardHint = "Arrow keys step through the slices.",
  class: className,
}: DonutChartProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [interactive, setInteractive] = useState(false)
  const [chosen, setActive] = useState<number | null>(null)
  useEffect(() => setInteractive(true), [])

  const geometry = donutGeometry(data, { colors, emptyColor: trackColor })
  // Only a slice with a share can be pointed at; an empty ring has none.
  const slices = geometry.segments.flatMap((segment, index) => segment.share > 0 ? [index] : [])
  // A slice chosen before the data changed may no longer exist or be drawn; it then counts as none.
  const active = chosen !== null && slices.includes(chosen) ? chosen : null

  useLayoutEffect(() => {
    const root = rootRef.current
    const ring = ringRef.current
    const tooltip = tooltipRef.current
    if (active === null || !root || !ring || !tooltip) return
    const segment = geometry.segments[active]
    const box = ring.getBoundingClientRect()
    const turn = ((segment.startPercent + segment.endPercent) / 200) * 2 * Math.PI
    const radius = (box.width / 2) * (1 + HOLE) / 2
    positionTooltip(root, tooltip, {
      x: box.left + box.width / 2 + Math.sin(turn) * radius,
      y: box.top + box.height / 2 - Math.cos(turn) * radius,
    })
  })

  if (data.length === 0) {
    return (
      <div class={className}>
        {title ? <h3 class="mb-2 text-sm font-medium">{title}</h3> : null}
        <p class="text-sm" style={{ color: textColor }}>{emptyLabel}</p>
      </div>
    )
  }

  /** The slice under a pointer, or `null` over the hole, outside the ring or on an empty ring. */
  const sliceAt = (clientX: number, clientY: number): number | null => {
    const ring = ringRef.current
    if (!ring) return null
    const box = ring.getBoundingClientRect()
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)
    const distance = Math.hypot(dx, dy) / (box.width / 2)
    if (distance < HOLE || distance > 1) return null
    const at = ((Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1) * 100
    return slices.find((index) => {
      const segment = geometry.segments[index]
      return at >= segment.startPercent && at < segment.endPercent
    }) ?? slices[slices.length - 1] ?? null
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const order = active === null ? -1 : slices.indexOf(active)
    const last = slices.length - 1
    const moves: Record<string, () => number | null> = {
      ArrowRight: () => slices[Math.min(last, order + 1)],
      ArrowDown: () => slices[Math.min(last, order + 1)],
      ArrowLeft: () => slices[order < 0 ? last : Math.max(0, order - 1)],
      ArrowUp: () => slices[order < 0 ? last : Math.max(0, order - 1)],
      Home: () => slices[0],
      End: () => slices[last],
      Escape: () => null,
    }
    const move = moves[event.key]
    if (!move || last < 0) return
    event.preventDefault()
    setActive(move())
  }

  const label = ariaLabel ?? title ?? `Donut chart of ${data.length} slices`
  const activeSegment = active === null ? undefined : geometry.segments[active]

  return (
    <div
      ref={rootRef}
      class={className
        ? `relative flex flex-wrap items-center gap-6 ${CHART_PALETTE_CLASS} ${className}`
        : `relative flex flex-wrap items-center gap-6 ${CHART_PALETTE_CLASS}`}
      data-chart="donut"
    >
      {title ? <h3 class="w-full text-sm font-medium">{title}</h3> : null}
      <div
        ref={ringRef}
        class="relative size-40 shrink-0 rounded-full outline-offset-4"
        role="img"
        aria-label={interactive && slices.length > 0 ? `${label}. ${keyboardHint}` : label}
        tabIndex={interactive && slices.length > 0 ? 0 : undefined}
        style={{ background: geometry.gradient }}
        data-chart-ring=""
        onPointerMove={(event) => setActive(sliceAt(event.clientX, event.clientY))}
        onPointerDown={(event) => setActive(sliceAt(event.clientX, event.clientY))}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") setActive(null)
        }}
        onFocus={() => setActive((current) => current ?? slices[0] ?? null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <div
          class="pointer-events-none absolute inset-[15%] grid place-items-center rounded-full"
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
      <div
        ref={tooltipRef}
        class={activeSegment
          ? "pointer-events-none absolute top-0 left-0 z-10 flex max-w-64 flex-col gap-1 rounded-md border px-2 py-1 text-xs shadow-sm"
          : "pointer-events-none invisible absolute top-0 left-0 z-10 flex max-w-64 flex-col gap-1 rounded-md border px-2 py-1 text-xs shadow-sm"}
        style={{
          background: surfaceColor,
          borderColor: DEFAULT_AXIS_COLOR,
          color: TOOLTIP_TEXT_COLOR,
        }}
        role="status"
        data-chart-tooltip=""
      >
        {activeSegment
          ? (
            <>
              <span class="flex items-center gap-2">
                <span
                  class="size-2 shrink-0 rounded-full"
                  style={{ background: activeSegment.color }}
                />
                <strong class="font-medium">{activeSegment.label}</strong>
              </span>
              <span class="tabular-nums">
                {`${valueFormat(activeSegment.value)} · ${activeSegment.percent}`}
              </span>
            </>
          )
          : null}
      </div>
    </div>
  )
}

/** Percentages rounded to two decimals, so the gradient string is stable across renders. */
function roundPercent(value: number): number {
  return Math.round(value * 100) / 100
}
