/**
 * Colour defaults shared by every chart.
 *
 * The values are CSS custom-property references with an inline fallback, so a chart picks up the
 * host app's tokens when they exist and still renders standalone when they do not. Because of that
 * they are applied through `style` rather than SVG presentation attributes: `var()` does not resolve
 * inside `fill="…"`, only inside a style declaration.
 *
 * Callers may pass their own array or string for any of these — nothing here is required.
 */

/**
 * The five series colours, light and dark, in draw order: blue, orange, green, violet, magenta.
 *
 * Each pair was chosen with a palette validator, not by eye. Every colour reaches 3:1 against its
 * page — white and gray-50 for the light steps; gray-800, gray-900 and the ink palette's card and
 * page for the dark steps — and neighbours in this order stay apart under the common kinds of colour
 * blindness (worst neighbouring pair ΔE 8.9 light, 9.4 dark, on a scale where 8 is the target).
 * The order matters: green next to magenta was the pair colour-blind readers could not tell apart.
 */
const SERIES_STEPS: readonly (readonly [light: string, dark: string])[] = [
  ["#2a78d6", "#3987e5"],
  ["#d95926", "#d95926"],
  ["#15935f", "#199e70"],
  ["#4a3aa7", "#9085e9"],
  ["#c93f75", "#d55181"],
]

/**
 * Classes a chart puts on its root so {@link DEFAULT_CHART_PALETTE} resolves to the light steps, or
 * to the dark ones under a `.dark` ancestor — the theme package's class-based dark mode. Written out
 * literally, rather than built from {@link SERIES_STEPS}, because Tailwind finds classes by reading
 * the source and cannot see one assembled at run time.
 *
 * Only the `./colors` subpath exports it: an app needs it only around chart markup of its own.
 */
export const CHART_PALETTE_CLASS =
  "[--chart-1:#2a78d6] [--chart-2:#d95926] [--chart-3:#15935f] [--chart-4:#4a3aa7] [--chart-5:#c93f75] dark:[--chart-1:#3987e5] dark:[--chart-3:#199e70] dark:[--chart-4:#9085e9] dark:[--chart-5:#d55181]"

/**
 * Series colours, in draw order. Consumed through {@link seriesColor}.
 *
 * An app recolours a slot by setting `--color-chart-1` … `--color-chart-5`, in both of its palettes.
 * Without that, a chart's root sets `--chart-N` ({@link CHART_PALETTE_CLASS}); outside a chart the
 * light step is the last fallback.
 */
export const DEFAULT_CHART_PALETTE: readonly string[] = SERIES_STEPS.map(([light], index) =>
  `var(--color-chart-${index + 1}, var(--chart-${index + 1}, ${light}))`
)

/** Axis and frame line colour. */
export const DEFAULT_AXIS_COLOR = "var(--color-border-control, oklch(0.872 0.01 258.338))"

/** Dashed grid line colour. */
export const DEFAULT_GRID_COLOR = "var(--color-border-subtle, oklch(0.928 0.006 264.531))"

/** Axis label and legend text colour. */
export const DEFAULT_TEXT_COLOR = "var(--color-muted-foreground, oklch(0.551 0.027 264.364))"

/** Panel, tooltip and donut-centre background. */
export const DEFAULT_SURFACE_COLOR = "var(--color-surface, oklch(1 0 0))"

/** Track colour behind a bar or an empty donut ring. */
export const DEFAULT_TRACK_COLOR = "var(--color-canvas, oklch(0.985 0.002 247.839))"

/**
 * Pick a palette entry for a series index, wrapping around and tolerating a negative index.
 *
 * An empty palette falls back to the default one so a caller cannot accidentally render invisible
 * series.
 */
export function seriesColor(
  index: number,
  palette: readonly string[] = DEFAULT_CHART_PALETTE,
): string {
  const colors = palette.length > 0 ? palette : DEFAULT_CHART_PALETTE
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0
  return colors[((safeIndex % colors.length) + colors.length) % colors.length]
}
