import type { JSX } from "preact"
import { join } from "@spy4x/preact-cn/join"
import { useLabels } from "@spy4x/preact-ui/i18n"
import { barTop, barTotal, barTrack } from "./bar-parts.tsx"
import type { BarDatum } from "./bars.tsx"
import { CHART_PALETTE_CLASS, DEFAULT_TEXT_COLOR, DEFAULT_TRACK_COLOR } from "./colors.ts"

/** One row of {@link RankedBars}: a `Bars` row with more numbers, and a link or a button. */
export interface RankedBarRow extends BarDatum {
  /** The numbers of the `columns`' `extra` columns, in their order; `null` prints "–". */
  values?: readonly (number | null)[]
  /** Makes the label a button that calls this, when the row has no `href`. */
  onSelect?: () => void
  /** Draws the row muted, its bar fainter: a sample too thin to judge. */
  lowSample?: boolean
  /** A 40 px thumbnail before the label, such as an item's photo; lazy-loaded. */
  image?: RankedBarImage
  /** A muted line under the label, such as `"mostly Zalo A"`. */
  note?: string
}

/** The thumbnail of a {@link RankedBarRow}. */
export interface RankedBarImage {
  src: string
  /** Its text alternative; `""` when the label already says what the picture shows. */
  alt: string
}

/** One more number column of a {@link RankedBars} table. */
export interface RankedBarColumn {
  /** The column's header, which also names its number on a phone's second line. */
  label: string
  /** Formats the column's numbers. Defaults to `String(value)`. */
  format?: (value: number) => string
}

/**
 * The columns of a {@link RankedBars} table: the label's and the bar's own number, each with a
 * header, and one to three more numbers per row.
 */
export interface RankedBarColumns {
  /** The label column's header, such as `"Source"`. */
  label: string
  /** The header of the bar's own number, such as `"Visits"`. */
  value: string
  /** One to three more columns, each filled from the rows' `values` at its index. */
  extra:
    | readonly [RankedBarColumn]
    | readonly [RankedBarColumn, RankedBarColumn]
    | readonly [
      RankedBarColumn,
      RankedBarColumn,
      RankedBarColumn,
    ]
}

export interface RankedBarsProps {
  /** The rows, in the order the caller ranked them. */
  data: readonly RankedBarRow[]
  columns: RankedBarColumns
  /** Formats the bar's own number. Defaults to `String(value)`. */
  format?: (value: number) => string
  /** Bar colours, by rank. Defaults to the shared chart palette. */
  colors?: readonly string[]
  trackColor?: string
  /** The headers', the muted rows' and the phone line's colour. */
  textColor?: string
  title?: string
  /** The title's heading level, so it fits the page's outline. Defaults to `3`. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** Overrides the accessible table name. Defaults to `title`. */
  ariaLabel?: string
  /** Shown in place of the table when there are no rows; `Bars`' label, `"No data"`. */
  emptyLabel?: string
  /** Added after the chart's own classes with `join`; mark yours important to replace one. */
  class?: string
}

/** What a {@link RankedBars} table prints for a number it does not have. */
const MISSING = "–"

/** A number as `format` prints it, or {@link MISSING} for a missing or non-finite one. */
function printed(value: number | null | undefined, format: (value: number) => string): string {
  return value === null || value === undefined || !Number.isFinite(value) ? MISSING : format(value)
}

/**
 * The stretched hit area of a row's link or button: its `::after` covers the whole row, which is
 * `relative`, and draws the focus ring around it.
 */
const rowControl =
  "cursor-pointer text-start outline-hidden after:absolute after:inset-0 after:rounded-sm hover:underline focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus"

/** A number cell: right-aligned in tabular figures, level with the label's first line. */
const numberCell = "py-2 ps-3 text-end align-top tabular-nums whitespace-nowrap"

/**
 * A ranked list with several numbers per row, such as visits per source: `Bars`' scale and bars in
 * a table with a header row, server-rendered like `Bars`.
 *
 * Per row: an optional 40 px `image`, then the label (a link with `href`, a button with `onSelect`,
 * either covering the whole row with its hit area and focus ring; a button needs JavaScript), an
 * optional muted `note` under it and the bar, then the bar's number and one to three more from the
 * row's `values`, right-aligned in tabular figures. A missing or non-finite number prints "–". A
 * `lowSample` row is drawn in the muted text colour with a fainter bar.
 *
 * Below `sm` the extra columns leave the table and their numbers join the note's muted line under
 * the label, each after its column's header ("Views 210 · mostly Zalo A"), so a phone shows two
 * columns and nothing scrolls sideways. That line is the numbers' only copy at that width, so a
 * screen reader hears it with the label. The table and its header row are transparent, as `Bars`'
 * table is: a dark `theme-base` page fills every `<table>` and `<thead>`.
 */
export function RankedBars({
  data,
  columns,
  format = (value: number) => String(value),
  colors,
  trackColor = DEFAULT_TRACK_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  title,
  headingLevel = 3,
  ariaLabel,
  emptyLabel: emptyLabelProp,
  class: className,
}: RankedBarsProps): JSX.Element {
  const { emptyLabel } = useLabels("Bars", { emptyLabel: "No data" }, {
    emptyLabel: emptyLabelProp,
  })
  const Heading = `h${headingLevel}` as "h3"
  const heading = title ? <Heading class="text-sm font-medium">{title}</Heading> : null
  if (data.length === 0) {
    return (
      <div class={join("flex flex-col gap-2", className)}>
        {heading}
        <p class="text-sm" style={{ color: textColor }}>{emptyLabel}</p>
      </div>
    )
  }

  const top = barTop(data)
  const header = "pb-1 ps-3 text-end align-bottom font-medium"
  return (
    <div class={join("flex flex-col gap-2", CHART_PALETTE_CLASS, className)}>
      {heading}
      <table class="w-full bg-transparent text-sm" aria-label={ariaLabel ?? title}>
        <thead class="bg-transparent">
          <tr class="text-xs" style={{ color: textColor }}>
            <th scope="col" class="pb-1 text-start align-bottom font-medium">{columns.label}</th>
            <th scope="col" class={header}>{columns.value}</th>
            {columns.extra.map((column, at) => (
              <th key={at} scope="col" class={join(header, "max-sm:hidden")}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const values = columns.extra.map((column, at) =>
              printed(row.values?.[at], column.format ?? String)
            )
            const interactive = row.href !== undefined || row.onSelect !== undefined
            return (
              <tr
                key={`${row.label}-${index}`}
                data-low-sample={row.lowSample ? "true" : undefined}
                class={join(
                  "border-t border-subtle",
                  interactive && "relative hover:bg-hover",
                  !row.lowSample && "text-foreground",
                )}
                style={row.lowSample ? { color: textColor } : undefined}
              >
                <th scope="row" class="py-2 pe-3 text-start align-top font-normal">
                  <div class="flex items-start gap-3">
                    {row.image && (
                      <img
                        src={row.image.src}
                        alt={row.image.alt}
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        class="size-10 shrink-0 rounded-md object-cover"
                      />
                    )}
                    <div class="flex min-w-0 flex-1 flex-col gap-1">
                      <span class="line-clamp-2 wrap-anywhere">
                        {row.href !== undefined
                          ? <a href={row.href} class={rowControl}>{row.label}</a>
                          : row.onSelect
                          ? (
                            <button type="button" class={rowControl} onClick={row.onSelect}>
                              {row.label}
                            </button>
                          )
                          : row.label}
                      </span>
                      <span
                        class={join("text-xs", row.note === undefined && "sm:hidden")}
                        style={{ color: textColor }}
                      >
                        <span class="sm:hidden">
                          {columns.extra.map((column, at) => `${column.label} ${values[at]}`)
                            .join(" · ")}
                          {row.note !== undefined && " · "}
                        </span>
                        {row.note}
                      </span>
                      <span class={join("flex", row.lowSample && "opacity-50")}>
                        {barTrack(row, index, { top, colors, trackColor })}
                      </span>
                    </div>
                  </div>
                </th>
                <td class={numberCell}>{printed(barTotal(row), format)}</td>
                {values.map((text, at) => (
                  <td key={at} class={join(numberCell, "max-sm:hidden")}>
                    {text}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
