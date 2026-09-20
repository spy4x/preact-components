import { cn } from "@preact-components/signals/cn"

/** Semantic colour of the filled portion, mapped onto the `theme/` colour atoms. */
export type ProgressTone = "primary" | "success" | "warning" | "danger"

/** Props every progress bar takes, whether or not it is captioned. */
interface ProgressBaseProps {
  /** Completed amount. `null`, `undefined` or `NaN` make the bar indeterminate. */
  value?: number | null
  /** Amount that counts as complete. Defaults to 100; anything `<= 0` is unmeasurable. */
  max?: number
  /** Render the percentage in the header row. Enabled by default. */
  showValue?: boolean
  /** Colour of the filled portion. Defaults to `"primary"`. */
  tone?: ProgressTone
  class?: string
}

/**
 * A bar with no caption needs no id, and a captioned one cannot go without.
 *
 * ARIA 1.2 requires an accessible name on `role="progressbar"`, so a caption the bar is not linked
 * to is a defect — `aria-progressbar-name` in axe. The two fields are a union rather than two
 * independent optionals, which makes `label` without `id` a compile error: the unnamed combination
 * cannot be written in the first place. The caller still picks the id, which doubles as the bar's
 * DOM id and the prefix of the caption's.
 */
export type ProgressProps =
  & ProgressBaseProps
  & (
    | {
      /** Caption rendered above the bar and linked to it through `aria-labelledby`. */
      label: string
      /** Id of the bar; the caption becomes `${id}-label` and names the bar. */
      id: string
    }
    | {
      label?: undefined
      id?: undefined
    }
  )

const toneClasses: Record<ProgressTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
}

const track = "h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
const fill = "h-full rounded-full transition-[width] duration-300 ease-out"

/**
 * Clamp a progress reading into `0…max` and derive its completion fraction.
 *
 * `max` is the only bound the caller controls, so `max <= 0` has no meaningful range and makes the
 * reading unmeasurable rather than zero. A `NaN` `value` is reported as unmeasurable for the same
 * reason: it is not a number, so no `aria-valuenow` can be honest about it. `-Infinity` clamps to
 * `0` and `Infinity` to `max`, since both are ordered numbers with a definite side.
 *
 * `fraction` is rounded to four decimals so a reading off the decimal grid still serialises short.
 * {@link progressWidthPercent} is what turns the fraction into a value fit for a CSS declaration.
 *
 * @param value Raw reading; may be out of range, `NaN` or ±`Infinity`.
 * @param max Upper bound, exclusive of `0` and below.
 * @returns The clamped reading (or `null`) plus the fraction of `max` it represents (or `null`).
 */
export function clampProgress(
  value: number | null | undefined,
  max = 100,
): { value: number | null; fraction: number | null } {
  if (max <= 0 || !Number.isFinite(max) || value === null || value === undefined) {
    return { value: null, fraction: null }
  }
  if (Number.isNaN(value)) return { value: null, fraction: null }

  const clamped = Math.min(max, Math.max(0, value))
  return { value: clamped, fraction: Math.round((clamped / max) * 10000) / 10000 }
}

/**
 * Turn a completion fraction into the percentage a declaration can take.
 *
 * One decimal place, which is all a progress bar paints: `Math.round(0.42 * 1000) / 10` is `42`,
 * and `<Progress value={1} max={3} />` is `33.3` rather than the `33.300000000000004` that
 * `fraction * 100` produces for `1 / 3`. A `null` fraction is `0`, so an unmeasurable bar is a
 * zero-width fill rather than an absent declaration.
 *
 * @param fraction Completion fraction, `0…1`; clamped here, so a stray value cannot exceed 100.
 * @returns The percentage as a number, safe to interpolate into `width: <n>%`.
 */
export function progressWidthPercent(fraction: number | null): number {
  if (fraction === null || !Number.isFinite(fraction)) return 0

  return Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10
}

/**
 * Format a completion fraction as a whole percentage for display.
 *
 * Rounds **down**: the fill may be a tenth short of the end, so `99.9%` prints `99%`. A bar that
 * says `100%` while it is still filling claims a completion its own `aria-valuenow` contradicts.
 * The glyph is glued to the number: `66%` wraps as one unit, `66 %` does not.
 *
 * @param fraction Completion fraction, `0…1`; clamped, so a stray value cannot print `140%`.
 * @returns The floored integer percentage with a percent sign; a non-finite fraction prints `0%`.
 */
export function formatProgressPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "0%"

  return `${Math.floor(progressWidthPercent(fraction))}%`
}

/**
 * Determinate progress bar, or an indeterminate track when the reading is unknown.
 *
 * The fill width is inline, so the server-rendered markup is already correct and the CSS
 * transition animates later changes — the same reasoning as `ConfidenceMeter`, which is the
 * closest sibling.
 *
 * There is no separate indeterminate variant: no consumer needs one yet, and an animated
 * indeterminate track would need keyframes in `theme/`, which this package does not own. A
 * caller that has no reading yet passes `value={undefined}` (or `NaN`) and gets the track with
 * `aria-valuenow` omitted, which is the honest DOM. Deterministic consumers want a determinate
 * bar, so that is what this renders.
 *
 * @see clampProgress for the out-of-range and unmeasurable cases.
 */
export function Progress({
  value,
  max = 100,
  label,
  showValue = true,
  tone = "primary",
  id,
  class: className,
}: ProgressProps) {
  const { value: clamped, fraction } = clampProgress(value, max)
  // The union above makes these two arrive together or not at all, so the bar is never captioned
  // without a name to point at.
  const labelId = label !== undefined && id !== undefined ? `${id}-label` : undefined
  // An unmeasurable reading is published as ARIA's own implicit `0…100` range, with no
  // `aria-valuenow`: a legal, nameable indeterminate progressbar. ARIA requires `aria-valuemax` to
  // be greater than **or equal to** `aria-valuemin`, so a caller `max` is not normally the range
  // this publishes — `max <= 0` is precisely what makes the reading unmeasurable, and `0` is legal
  // but empty while anything below `0` would sit under `aria-valuemin="0"`, which is not.
  const valuemax = fraction === null ? 100 : max
  // `showValue` defaults on, but a percentage with no reading behind it is noise: keep the header
  // row only when it holds something, instead of an empty flex row that still costs a gap.
  const showHeader = label !== undefined || (showValue && fraction !== null)

  return (
    <div class={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {showHeader && (
        <div class="flex min-w-0 items-baseline justify-between gap-2">
          {label !== undefined && (
            <span id={labelId} class="kpi-label truncate">
              {label}
            </span>
          )}
          {showValue && fraction !== null && (
            <span class="num shrink-0 text-xs font-semibold">
              {formatProgressPercent(fraction)}
            </span>
          )}
        </div>
      )}
      <div
        id={id}
        class={track}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={clamped ?? undefined}
        aria-valuemin={0}
        aria-valuemax={valuemax}
      >
        {fraction !== null && (
          <div
            class={cn(fill, toneClasses[tone])}
            style={{ width: `${progressWidthPercent(fraction)}%` }}
          />
        )}
      </div>
    </div>
  )
}
