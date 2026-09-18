/**
 * Colour defaults shared by every chart.
 *
 * The values are CSS custom-property references with an inline fallback, so a chart picks up the
 * host app's `theme/` tokens when they exist and still renders standalone when they do not. Because
 * of that they are applied through `style` rather than the SVG presentation attributes: `var()`
 * does not resolve inside `fill="…"`, only inside a style declaration.
 *
 * Callers may pass their own array or string for any of these — nothing here is required.
 */

/** Series colours, in draw order. Consumed through {@link seriesColor}. */
export const DEFAULT_CHART_PALETTE: readonly string[] = [
  "var(--color-primary-muted, oklch(0.558 0.288 302.321))",
  "var(--color-success, oklch(0.527 0.154 150.069))",
  "var(--color-warning, oklch(0.646 0.222 41.116))",
  "var(--color-danger, oklch(0.577 0.245 27.325))",
  "var(--color-primary, oklch(0.38 0.17 293))",
]

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
