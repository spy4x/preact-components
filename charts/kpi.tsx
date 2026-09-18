import type { ComponentChildren, JSX } from "preact"

/** Colour role of a {@link Kpi} value. */
export type KpiTone = "accent" | "positive" | "warning" | "negative" | "neutral"

export interface KpiProps {
  label: string
  value: string | number
  /** Secondary line under the value. */
  sub?: string
  /** Defaults to `"accent"`. */
  tone?: KpiTone
  class?: string
}

export interface KpiGridProps {
  /** {@link Kpi} cards, or anything else that belongs in the grid. */
  children: ComponentChildren
  /** Minimum column width. Defaults to `"10rem"`. */
  minWidth?: string
  class?: string
}

const toneClasses: Record<KpiTone, string> = {
  accent: "text-purple-900 dark:text-purple-300",
  positive: "text-green-700 dark:text-green-400",
  warning: "text-orange-600 dark:text-orange-400",
  negative: "text-red-600 dark:text-red-400",
  neutral: "text-gray-700 dark:text-gray-200",
}

/**
 * Key-performance-indicator card: label, value, optional caption.
 *
 * Values use tabular figures, so a column of cards does not jitter as the numbers change. Tones map
 * to intent rather than to the source's `good`/`warn`/`bad` vocabulary, which did not say what
 * "good" was good for.
 */
export function Kpi(
  { label, value, sub, tone = "accent", class: className }: KpiProps,
): JSX.Element {
  return (
    <div
      class={[
        "flex flex-col gap-1 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-800",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div class="text-xs tracking-wide uppercase text-gray-500 dark:text-gray-400">{label}</div>
      <div class={`text-2xl font-bold tabular-nums ${toneClasses[tone]}`}>{value}</div>
      {sub ? <div class="text-xs text-gray-500 dark:text-gray-400">{sub}</div> : null}
    </div>
  )
}

/**
 * Responsive grid for {@link Kpi} cards: two columns on a phone, as many as fit on a desktop.
 *
 * The column template is an inline style because the minimum width is a prop; a Tailwind class
 * could not vary with it.
 */
export function KpiGrid(
  { children, minWidth = "10rem", class: className }: KpiGridProps,
): JSX.Element {
  return (
    <div
      class={className ? `grid gap-3 ${className}` : "grid gap-3"}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))` }}
    >
      {children}
    </div>
  )
}
