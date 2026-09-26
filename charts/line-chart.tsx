import type { JSX } from "preact"
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks"
import {
  CHART_PALETTE_CLASS,
  DEFAULT_AXIS_COLOR,
  DEFAULT_GRID_COLOR,
  DEFAULT_SURFACE_COLOR,
  DEFAULT_TEXT_COLOR,
  seriesColor,
} from "./colors.ts"
import { extent, niceScale, ticks, xLabelStride } from "./scales.ts"
import { formatTimeFull, formatTimeTick, type TimeStep, timeTicks } from "./time-ticks.ts"
import { positionTooltip, TOOLTIP_TEXT_COLOR } from "./tooltip.ts"

/** A point's place on the X axis: a label, or — on a time axis — an instant. */
export type LineX = string | number | Date

export interface LinePoint {
  /** A label on a category axis (repeated across series to line them up), an instant on a time axis. */
  x: LineX
  /** `null` or a non-finite number is a missing value: the line breaks there. */
  y: number | null
}

export interface LineSeries {
  name: string
  points: LinePoint[]
  /** Overrides the palette entry for this series. */
  color?: string
  /** Draw a dot at every point. Defaults to `true`. */
  showPoints?: boolean
  /** Draw the line dashed — a comparison or a forecast next to the real series. */
  dashed?: boolean
}

export interface LineChartProps {
  series: LineSeries[]
  /**
   * `"category"` spaces the X labels evenly in the order they first appear; `"time"` reads every `x`
   * as an instant (ISO string, epoch milliseconds or `Date`) and places it by time. Defaults to
   * `"category"`.
   */
  xAxis?: "category" | "time"
  /** Height of the plot, in pixels. Defaults to `240`. The chart always takes its parent's width. */
  height?: number
  /** Y tick and tooltip value format. Defaults to at most two decimals. */
  yFormat?: (value: number) => string
  /** X label and tooltip heading format; a time axis passes a `Date`. */
  xFormat?: (x: string | Date) => string
  /** Fixes the Y domain instead of deriving a padded one from the data. */
  yDomain?: readonly [number, number]
  /** Requested number of Y steps. Defaults to `5`. */
  yTicks?: number
  /** Category axis only: label every n-th X value. Defaults to a stride that keeps about six. */
  xStride?: number
  /** Time axis only: the zone labels are printed in. Defaults to `"UTC"`, so server and browser agree. */
  timeZone?: string
  /** Time axis only: the locale labels are printed in. Defaults to `"en-GB"`. */
  locale?: string
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
  /** A dashed horizontal marker, e.g. a target or a limit. Always inside the Y domain. */
  referenceValue?: number
  /** Printed at the right end of the reference line. */
  referenceLabel?: string
  /** Defaults to `textColor`: a neutral line that no series colour is mistaken for. */
  referenceColor?: string
  /** Treat a `0` as a missing value, for a series where zero means "no reading". */
  ignoreZeroes?: boolean
  /** Legend note shown when a line bridges missing values. */
  missingValuesLabel?: string
  isLoading?: boolean
  loadingLabel?: string
  emptyLabel?: string
  /** Added to the accessible name once the chart responds to keys. */
  keyboardHint?: string
  class?: string
}

/** The SVG's user space: both axes run 0…1000, stretched to the plot's size. */
const SPAN = 1000

/** One X position: its key, where it sits (`0…1`), and how it is printed. */
interface Slot {
  key: string
  position: number
  label: string
}

/** A series prepared for drawing: one entry per {@link Slot}, `undefined` where it has no point. */
interface Line {
  name: string
  color: string
  dashed: boolean
  showPoints: boolean
  values: (number | null | undefined)[]
}

/**
 * The line chart: drawn complete on the server, interactive once it runs in a browser.
 *
 * With no JavaScript it is a finished chart — axes, grid, lines, a dot per point whose native
 * tooltip gives its value, legend. The browser adds a crosshair and a tooltip that follow the
 * pointer, and keyboard stepping: the plot takes focus, the arrow keys, Home and End move between
 * points, and Escape hides the tooltip. The tooltip stays inside the chart and the viewport, flipping
 * to the left of the point near the right edge.
 *
 * The plot is an SVG stretched to its box, with the lines drawn at a constant width, while dots,
 * labels, grid and tooltip are HTML placed in percent: the chart takes any width with no
 * measurement on the server and keeps its text at its real size on a phone.
 */
export function LineChart({
  series,
  xAxis = "category",
  height = 240,
  yFormat = formatNumber,
  xFormat,
  yDomain,
  yTicks = 5,
  xStride,
  timeZone,
  locale,
  title,
  ariaLabel,
  colors,
  axisColor = DEFAULT_AXIS_COLOR,
  gridColor = DEFAULT_GRID_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  surfaceColor = DEFAULT_SURFACE_COLOR,
  showLegend,
  referenceValue,
  referenceLabel,
  referenceColor,
  ignoreZeroes = false,
  missingValuesLabel = "Dashed grey segments bridge missing values.",
  isLoading = false,
  loadingLabel = "Loading…",
  emptyLabel = "No data",
  keyboardHint = "Arrow keys step through the points.",
  class: className,
}: LineChartProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [interactive, setInteractive] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  useEffect(() => setInteractive(true), [])

  const isDefined = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && !(ignoreZeroes && value === 0)

  const { slots, step } = buildSlots(series, xAxis, { xFormat, timeZone, locale })
  const lines: Line[] = series.map((entry, index) => {
    const values: Line["values"] = slots.map(() => undefined)
    const at = new Map(slots.map((slot, slotIndex) => [slot.key, slotIndex]))
    for (const point of entry.points) {
      const slotIndex = at.get(slotKey(point.x, xAxis))
      if (slotIndex !== undefined) values[slotIndex] = point.y
    }
    return {
      name: entry.name,
      color: entry.color ?? seriesColor(index, colors),
      dashed: entry.dashed ?? false,
      showPoints: entry.showPoints ?? true,
      values,
    }
  })

  const plotted = lines.flatMap((line) => line.values.filter(isDefined))
  const hasReference = referenceValue !== undefined && Number.isFinite(referenceValue)
  const bounds = extent(hasReference ? [...plotted, referenceValue] : plotted)
  const label = ariaLabel ?? title ?? `Line chart with ${series.length} series`

  const y = resolveYDomain(yDomain, bounds ?? [0, 1], yTicks)
  const toFraction = (value: number) => y.max === y.min ? 0.5 : (y.max - value) / (y.max - y.min)
  const gutter = Math.max(24, ...y.ticks.map((tick) => yFormat(tick).length * 7 + 4))
  const xLabels = axisLabels(slots, step, xAxis, xStride, { xFormat, timeZone, locale })
  const bridged = lines.some((line) => bridges(line.values, isDefined).length > 0)
  const legend = showLegend ?? series.length > 1

  const pick = (clientX: number): number | null => {
    const area = areaRef.current
    if (!area || slots.length === 0) return null
    const box = area.getBoundingClientRect()
    const at = box.width > 0 ? (clientX - box.left) / box.width : 0.5
    let nearest = 0
    for (const [index, slot] of slots.entries()) {
      if (Math.abs(slot.position - at) < Math.abs(slots[nearest].position - at)) nearest = index
    }
    return nearest
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const last = slots.length - 1
    const moves: Record<string, (current: number | null) => number | null> = {
      ArrowRight: (current) => Math.min(last, current === null ? 0 : current + 1),
      ArrowUp: (current) => Math.min(last, current === null ? 0 : current + 1),
      ArrowLeft: (current) => Math.max(0, current === null ? last : current - 1),
      ArrowDown: (current) => Math.max(0, current === null ? last : current - 1),
      Home: () => 0,
      End: () => last,
      Escape: () => null,
    }
    const move = moves[event.key]
    if (!move || last < 0) return
    event.preventDefault()
    setActive(move)
  }

  useLayoutEffect(() => {
    const root = rootRef.current
    const area = areaRef.current
    const tooltip = tooltipRef.current
    if (active === null || !root || !area || !tooltip) return
    const box = area.getBoundingClientRect()
    const values = lines.map((line) => line.values[active]).filter(isDefined)
    const top = values.length > 0 ? Math.min(...values.map(toFraction)) : 0.5
    positionTooltip(root, tooltip, {
      x: box.left + slots[active].position * box.width,
      y: box.top + top * box.height,
    })
  })

  if ((!bounds || plotted.length === 0) && !isLoading) {
    return (
      <div class={className}>
        {title ? <h3 class="mb-2 text-sm font-medium">{title}</h3> : null}
        <p class="text-sm" style={{ color: textColor }}>{emptyLabel}</p>
      </div>
    )
  }

  const activeSlot = active === null ? undefined : slots[active]

  return (
    <div
      ref={rootRef}
      class={join("relative flex flex-col gap-2", CHART_PALETTE_CLASS, className)}
      data-chart="line"
      aria-busy={isLoading ? "true" : undefined}
    >
      {title ? <h3 class="text-sm font-medium">{title}</h3> : null}
      <div class="flex gap-2 pt-2">
        <div
          class="relative shrink-0 text-xs"
          style={{ width: `${gutter}px`, height: `${height}px`, color: textColor }}
          aria-hidden="true"
        >
          {y.ticks.map((tick) => (
            <span
              key={`y-${tick}`}
              class="absolute right-0 -translate-y-1/2 whitespace-nowrap tabular-nums"
              style={{ top: percent(toFraction(tick)) }}
            >
              {yFormat(tick)}
            </span>
          ))}
        </div>
        <div
          class="relative min-w-0 flex-1 rounded-sm outline-offset-2"
          style={{ height: `${height}px`, background: surfaceColor }}
          role="img"
          aria-label={interactive ? `${label}. ${keyboardHint}` : label}
          tabIndex={interactive && slots.length > 0 ? 0 : undefined}
          data-chart-plot=""
          onPointerMove={(event) => setActive(pick(event.clientX))}
          onPointerDown={(event) => setActive(pick(event.clientX))}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setActive(null)
          }}
          onFocus={() => setActive((current) => current ?? 0)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          {y.ticks.map((tick) => (
            <div
              key={`grid-${tick}`}
              class="absolute inset-x-0 border-t border-dashed"
              style={{ top: percent(toFraction(tick)), borderColor: gridColor }}
            />
          ))}
          <div class="absolute inset-x-0 bottom-0 border-t" style={{ borderColor: axisColor }} />
          <div ref={areaRef} class="absolute inset-y-0 inset-x-3">
            {hasReference
              ? (
                <div
                  class="absolute -inset-x-3 border-t-2 border-dashed"
                  style={{
                    top: percent(toFraction(referenceValue as number)),
                    borderColor: referenceColor ?? textColor,
                  }}
                  data-chart-reference=""
                >
                  {referenceLabel
                    ? (
                      <span
                        class="absolute right-1 bottom-1 text-xs"
                        style={{ color: textColor }}
                      >
                        {referenceLabel}
                      </span>
                    )
                    : null}
                </div>
              )
              : null}
            <svg
              class="absolute inset-0 size-full overflow-visible"
              viewBox={`0 0 ${SPAN} ${SPAN}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {lines.map((line, lineIndex) => (
                <g key={`line-${lineIndex}`}>
                  {bridges(line.values, isDefined).map(([from, to]) => (
                    <path
                      key={`bridge-${from}`}
                      d={pathOf([from, to], slots, line.values, toFraction)}
                      fill="none"
                      stroke-width="1.5"
                      stroke-dasharray="2 3"
                      vector-effect="non-scaling-stroke"
                      style={{ stroke: textColor }}
                      data-chart-bridge=""
                    />
                  ))}
                  {runs(line.values, isDefined).map((run) => (
                    <path
                      key={`run-${run[0]}`}
                      d={pathOf(run, slots, line.values, toFraction)}
                      fill="none"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-dasharray={line.dashed ? "6 4" : undefined}
                      vector-effect="non-scaling-stroke"
                      style={{ stroke: line.color }}
                    />
                  ))}
                </g>
              ))}
            </svg>
            {lines.map((line, lineIndex) =>
              line.showPoints
                ? line.values.map((value, slotIndex) =>
                  isDefined(value)
                    ? (
                      <span
                        key={`dot-${lineIndex}-${slotIndex}`}
                        class={join(
                          "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                          interactive && "pointer-events-none",
                        )}
                        style={{
                          left: percent(slots[slotIndex].position),
                          top: percent(toFraction(value)),
                          background: line.color,
                        }}
                        title={`${line.name} ${slots[slotIndex].label}: ${yFormat(value)}`}
                      />
                    )
                    : null
                )
                : null
            )}
            {activeSlot
              ? (
                <>
                  <div
                    class="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2"
                    style={{ left: percent(activeSlot.position), background: textColor }}
                    data-chart-crosshair=""
                  />
                  {lines.map((line, lineIndex) => {
                    const value = line.values[active as number]
                    return isDefined(value)
                      ? (
                        <span
                          key={`active-${lineIndex}`}
                          class="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                          style={{
                            left: percent(activeSlot.position),
                            top: percent(toFraction(value)),
                            borderColor: line.color,
                            background: surfaceColor,
                          }}
                        />
                      )
                      : null
                  })}
                </>
              )
              : null}
          </div>
          {isLoading
            ? (
              <div
                class="absolute inset-0 flex items-center justify-center text-sm"
                style={{ background: surfaceColor, color: textColor }}
              >
                {loadingLabel}
              </div>
            )
            : null}
        </div>
      </div>
      <div class="flex gap-2" aria-hidden="true">
        <div class="shrink-0" style={{ width: `${gutter}px` }} />
        <div class="relative h-4 min-w-0 flex-1 text-xs" style={{ color: textColor }}>
          <div class="absolute inset-y-0 inset-x-3">
            {xLabels.map((tick) => (
              <span
                key={`x-${tick.position}`}
                class={join(
                  "absolute top-0 whitespace-nowrap",
                  tick.position < 0.05
                    ? undefined
                    : tick.position > 0.95
                    ? "-translate-x-full"
                    : "-translate-x-1/2",
                )}
                style={{ left: percent(tick.position) }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {legend || bridged
        ? (
          <div class="flex flex-wrap gap-4 text-xs" style={{ color: textColor }}>
            {legend
              ? lines.map((line, lineIndex) => (
                <span key={`legend-${lineIndex}`} class="inline-flex items-center gap-1">
                  <span
                    class={join("inline-block w-3 border-t-2", line.dashed && "border-dashed")}
                    style={{ borderColor: line.color }}
                  />
                  {line.name}
                </span>
              ))
              : null}
            {bridged
              ? (
                <span class="inline-flex items-center gap-1">
                  <span
                    class="inline-block w-4 border-t-2 border-dashed"
                    style={{ borderColor: textColor }}
                  />
                  {missingValuesLabel}
                </span>
              )
              : null}
          </div>
        )
        : null}
      <div
        ref={tooltipRef}
        class={join(
          "pointer-events-none absolute top-0 left-0 z-10 flex max-w-64 flex-col gap-1 rounded-md border px-2 py-1 text-xs shadow-sm",
          activeSlot === undefined && "invisible",
        )}
        style={{ background: surfaceColor, borderColor: axisColor, color: TOOLTIP_TEXT_COLOR }}
        role="status"
        data-chart-tooltip=""
      >
        {activeSlot
          ? (
            <>
              <strong class="font-medium">{activeSlot.label}</strong>
              {lines.map((line, lineIndex) => {
                const value = line.values[active as number]
                return (
                  <span key={`row-${lineIndex}`} class="flex items-center gap-2">
                    <span class="size-2 shrink-0 rounded-full" style={{ background: line.color }} />
                    <span class="flex-1">{line.name}</span>
                    <span class="tabular-nums">{isDefined(value) ? yFormat(value) : "–"}</span>
                  </span>
                )
              })}
            </>
          )
          : null}
      </div>
    </div>
  )
}

/** At most two decimals, and none on a whole number: `12`, `12.5`, `0.33`. */
function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** `a b c`, skipping the parts that are `false` or missing. */
function join(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ")
}

/** A `0…1` fraction as a CSS percentage, rounded so the markup stays stable. */
function percent(fraction: number): string {
  return `${Math.round(fraction * 10_000) / 100}%`
}

/** How a point's `x` is matched across series: its text, or on a time axis its epoch time. */
function slotKey(x: LineX, xAxis: "category" | "time"): string {
  if (xAxis === "category") return String(x)
  const time = (x instanceof Date ? x : new Date(x)).getTime()
  return Number.isFinite(time) ? String(time) : "NaN"
}

interface FormatContext {
  xFormat?: (x: string | Date) => string
  timeZone?: string
  locale?: string
}

/** Every X position the series use, in axis order, with its tooltip heading. */
function buildSlots(
  series: readonly LineSeries[],
  xAxis: "category" | "time",
  context: FormatContext,
): { slots: Slot[]; step: TimeStep | null } {
  const keys = [...new Set(series.flatMap((entry) => entry.points.map((p) => slotKey(p.x, xAxis))))]
  if (xAxis === "category") {
    const last = Math.max(1, keys.length - 1)
    return {
      step: null,
      slots: keys.map((key, index) => ({
        key,
        position: keys.length === 1 ? 0.5 : index / last,
        label: context.xFormat ? context.xFormat(key) : key,
      })),
    }
  }
  const times = keys.filter((key) => key !== "NaN").map(Number).sort((a, b) => a - b)
  const first = times[0]
  const span = times[times.length - 1] - first
  const { step } = timeTicks(first, times[times.length - 1])
  return {
    step,
    slots: times.map((time) => ({
      key: String(time),
      position: span > 0 ? (time - first) / span : 0.5,
      label: context.xFormat
        ? context.xFormat(new Date(time))
        : formatTimeFull(time, step, context),
    })),
  }
}

/** The labels under the plot: every n-th category, or the time axis's round instants. */
function axisLabels(
  slots: readonly Slot[],
  step: TimeStep | null,
  xAxis: "category" | "time",
  stride: number | undefined,
  context: FormatContext,
): { position: number; label: string }[] {
  if (xAxis === "category" || !step || slots.length === 0) {
    const every = stride && stride >= 1 ? Math.floor(stride) : xLabelStride(slots.length, 6)
    return slots.filter((_, index) => index % every === 0 || index === slots.length - 1)
  }
  const first = Number(slots[0].key)
  const last = Number(slots[slots.length - 1].key)
  if (first === last) return [{ position: 0.5, label: slots[0].label }]
  return timeTicks(first, last).ticks.map((time) => ({
    position: (time - first) / (last - first),
    label: context.xFormat ? context.xFormat(new Date(time)) : formatTimeTick(time, step, context),
  }))
}

/** Index runs of consecutive defined values, broken wherever a value is missing. */
function runs(
  values: readonly (number | null | undefined)[],
  isDefined: (value: number | null | undefined) => value is number,
): number[][] {
  const result: number[][] = []
  let current: number[] = []
  for (const [index, value] of values.entries()) {
    if (value === undefined) continue
    if (isDefined(value)) current.push(index)
    else if (current.length > 0) {
      result.push(current)
      current = []
    }
  }
  if (current.length > 0) result.push(current)
  return result
}

/** `[before, after]` index pairs around each stretch of missing values that has data on both sides. */
function bridges(
  values: readonly (number | null | undefined)[],
  isDefined: (value: number | null | undefined) => value is number,
): [number, number][] {
  const all = runs(values, isDefined)
  return all.slice(1).map((run, index) => [all[index][all[index].length - 1], run[0]])
}

/** `M x,y L x,y …` in the SVG's 0…1000 user space; one decimal keeps the markup stable. */
function pathOf(
  indexes: readonly number[],
  slots: readonly Slot[],
  values: readonly (number | null | undefined)[],
  toFraction: (value: number) => number,
): string {
  const commands = indexes.map((index, order) => {
    const x = (slots[index].position * SPAN).toFixed(1)
    const y = (toFraction(values[index] as number) * SPAN).toFixed(1)
    return `${order === 0 ? "M" : "L"}${x},${y}`
  })
  // A lone point still needs a visible mark, so it becomes a zero-length segment with round caps.
  if (commands.length === 1) commands.push(commands[0].replace("M", "L"))
  return commands.join(" ")
}

/**
 * Explicit domain when the caller gave one, otherwise a padded and rounded-outward one.
 *
 * An explicit domain is honoured exactly — two panels can share one axis — but it still gets ticks,
 * and a single-value domain is widened so it cannot divide by zero.
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
