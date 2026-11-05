import { cn } from "@spy4x/preact-cn"
import { IconExclamationCircle } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useId } from "preact/hooks"
import { useLabels, useT } from "./i18n.tsx"

/** Where a reading stands against its limit. */
export type UsageMeterState = "under" | "near" | "reached" | "over"

/** Every word {@link UsageMeter} renders or announces. Each state is one whole sentence. */
export interface UsageMeterLabels {
  /** Row 1 under the limit: "€412 of €500, 82%". */
  value: (used: string, limit: string, percent: string) => string
  /** Row 1 over the limit, or with no limit to measure against: "€512 of €500". */
  valueOver: (used: string, limit: string) => string
  /** The state line well under the limit: "€88 left". */
  left: (left: string) => string
  /** The state line close to the limit: "Close to the limit, €18 left". */
  near: (left: string) => string
  /** The state line at exactly the limit. */
  reached: string
  /** The state line past the limit: "€12 over". */
  over: (over: string) => string
  /** What a screen reader hears well under the limit. */
  valueText: (used: string, limit: string, percent: string, left: string) => string
  /** What a screen reader hears close to the limit. */
  valueTextNear: (used: string, limit: string, percent: string, left: string) => string
  /** What a screen reader hears at exactly the limit. */
  valueTextReached: (used: string, limit: string) => string
  /** What a screen reader hears past the limit. */
  valueTextOver: (used: string, limit: string, over: string) => string
}

/** The English words of {@link UsageMeter}, the same as the `UsageMeter.*` keys of `i18n/en.ts`. */
export const usageMeterLabels: UsageMeterLabels = {
  value: (used, limit, percent) => `${used} of ${limit}, ${percent}`,
  valueOver: (used, limit) => `${used} of ${limit}`,
  left: (left) => `${left} left`,
  near: (left) => `Close to the limit, ${left} left`,
  reached: "Limit reached",
  over: (over) => `${over} over`,
  valueText: (used, limit, percent, left) => `${used} of ${limit}, ${percent}, ${left} left`,
  valueTextNear: (used, limit, percent, left) =>
    `${used} of ${limit}, ${percent}, close to the limit, ${left} left`,
  valueTextReached: (used, limit) => `${used} of ${limit}, limit reached`,
  valueTextOver: (used, limit, over) => `${used} of ${limit}, ${over} over`,
}

const PARAMS = {
  value: ["used", "limit", "percent"],
  valueOver: ["used", "limit"],
  left: ["left"],
  near: ["left"],
  over: ["over"],
  valueText: ["used", "limit", "percent", "left"],
  valueTextNear: ["used", "limit", "percent", "left"],
  valueTextReached: ["used", "limit"],
  valueTextOver: ["used", "limit", "over"],
} as const

/** The numbers {@link UsageMeter} draws, worked out from a reading and its limit. */
export interface UsageReading {
  state: UsageMeterState
  /** Whole percent of the limit, rounded down and never below 0; `null` when the limit is 0 or less. */
  percent: number | null
  /** What is left under the limit; 0 at or past it. */
  left: number
  /** How far past the limit; 0 at or under it. */
  over: number
  /** Width of the fill, 0 to 100. */
  fill: number
  /** Where the limit's tick sits over the limit, 10 to 100; `null` when no tick is drawn. */
  tick: number | null
}

/**
 * Work out where `used` stands against `limit`.
 *
 * The percentage rounds down with integer maths, so €499 of €500 is 99%, never 100% beside "€1
 * left". A limit of 0 or less has no percentage and no fill, and any spending is over by the whole
 * amount. A negative `used` (refunds beat spending) is an empty bar. Over the limit the bar is
 * scaled to `used`, so the tick at the limit sits at `limit / used`, never left of 10%.
 *
 * @param used The amount spent, in the caller's unit.
 * @param limit The amount allowed, in the same unit.
 * @param warnAt The whole percent from which the reading is close to the limit.
 */
export function usageReading(used: number, limit: number, warnAt = 80): UsageReading {
  const cap = Math.max(limit, 0)
  const over = Math.max(used - cap, 0)
  const left = Math.max(cap - used, 0)
  if (cap === 0) {
    return { state: used > 0 ? "over" : "reached", percent: null, left, over, fill: 0, tick: null }
  }
  const percent = Math.max(Math.floor((used * 100) / cap), 0)
  if (used > cap) {
    const tick = Math.max(Math.floor((cap * 1000) / used) / 10, 10)
    return { state: "over", percent, left, over, fill: 100, tick }
  }
  const state = used === cap ? "reached" : percent >= warnAt ? "near" : "under"
  const fill = Math.max(Math.floor((used * 1000) / cap) / 10, 0)
  return { state, percent, left, over, fill, tick: null }
}

/** Props of {@link UsageMeter}. */
export interface UsageMeterProps {
  /** The amount spent so far, in the same unit as `limit` (a money amount's smallest unit, bytes). */
  used: number
  /** The amount allowed. */
  limit: number
  /** Turns an amount into the text people read: money, storage or seats. */
  format: (amount: number) => string
  /** What is being measured ("Groceries"). It names the meter, so it is required. */
  label: string
  /** The whole percent of the limit from which the meter warns. Defaults to 80. */
  warnAt?: number
  /** Overrides for the words; a field left out comes from the catalog or the English default. */
  labels?: Partial<UsageMeterLabels>
  /** Locale of the percentage. Defaults to the translator's language. */
  locale?: string
  class?: string
}

const FILL: Record<UsageMeterState, string> = {
  under: "bg-[var(--color-muted-foreground,oklch(0.446_0.03_256.802))]",
  near: "bg-warning",
  reached: "bg-warning",
  over: "bg-danger",
}

const STATE_TEXT: Record<UsageMeterState, string> = {
  under: "text-muted",
  near: "text-warning",
  reached: "text-warning",
  over: "text-danger",
}

/**
 * How much of a limit is used: a budget's spending, a plan's storage, a team's seats.
 *
 * Three rows that always keep their height: the label with "€412 of €500, 82%", the bar, and a
 * state line ("€88 left", "Close to the limit, €18 left", "Limit reached", "€12 over"). Close to
 * and at the limit the bar turns to the warning colour, past it to danger, rescaled so €12 over and
 * €400 over look different, with a tick where the limit falls.
 *
 * The root is `role="meter"`, named by the label, with `aria-valuetext` the whole sentence; the
 * visible rows are hidden from screen readers, which hear that sentence instead.
 *
 * @see usageReading for the numbers behind each state.
 */
export function UsageMeter({
  used,
  limit,
  format,
  label,
  warnAt = 80,
  labels: labelsProp,
  locale,
  class: className,
}: UsageMeterProps): JSX.Element {
  const words = useLabels("UsageMeter", usageMeterLabels, labelsProp, PARAMS)
  const language = useT().language
  const labelId = useId()
  const reading = usageReading(used, limit, warnAt)
  const { state } = reading
  const usedText = format(used)
  const limitText = format(limit)
  const percentText = reading.percent === null
    ? ""
    : new Intl.NumberFormat(locale ?? language, { style: "percent" }).format(reading.percent / 100)
  const leftText = format(reading.left)
  const overText = format(reading.over)

  const value = state === "over" || reading.percent === null
    ? words.valueOver(usedText, limitText)
    : words.value(usedText, limitText, percentText)
  const stateLine = state === "under"
    ? words.left(leftText)
    : state === "near"
    ? words.near(leftText)
    : state === "reached"
    ? words.reached
    : words.over(overText)
  const valueText = state === "under"
    ? words.valueText(usedText, limitText, percentText, leftText)
    : state === "near"
    ? words.valueTextNear(usedText, limitText, percentText, leftText)
    : state === "reached"
    ? words.valueTextReached(usedText, limitText)
    : words.valueTextOver(usedText, limitText, overText)
  const max = Math.max(limit, 0)

  return (
    <div
      role="meter"
      aria-labelledby={labelId}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(used, 0), max)}
      aria-valuetext={valueText}
      data-state={state}
      class={cn("flex min-w-0 flex-col gap-1", className)}
    >
      <div class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
        <span id={labelId} class="min-w-0 truncate text-sm font-medium">{label}</span>
        <span aria-hidden="true" class="pc-num ms-auto shrink-0 text-xs font-semibold">
          {value}
        </span>
      </div>
      <div
        aria-hidden="true"
        class="relative h-2 w-full overflow-hidden rounded-full bg-track dark:bg-hover"
      >
        {reading.fill > 0 && (
          <div
            class={cn(
              "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out",
              FILL[state],
            )}
            style={{ width: `${reading.fill}%` }}
          />
        )}
        {reading.tick !== null && (
          <div
            data-limit-tick=""
            class="absolute inset-y-0 w-0.5 bg-foreground"
            style={{ insetInlineStart: `${reading.tick}%` }}
          />
        )}
      </div>
      <p
        aria-hidden="true"
        class={cn("flex min-w-0 items-center gap-1 text-xs", STATE_TEXT[state])}
      >
        {state !== "under" && <IconExclamationCircle class="size-4" />}
        <span class="min-w-0">{stateLine}</span>
      </p>
    </div>
  )
}
