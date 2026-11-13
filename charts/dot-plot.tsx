import type { JSX } from "preact"
import { join } from "@spy4x/preact-cn/join"
import { useLabels } from "@spy4x/preact-ui/i18n"

/** One row of a {@link DotPlot}: a label, a value and the words around it. */
export interface DotPlotRow {
  /** Stable key for the row. */
  id: string
  /** The row's name, on the left. */
  label: string
  /** The value the dot marks. `null` draws no dot and prints `missingLabel`. */
  value: number | null
  /** A short line under the label, such as a range or a source. */
  detail?: string
  /** Draws a hollow dot, for a value to read with care; say why in `note`. */
  muted?: boolean
  /** Why the row is muted, printed under the label. */
  note?: string
}

/** A shaded stretch of the scale behind every row, such as "Typical range". */
export interface DotPlotBand {
  /** Where the band starts, in the plot's units. */
  from: number
  /** Where it ends. */
  to: number
  /** What the band means, printed in the legend so the shade never carries meaning alone. */
  label: string
  /** `1` a lighter shade, `2` a darker one. Both reach 3:1 against the card surface. */
  strength: 1 | 2
}

/** Props of {@link DotPlot}. */
export interface DotPlotProps {
  /** The rows, top to bottom. The layout is the same for four rows as for ten. */
  rows: readonly DotPlotRow[]
  /** A total or average row, drawn bolder under a hairline after the others. */
  summary?: DotPlotRow
  /** The ends of the scale, `[low, high]`. Values outside it sit at the nearer end. */
  domain: readonly [number, number]
  /** Draws a rule at zero across every row, when zero lies inside `domain`. */
  zero?: boolean
  /** Shaded stretches behind the dots. */
  bands?: readonly DotPlotBand[]
  /** How a value prints. Defaults to `String(value)`. */
  format?: (value: number) => string
  /** The accessible name of the list. */
  ariaLabel?: string
  /** What a row with no value prints. Defaults to `"No data"`. */
  missingLabel?: string
  /**
   * Added after the chart's own classes, not merged over them (`join`, so an island that renders
   * it carries no tailwind-merge). To replace one of its own, mark yours important: `gap-4!`.
   */
  class?: string
}

/**
 * Where a value sits on a plot's scale, as a percentage from `0` to `100`.
 *
 * A value outside the domain is clamped to the nearer end. A domain with no width, a reversed one
 * or a non-finite number puts everything at `0`, so no dot takes a `NaN%` position.
 *
 * @param value The value to place.
 * @param domain The scale's ends, `[low, high]`.
 * @returns The position, rounded to two decimals.
 */
export function dotPercent(value: number, domain: readonly [number, number]): number {
  const [low, high] = domain
  if (![value, low, high].every(Number.isFinite) || high <= low) return 0
  const percent = Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100))
  return Math.round(percent * 100) / 100
}

/*
 * Every shade is the text colour mixed into the card surface, so it follows any palette an app
 * sets. 45% reaches about 3.4:1 or more against the surface: 3.36:1 in the library's ink palette,
 * 3.67:1 in the dark one and 3.81:1 in the light one. 60% is the darker step. A dot is the text
 * colour with a 2 px ring of the surface, so it stays apart from a band it sits on.
 */
const FOREGROUND = "var(--color-foreground, oklch(0.13 0.028 261.692))"
const SURFACE = "var(--color-surface, oklch(1 0 0))"
const bandColor = (strength: 1 | 2) =>
  `color-mix(in oklab, ${FOREGROUND} ${strength === 2 ? 60 : 45}%, ${SURFACE})`

/**
 * A server-rendered dot plot: one row per item, a dot on a shared scale, and shaded bands.
 *
 * HTML, not SVG: the rows are a list, the labels, details and values are real text, and only the
 * track with its dot and bands is hidden from assistive tech, so a screen reader reads the plot as
 * a list of labelled values. A `muted` row draws a hollow dot and prints its `note`. A band's
 * meaning is in the legend under the rows, beside its swatch. Rows keep one height whatever their
 * number, so four rows and ten look alike.
 *
 * @param props The rows, the scale and the bands, see {@link DotPlotProps}.
 * @returns The list, the scale's ends and the legend.
 */
export function DotPlot({
  rows,
  summary,
  domain,
  zero = false,
  bands = [],
  format = (value: number) => String(value),
  ariaLabel,
  missingLabel: missingLabelProp,
  class: className,
}: DotPlotProps): JSX.Element {
  const { missingLabel } = useLabels("DotPlot", { missingLabel: "No data" }, {
    missingLabel: missingLabelProp,
  })
  const zeroAt = zero && domain[0] < 0 && domain[1] > 0 ? dotPercent(0, domain) : null
  const track = { domain, zeroAt, bands }
  return (
    <div class={join("flex min-w-0 flex-col gap-3 text-sm", className)}>
      <ul role="list" aria-label={ariaLabel} class="flex flex-col">
        {rows.map((row) => (
          <DotPlotItem key={row.id} row={row} format={format} missing={missingLabel} {...track} />
        ))}
        {summary && (
          <DotPlotItem
            row={summary}
            format={format}
            missing={missingLabel}
            summary
            {...track}
          />
        )}
      </ul>
      <div aria-hidden="true" class={`${GRID} text-xs text-muted`}>
        <span />
        <span class="flex justify-between gap-2 tabular-nums">
          <span>{format(domain[0])}</span>
          <span>{format(domain[1])}</span>
        </span>
        <span />
      </div>
      {bands.length > 0 && (
        <ul role="list" class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {bands.map((band) => (
            <li key={`${band.from}-${band.to}`} class="flex items-center gap-2">
              <span
                aria-hidden="true"
                class="h-2 w-4 rounded-sm"
                style={{ background: bandColor(band.strength) }}
              />
              {band.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The three columns every row shares: label, track, value. */
const GRID =
  "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(3.5rem,auto)] gap-x-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(4rem,auto)]"

interface DotPlotItemProps {
  row: DotPlotRow
  format: (value: number) => string
  missing: string
  summary?: boolean
  domain: readonly [number, number]
  zeroAt: number | null
  bands: readonly DotPlotBand[]
}

/** One row: the label and its lines, the track with its dot, and the printed value. */
function DotPlotItem(
  { row, format, missing, summary, domain, zeroAt, bands }: DotPlotItemProps,
): JSX.Element {
  const position = row.value === null ? null : dotPercent(row.value, domain)
  return (
    <li
      class={join(GRID, "items-center", summary ? "mt-1 border-t border-subtle pt-3 pb-2" : "py-2")}
      data-dot-row={summary ? "summary" : "row"}
      data-muted={row.muted ? "true" : undefined}
    >
      <span class="flex min-w-0 flex-col">
        <span class={summary ? "font-semibold text-foreground" : "text-foreground"}>
          {row.label}
        </span>
        {row.detail && <span class="text-xs text-muted">{row.detail}</span>}
        {row.muted && row.note && <span class="text-xs text-muted italic">{row.note}</span>}
      </span>
      <span aria-hidden="true" class="relative h-5">
        <span class="absolute inset-x-0 top-1/2 h-px bg-[var(--color-border-subtle,oklch(0.928_0.006_264.531))]" />
        {bands.map((band) => {
          const from = dotPercent(Math.min(band.from, band.to), domain)
          const to = dotPercent(Math.max(band.from, band.to), domain)
          return (
            <span
              key={`${band.from}-${band.to}`}
              class="absolute top-1/2 h-2 -translate-y-1/2"
              style={{
                left: `${from}%`,
                width: `${to - from}%`,
                background: bandColor(band.strength),
              }}
            />
          )
        })}
        {zeroAt !== null && (
          <span
            class="absolute inset-y-0 w-px bg-[var(--color-border-strong,oklch(0.707_0.022_261.325))]"
            style={{ left: `${zeroAt}%` }}
          />
        )}
        {position !== null && (
          <span
            data-dot
            class={join(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              summary ? "size-4" : "size-3",
            )}
            style={{
              left: `${position}%`,
              background: row.muted ? SURFACE : FOREGROUND,
              borderColor: row.muted ? FOREGROUND : SURFACE,
              boxShadow: row.muted ? `0 0 0 2px ${SURFACE}` : undefined,
            }}
          />
        )}
      </span>
      <span
        class={[
          "text-right tabular-nums",
          summary && "font-semibold",
          row.value === null ? "text-muted" : "text-foreground",
        ].filter(Boolean).join(" ")}
      >
        {row.value === null ? missing : format(row.value)}
      </span>
    </li>
  )
}
