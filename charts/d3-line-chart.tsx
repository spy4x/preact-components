import * as d3 from "d3"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import {
  assertD3Available,
  type D3LineChartColors,
  DEFAULT_D3_LINE_CHART_COLORS,
  yDomainFor,
} from "./d3-line-chart-core.ts"
import type { TimeFrame, TimeSeriesPoint } from "./time-series.ts"

/** The shared vocabulary is defined in `time-series.ts`; this path keeps re-exporting it. */
export { TIME_FRAMES, type TimeFrame, type TimeSeriesPoint } from "./time-series.ts"
/** The d3-free parts live in `d3-line-chart-core.ts`; this path keeps re-exporting them. */
export {
  assertD3Available,
  type D3LineChartColors,
  DEFAULT_D3_LINE_CHART_COLORS,
  MISSING_D3_LINE_ERROR,
  yDomainFor,
} from "./d3-line-chart-core.ts"

export interface D3LineChartProps {
  data: readonly TimeSeriesPoint[]
  timeFrame: TimeFrame
  /** Requested number of Y ticks. */
  ticks?: number
  /** Labels for a categorical (non-numeric) axis; index is the tick position. */
  tickValues?: readonly string[]
  /** Formats a numeric Y tick when `tickValues` is not given. */
  tickFormat?: (value: number) => string
  /** Drop zeroes from the line and draw them as a gap, with a legend note. */
  ignoreZeroes?: boolean
  isLoading?: boolean
  /** Dashed horizontal marker, e.g. a target or a contractual limit. */
  referenceValue?: number
  /** Overrides any subset of {@link DEFAULT_D3_LINE_CHART_COLORS}. */
  colors?: Partial<D3LineChartColors>
  /** Plot height as a fraction of its width. Defaults to `0.6`. */
  aspectRatio?: number
  /** Overrides the time tick format. */
  timeTickFormat?: (date: Date, timeFrame: TimeFrame) => string
  /** Overrides the tooltip body. */
  tooltipFormat?: (point: TimeSeriesPoint) => string
  ariaLabel?: string
  loadingLabel?: string
  missingValuesLabel?: string
  emptyLabel?: string
  class?: string
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 }
const DEFAULT_WIDTH = 628

/**
 * Client-side line chart rendered imperatively with `d3` v7.
 *
 * The interactive counterpart of the zero-JS {@link LineChart}: it re-renders on resize, shows a
 * tooltip and can hide zeroes. Ported from a source application, with two changes — every colour arrives through
 * props (defaults come from `theme/` tokens, never a hardcoded hex), and nothing here reads an
 * application store. Data loading stays with the caller: this component only draws what it is
 * given.
 *
 * Nothing touches the DOM until the effect runs, so the component server-renders as an empty,
 * labelled `svg`. Importing this module at all requires `d3` to resolve; the effect additionally
 * refuses to draw with a `d3` that has no line generator, and says so.
 */
export function D3LineChart({
  data,
  timeFrame,
  ticks,
  tickValues,
  tickFormat,
  ignoreZeroes = false,
  isLoading = false,
  referenceValue,
  colors,
  aspectRatio = 0.6,
  timeTickFormat,
  tooltipFormat,
  ariaLabel,
  loadingLabel = "Loading…",
  missingValuesLabel = "Red line indicates missing values.",
  emptyLabel = "No data",
  class: className,
}: D3LineChartProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const palette = { ...DEFAULT_D3_LINE_CHART_COLORS, ...colors }
  const paletteKey = JSON.stringify(palette)
  const tickValueKey = tickValues?.join("|")

  useEffect(() => {
    const svgElement = svgRef.current
    const wrapperElement = wrapperRef.current
    if (!svgElement || !wrapperElement || data.length === 0) return

    // Fails here with a nameable fix instead of "d3.line is not a function" deep inside `render`.
    assertD3Available(d3)

    const svg = d3.select(svgElement)
    const tooltip = tooltipRef.current

    const render = () => {
      const width = wrapperElement.clientWidth || DEFAULT_WIDTH
      const innerWidth = Math.max(1, width - MARGIN.left - MARGIN.right)
      const aspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 0.6
      const innerHeight = Math.max(1, innerWidth * aspect - MARGIN.top - MARGIN.bottom)

      svg.selectAll("*").remove()
      svg
        .attr(
          "viewBox",
          `0 0 ${innerWidth + MARGIN.left + MARGIN.right} ${
            innerHeight + MARGIN.top + MARGIN.bottom
          }`,
        )
        .attr("width", "100%")
        .attr("height", "100%")

      const points = data.filter((point) => Number.isFinite(point.value))
      const times = points.map((point) => toDate(point.timeGroup))

      const xScale = d3.scaleTime()
        .domain(d3.extent(times) as [Date, Date])
        .range([0, innerWidth])

      const yScale = d3.scaleLinear()
        .domain(yDomainFor(data, { ignoreZeroes, referenceValue }))
        .range([innerHeight, 0])

      const xAxis = d3.axisBottom(xScale)
        .tickFormat((value: Date) => (timeTickFormat ?? formatTimeTick)(value, timeFrame))

      const yAxis = d3.axisLeft(yScale)
      if (ticks !== undefined) yAxis.ticks(ticks)
      if (tickValues) {
        yAxis.tickFormat((value: number) => tickValues[Number(value)] ?? String(value))
      } else if (tickFormat) {
        yAxis.tickFormat((value: number) => tickFormat(Number(value)))
      }

      type Group = d3.Selection<SVGGElement, unknown, null, undefined>

      svg.append("g")
        .attr("transform", `translate(${MARGIN.left}, ${innerHeight + MARGIN.top})`)
        .call(xAxis)
        .call((group: Group) => styleAxis(group, palette))

      svg.append("g")
        .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`)
        .call(yAxis)
        .call((group: Group) => styleAxis(group, palette))

      const line = d3.line<TimeSeriesPoint>()
        .defined((point: TimeSeriesPoint) =>
          ignoreZeroes ? point.value !== 0 : Number.isFinite(point.value)
        )
        .x((point: TimeSeriesPoint) => xScale(toDate(point.timeGroup)))
        .y((point: TimeSeriesPoint) => yScale(point.value))

      const drawPath = (subset: readonly TimeSeriesPoint[], color: string) => {
        svg.append("path")
          .datum([...subset])
          .attr("fill", "none")
          .attr("stroke-width", 1.5)
          .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`)
          .attr("d", line(subset))
          .style("stroke", color)
      }

      drawPath(points, ignoreZeroes ? palette.ignoredLine : palette.line)
      if (ignoreZeroes) {
        drawPath(points.filter((point) => point.value !== 0), palette.line)
      }

      if (referenceValue !== undefined && Number.isFinite(referenceValue)) {
        svg.append("line")
          .attr("x1", MARGIN.left)
          .attr("x2", innerWidth + MARGIN.left)
          .attr("y1", yScale(referenceValue) + MARGIN.top)
          .attr("y2", yScale(referenceValue) + MARGIN.top)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4")
          .style("stroke", palette.reference)
      }

      const visible = points.filter((point) => ignoreZeroes ? point.value !== 0 : true)
      svg.selectAll("circle")
        .data(visible)
        .join("circle")
        .attr("cx", (point: TimeSeriesPoint) => xScale(toDate(point.timeGroup)) + MARGIN.left)
        .attr("cy", (point: TimeSeriesPoint) => yScale(point.value) + MARGIN.top)
        .attr("r", 4)
        .style("fill", palette.point)
        .style("cursor", "pointer")
        .on("mouseover", (event: MouseEvent, point: TimeSeriesPoint) => {
          if (!tooltip) return
          tooltip.textContent = (tooltipFormat ?? defaultTooltipFormat)(point)
          tooltip.style.opacity = "1"
          positionTooltip(tooltip, event, wrapperElement)
        })
        .on("mousemove", (event: MouseEvent) => {
          if (tooltip) positionTooltip(tooltip, event, wrapperElement)
        })
        .on("mouseout", () => {
          if (tooltip) tooltip.style.opacity = "0"
        })
    }

    render()

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(render)
    observer.observe(wrapperElement)
    return () => observer.disconnect()
    // `paletteKey`/`tickValueKey` stand in for the object props, so an inline literal does not
    // re-run the effect on every render.
  }, [
    data,
    timeFrame,
    ticks,
    tickValueKey,
    tickFormat,
    ignoreZeroes,
    referenceValue,
    aspectRatio,
    paletteKey,
    timeTickFormat,
    tooltipFormat,
  ])

  const merged = { ...DEFAULT_D3_LINE_CHART_COLORS, ...colors }

  return (
    <div class={className ? `space-y-1 ${className}` : "space-y-1"}>
      <div ref={wrapperRef} class="relative w-full">
        <svg
          ref={svgRef}
          class="block w-full"
          role="img"
          aria-label={ariaLabel ?? "Line chart"}
          aria-busy={isLoading ? "true" : undefined}
          style={{ background: merged.surface }}
        />
        {data.length === 0 && !isLoading
          ? <p class="py-8 text-center text-sm" style={{ color: merged.text }}>{emptyLabel}</p>
          : null}
        {isLoading
          ? (
            <div
              class="absolute inset-0 flex items-center justify-center text-sm"
              style={{ background: merged.surface, color: merged.text }}
            >
              {loadingLabel}
            </div>
          )
          : null}
        <div
          ref={tooltipRef}
          class="pointer-events-none absolute rounded border px-2 py-1 text-xs whitespace-nowrap opacity-0"
          style={{
            background: merged.tooltipBackground,
            borderColor: merged.tooltipBorder,
            color: merged.tooltipText,
          }}
        />
      </div>

      {ignoreZeroes
        ? (
          <div
            class="flex items-center justify-center gap-2 text-xs"
            style={{ color: merged.text }}
          >
            <span class="inline-block h-1.5 w-5 rounded" style={{ background: merged.line }} />
            {missingValuesLabel}
          </div>
        )
        : null}
    </div>
  )
}

/** `%H:%M` / `%H:00` / `%d.%m`, matching the bucket size being plotted. */
export function formatTimeTick(date: Date, timeFrame: TimeFrame): string {
  if (timeFrame === "minutes") return d3.timeFormat("%H:%M")(date)
  if (timeFrame === "hours") return d3.timeFormat("%H:00")(date)
  return d3.timeFormat("%d.%m")(date)
}

/** Default tooltip body: full timestamp plus the value. */
export function defaultTooltipFormat(point: TimeSeriesPoint): string {
  return `${d3.timeFormat("%d.%m.%Y %H:%M")(toDate(point.timeGroup))} - Value: ${point.value}`
}

/** Parse a bucket timestamp, falling back to the epoch for anything unparseable. */
function toDate(value: string | number | Date): Date {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

/** Axis lines, tick marks and labels, coloured through `style` so `var()` tokens resolve. */
function styleAxis(
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  palette: D3LineChartColors,
): void {
  group.selectAll("path, line").style("stroke", palette.axis)
  group.selectAll("text").style("fill", palette.text).style("font-size", "10px")
}

/** Put the tooltip next to the hovered point, in wrapper coordinates. */
function positionTooltip(tooltip: HTMLElement, event: MouseEvent, wrapper: HTMLElement): void {
  const target = event.currentTarget
  if (!(target instanceof Element)) return

  const wrapperBox = wrapper.getBoundingClientRect()
  const pointBox = target.getBoundingClientRect()
  tooltip.style.left = `${pointBox.left - wrapperBox.left + 10}px`
  tooltip.style.top = `${pointBox.top - wrapperBox.top - 20}px`
}
