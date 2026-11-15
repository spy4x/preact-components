import { IconMinus, IconTrendingDown, IconTrendingUp } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { twMerge } from "tailwind-merge"

/** Colour role of a {@link Kpi} value. */
export type KpiTone = "accent" | "positive" | "warning" | "negative" | "neutral"

/** Which way a {@link KpiChange} went, drawn as its icon. */
export type KpiDirection = "up" | "down" | "flat"

/** How a {@link Kpi} value moved against an earlier period, as one line of words and an icon. */
export interface KpiChange {
  /** The change in words, such as `"+120 vs previous 30 days"`, from `changeText` or the app. */
  text: string
  direction: KpiDirection
  /**
   * The line's colour. Defaults to `"neutral"`, which is muted: up is not always good, so only the
   * caller can say a change is good or bad.
   */
  tone?: KpiTone
}

export interface KpiProps {
  label: string
  value: string | number
  /** Secondary line under the value. */
  sub?: string
  /**
   * The value's colour, defaulting to `"accent"`. With `change` the value stays the foreground
   * colour and `tone` is not used; the change line takes its own `tone`.
   */
  tone?: KpiTone
  /** A line under the value with a trend icon and the change in words. */
  change?: KpiChange
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
  accent: "text-accent-900 dark:text-accent-300",
  positive: "text-success",
  warning: "text-warning",
  negative: "text-danger",
  neutral: "text-foreground",
}

/** A change line's colours: as the value's, except that a neutral change is muted. */
const changeToneClasses: Record<KpiTone, string> = { ...toneClasses, neutral: "text-muted" }

const changeIcons = { up: IconTrendingUp, down: IconTrendingDown, flat: IconMinus }

/**
 * Key-performance-indicator card: label, value, optional change line and caption.
 *
 * Values use tabular figures, so a column of cards does not jitter as the numbers change. Tones map
 * to intent rather than to the source's `good`/`warn`/`bad` vocabulary, which did not say what
 * "good" was good for.
 *
 * `change` adds a line under the value: an arrow up or down, or a dash when flat, beside the
 * change in words, so the direction never rests on colour alone. Only that line takes a tone; the
 * value is then drawn in the foreground colour, so a red or green number does not shout louder
 * than the words that explain it.
 */
export function Kpi(
  { label, value, sub, tone = "accent", change, class: className }: KpiProps,
): JSX.Element {
  const ChangeIcon = change ? changeIcons[change.direction] : null
  return (
    <div
      class={twMerge(
        "flex flex-col gap-1 rounded-lg border border-subtle px-4 py-3 dark:bg-surface",
        className,
      )}
    >
      <div class="text-xs tracking-wide uppercase text-muted">{label}</div>
      <div
        class={`text-2xl font-bold tabular-nums ${change ? "text-foreground" : toneClasses[tone]}`}
      >
        {value}
      </div>
      {change && ChangeIcon && (
        <div
          class={`flex items-start gap-1 text-xs font-medium tabular-nums ${
            changeToneClasses[change.tone ?? "neutral"]
          }`}
          data-kpi-change={change.direction}
        >
          <ChangeIcon class="size-4 shrink-0" />
          <span>{change.text}</span>
        </div>
      )}
      {sub ? <div class="text-xs text-muted">{sub}</div> : null}
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
      class={twMerge("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))` }}
    >
      {children}
    </div>
  )
}
