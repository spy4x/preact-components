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

export interface BarsProps {
  data: BarDatum[]
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
  class?: string
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

  const top = max ?? data.reduce(
    (largest, datum) => Number.isFinite(datum.value) ? Math.max(largest, datum.value) : largest,
    0,
  )

  return (
    <div class={twMerge("flex flex-col gap-2", CHART_PALETTE_CLASS, className)}>
      {heading}
      <table class="w-full bg-transparent text-sm" aria-label={ariaLabel ?? title}>
        <tbody>
          {data.map((datum, index) => (
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
                  <span
                    class="h-2 flex-1 overflow-hidden rounded-sm"
                    style={{ background: trackColor }}
                  >
                    <span
                      class="block h-full rounded-sm"
                      style={{
                        width: `${barPercent(datum.value, top)}%`,
                        background: datum.color ?? seriesColor(index, colors),
                      }}
                    >
                    </span>
                  </span>
                  <span class="min-w-[4.5rem] text-right tabular-nums" style={{ color: textColor }}>
                    {format(datum.value)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
