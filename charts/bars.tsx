import type { JSX } from "preact"
import { twMerge } from "tailwind-merge"
import {
  CHART_PALETTE_CLASS,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TRACK_COLOR,
  seriesColor,
} from "./colors.ts"

export interface BarDatum {
  label: string
  value: number
  /** Wraps the label in a link. */
  href?: string
  /** Adds `data-low-sample="true"`, so a stylesheet can dim a thin sample. */
  lowSample?: boolean
  /** Overrides the rank colour. */
  color?: string
}

/** One part of a stacked bar: how much of the row one series holds. */
export interface BarSegment {
  /** The series' name, shown in the legend and read out with the row. */
  series: string
  value: number
}

/**
 * A row drawn as stacked segments instead of one value: its total is the sum of the segments, and
 * each series keeps one colour across every row.
 */
export interface StackedBarDatum {
  label: string
  segments: readonly BarSegment[]
  /** Wraps the label in a link. */
  href?: string
  /** Adds `data-low-sample="true"`, so a stylesheet can dim a thin sample. */
  lowSample?: boolean
}

/** A dashed line across every bar at one value, such as a target or an average. */
export interface BarReference {
  value: number
  /** What the line means, printed in the legend with its value. */
  label: string
}

export interface BarsProps {
  /** The rows, each a single value or stacked `segments`. */
  data: readonly (BarDatum | StackedBarDatum)[]
  /** Fixes the 100% mark instead of using the largest value — for comparing two lists. */
  max?: number
  /** Formats the trailing numeric column. Defaults to `String(value)`. */
  format?: (value: number) => string
  /** Label column width. Defaults to `"8rem"`. */
  labelWidth?: string
  /** Bar colours, by rank. Defaults to the shared chart palette. */
  colors?: readonly string[]
  trackColor?: string
  textColor?: string
  title?: string
  /** The title's heading level, so it fits the page's outline. Defaults to `3`. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** Overrides the accessible table name. Defaults to `title`. */
  ariaLabel?: string
  emptyLabel?: string
  /** A dashed line at one value, named in the legend. The scale grows to keep it inside. */
  reference?: BarReference
  class?: string
}

/** Whether a row is drawn as stacked segments. */
function isStacked(datum: BarDatum | StackedBarDatum): datum is StackedBarDatum {
  return "segments" in datum && Array.isArray(datum.segments)
}

/**
 * A row's total: its value, or the sum of its segments' finite, positive values.
 *
 * A negative or non-finite segment adds nothing, as it would draw nothing.
 */
export function barTotal(datum: BarDatum | StackedBarDatum): number {
  if (!isStacked(datum)) return datum.value
  return datum.segments.reduce(
    (sum, segment) =>
      Number.isFinite(segment.value) && segment.value > 0 ? sum + segment.value : sum,
    0,
  )
}

/**
 * Percentage of the longest bar, clamped to `[0, 100]`.
 *
 * Non-finite values, negatives and a non-positive maximum all collapse to `0`, so a dirty dataset
 * renders an empty bar instead of a `NaN%` width or a bar wider than its track.
 */
export function barPercent(value: number, top: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(top) || top <= 0) return 0
  const percent = (value / top) * 100
  if (!Number.isFinite(percent)) return 0
  return Math.round(Math.min(100, Math.max(0, percent)) * 100) / 100
}

/**
 * Server-rendered horizontal bar list — the "Top N" chart.
 *
 * HTML rather than SVG, so the labels wrap, the links stay links and the whole list reflows on a
 * narrow screen with no JavaScript at all. Bars are coloured by rank unless a datum sets its own
 * colour. The title is the same heading with data or without, and names the table.
 *
 * The root is a wrapper `<div>` holding the heading and the table, and `class` goes on that wrapper,
 * not on the `<table>` (8.8.0 and earlier put it on the table), so table-only utilities such as
 * `table-fixed` no longer reach it. The table is always `bg-transparent`: a dark `theme-base` page gives every
 * table the surface colour, which would box the chart in whatever card holds it. A background passed
 * in `class` lands on the wrapper, behind the table, so it still shows.
 *
 * A row with `segments` is a stacked bar: each series keeps one colour across the rows, in order of
 * first appearance, and the legend under the table names every series in words, so colour never
 * carries the meaning alone. A screen reader hears each segment after the row's total. `reference`
 * draws a dashed line at one value across every bar, named in the same legend. A list with neither
 * renders exactly as before.
 */
export function Bars({
  data,
  max,
  format = (value: number) => String(value),
  labelWidth = "8rem",
  colors,
  trackColor = DEFAULT_TRACK_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  title,
  headingLevel = 3,
  ariaLabel,
  emptyLabel = "No data",
  reference,
  class: className,
}: BarsProps): JSX.Element {
  const Heading = `h${headingLevel}` as "h3"
  const heading = title ? <Heading class="text-sm font-medium">{title}</Heading> : null
  if (data.length === 0) {
    return (
      <div class={twMerge("flex flex-col gap-2", className)}>
        {heading}
        <p class="text-sm" style={{ color: textColor }}>{emptyLabel}</p>
      </div>
    )
  }

  const largest = data.reduce((most, datum) => {
    const total = barTotal(datum)
    return Number.isFinite(total) ? Math.max(most, total) : most
  }, 0)
  const top = max ??
    (reference && Number.isFinite(reference.value) ? Math.max(largest, reference.value) : largest)
  const series = [
    ...new Set(
      data.flatMap((datum) => isStacked(datum) ? datum.segments.map((s) => s.series) : []),
    ),
  ]
  const colorOf = (name: string) => seriesColor(series.indexOf(name), colors)

  return (
    <div class={twMerge("flex flex-col gap-2", CHART_PALETTE_CLASS, className)}>
      {heading}
      <table class="w-full bg-transparent text-sm" aria-label={ariaLabel ?? title}>
        <tbody>
          {data.map((datum, index) => {
            const stacked = isStacked(datum)
            const total = barTotal(datum)
            const bar = (
              <span
                class="h-2 flex-1 overflow-hidden rounded-sm"
                style={{ background: trackColor }}
              >
                {stacked
                  ? (
                    <span class="flex h-full" style={{ width: `${barPercent(total, top)}%` }}>
                      {datum.segments.map((segment) => (
                        <span
                          key={segment.series}
                          data-series={segment.series}
                          class="block h-full"
                          style={{
                            width: `${barPercent(segment.value, total)}%`,
                            background: colorOf(segment.series),
                          }}
                        />
                      ))}
                    </span>
                  )
                  : (
                    <span
                      class="block h-full rounded-sm"
                      style={{
                        width: `${barPercent(datum.value, top)}%`,
                        background: datum.color ?? seriesColor(index, colors),
                      }}
                    >
                    </span>
                  )}
              </span>
            )
            return (
              <tr
                key={`${datum.label}-${index}`}
                data-low-sample={datum.lowSample ? "true" : undefined}
              >
                <th scope="row" class="py-1 pr-3 font-normal" style={{ width: labelWidth }}>
                  {datum.href
                    ? (
                      <a href={datum.href} class="hover:underline" style={{ color: textColor }}>
                        {datum.label}
                      </a>
                    )
                    : datum.label}
                </th>
                <td class="w-full py-1">
                  <div class="flex items-center justify-end gap-2">
                    {reference
                      ? (
                        <span class="relative flex flex-1 items-center self-stretch">
                          {bar}
                          <span
                            aria-hidden="true"
                            data-bars-reference
                            class="absolute -inset-y-1 border-l-2 border-dashed"
                            style={{
                              left: `${barPercent(reference.value, top)}%`,
                              borderColor: textColor,
                            }}
                          />
                        </span>
                      )
                      : bar}
                    <span
                      class="min-w-[4.5rem] text-right tabular-nums"
                      style={{ color: textColor }}
                    >
                      {format(total)}
                      {stacked && (
                        <span class="sr-only">
                          {` (${
                            datum.segments.map((segment) =>
                              `${segment.series}: ${format(segment.value)}`
                            ).join(", ")
                          })`}
                        </span>
                      )}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {(series.length > 0 || reference) && (
        <ul
          role="list"
          class="flex flex-wrap gap-x-4 gap-y-1 text-xs"
          style={{ color: textColor }}
          data-bars-legend
        >
          {series.map((name) => (
            <li key={name} class="flex items-center gap-2">
              <span
                aria-hidden="true"
                class="size-3 rounded-sm"
                style={{ background: colorOf(name) }}
              />
              {name}
            </li>
          ))}
          {reference && (
            <li class="flex items-center gap-2">
              <span
                aria-hidden="true"
                class="h-4 border-l-2 border-dashed"
                style={{ borderColor: textColor }}
              />
              {`${reference.label}: ${format(reference.value)}`}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
