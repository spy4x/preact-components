import { join } from "@spy4x/preact-cn/join"
import type { JSX } from "preact"
import { useId } from "preact/hooks"

/** One labelled point under a {@link Slider}'s track, such as "Typical" or "Today". */
export interface SliderMark {
  /** Where the tick sits, in the slider's own units. */
  value: number
  /** The words under the tick. */
  label: string
}

/** Props of {@link Slider}. */
export interface SliderProps {
  /** The visible label, which also names the range input. */
  label: string
  /** The current value. The slider is controlled: it shows this and reports changes. */
  value: number
  /** Lowest value. Defaults to `0`. */
  min?: number
  /** Highest value. Defaults to `100`. */
  max?: number
  /** Step between values. Defaults to `1`. */
  step?: number
  /** Called with the new value on every move, by pointer or keyboard. */
  onInput?: (value: number) => void
  /** How the value prints on the right of the label row. Defaults to `String(value)`. */
  format?: (value: number) => string
  /**
   * What a screen reader announces for a value, as `aria-valuetext`. Defaults to `format`, so set
   * it when the printed value is a symbol a reader would mangle ("2×" read as "2 x").
   */
  valueText?: (value: number) => string
  /** Up to two labelled ticks under the track; more are dropped, since three crowd a phone. */
  marks?: readonly SliderMark[]
  /** One line under the slider, tied to the input with `aria-describedby`. */
  hint?: string
  disabled?: boolean
  /** The input's `id`. Generated when left out; pass one to point a test or a link at it. */
  id?: string
  /** The input's `name`, for a form. */
  name?: string
  class?: string
}

/**
 * Where a value sits along the track, as a fraction from `0` to `1`.
 *
 * A value outside `min…max` is clamped, and a range with no width (`max <= min`) or a non-finite
 * bound puts everything at `0`, so the fill and the marks never take a `NaN` position.
 *
 * @param value The value to place.
 * @param min The track's lowest value.
 * @param max The track's highest value.
 * @returns The fraction of the track, rounded to four decimals.
 */
export function sliderFraction(value: number, min: number, max: number): number {
  if (![value, min, max].every(Number.isFinite) || max <= min) return 0
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)))
  return Math.round(fraction * 10000) / 10000
}

/**
 * The centre of the thumb for a fraction, as a CSS length.
 *
 * The 20 px thumb never leaves the track, so its centre travels from 10 px to 10 px short of the
 * end, not from edge to edge. The fill and the marks use this, so they meet the thumb's centre.
 */
function thumbCentre(fraction: number): string {
  return `calc(0.625rem + (100% - 1.25rem) * ${fraction})`
}

/*
 * The input is the whole 44 px tall hit area; the browser draws a 4 px track and a 20 px thumb
 * inside it. The track is `--color-track` filled up to the thumb in the secondary text colour,
 * through `--pc-slider-fill`, which the input's own style sets. The thumb carries the house focus
 * ring, 2 px with a 2 px gap, because the input's own box is much larger than what a person
 * sees. No transition: the thumb follows the pointer exactly. Chromium and Safari read the
 * `-webkit-` pseudo-elements, Firefox the `-moz-` ones; every class is written out whole, so
 * Tailwind's scanner finds it.
 */
const input = [
  "block h-11 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-hidden",
  "disabled:cursor-not-allowed",
  "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full",
  "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-muted-foreground,oklch(0.446_0.03_256.802))_var(--pc-slider-fill),var(--color-track,oklch(0.928_0.006_264.531))_var(--pc-slider-fill))]",
  "[&:dir(rtl)]:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,var(--color-muted-foreground,oklch(0.446_0.03_256.802))_var(--pc-slider-fill),var(--color-track,oklch(0.928_0.006_264.531))_var(--pc-slider-fill))]",
  "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full",
  "[&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-muted-foreground,oklch(0.446_0.03_256.802))_var(--pc-slider-fill),var(--color-track,oklch(0.928_0.006_264.531))_var(--pc-slider-fill))]",
  "[&:dir(rtl)]:[&::-moz-range-track]:bg-[linear-gradient(to_left,var(--color-muted-foreground,oklch(0.446_0.03_256.802))_var(--pc-slider-fill),var(--color-track,oklch(0.928_0.006_264.531))_var(--pc-slider-fill))]",
  "[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-foreground",
  "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-foreground",
  "focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-focus focus-visible:[&::-webkit-slider-thumb]:ring-offset-2 focus-visible:[&::-webkit-slider-thumb]:ring-offset-focus",
  "focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-focus focus-visible:[&::-moz-range-thumb]:ring-offset-2 focus-visible:[&::-moz-range-thumb]:ring-offset-focus",
].join(" ")

/**
 * A labelled range slider on the native `<input type="range">`.
 *
 * The browser owns the semantics and the keyboard: arrows move one `step`, Page Up and Page Down a
 * larger jump, Home and End the ends. The label row prints the label on the left and the formatted
 * value on the right in tabular figures; the value is hidden from screen readers there because the
 * input already announces it as `aria-valuetext`. Up to two `marks` sit under the track, each label
 * wrapping under its tick on a narrow screen. `disabled` dims the track and thumb and mutes the
 * label and value, which keep their 4.5:1 contrast; a slider disabled by a surrounding
 * `<fieldset disabled>` (as `Explorable` does before hydration) keeps its look. Server-rendered
 * complete: the fill is an inline custom property, correct before any script runs. Classes are
 * joined with `join`, not `cn`, so a hydrating island carries no tailwind-merge; a caller's `class`
 * is added to the wrapper's own, not merged over it.
 *
 * @param props The value, its range and the words, see {@link SliderProps}.
 * @returns The label row, the input, the marks and the hint.
 */
export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onInput,
  format = (current: number) => String(current),
  valueText,
  marks = [],
  hint,
  disabled,
  id,
  name,
  class: className,
}: SliderProps): JSX.Element {
  const generated = useId()
  const inputId = id ?? `slider-${generated}`
  const shownMarks = marks.slice(0, 2)
  const marksId = shownMarks.length > 0 ? `${inputId}-marks` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined
  const describedBy = [marksId, hintId].filter(Boolean).join(" ") || undefined
  const fill = thumbCentre(sliderFraction(value, min, max))

  return (
    <div class={join("flex min-w-0 flex-col", className)}>
      <div class="flex items-baseline justify-between gap-3">
        <label
          for={inputId}
          class={disabled ? "inline-flex text-sm font-medium text-muted" : "pc-label"}
        >
          {label}
        </label>
        <span
          aria-hidden="true"
          class={join(
            "pc-num shrink-0 text-sm font-medium",
            disabled ? "text-muted" : "text-foreground",
          )}
        >
          {format(value)}
        </span>
      </div>
      <input
        id={inputId}
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={(valueText ?? format)(value)}
        aria-describedby={describedBy}
        class={join(input, disabled && "opacity-50")}
        style={{ "--pc-slider-fill": fill }}
        onInput={(event) => onInput?.(Number(event.currentTarget.value))}
      />
      {marksId && (
        <div id={marksId} class="grid text-xs text-muted">
          {shownMarks.map((mark) => (
            <SliderTick key={mark.value} mark={mark} min={min} max={max} />
          ))}
        </div>
      )}
      {hintId && <p id={hintId} class="mt-2 text-sm text-muted">{hint}</p>}
    </div>
  )
}

/**
 * One mark: a tick under the thumb's position and its label below it.
 *
 * Both marks share one grid cell and are shifted along it with `inset-inline-start`, so the row is as tall as the
 * taller label and nothing is measured. A label near an end is aligned to that end instead of
 * centred, so it never spills past the track; elsewhere it is centred on its tick. Each wraps
 * within a third of the width.
 */
function SliderTick(
  { mark, min, max }: { mark: SliderMark; min: number; max: number },
): JSX.Element {
  const fraction = sliderFraction(mark.value, min, max)
  const align = fraction < 0.2 ? "start" : fraction > 0.8 ? "end" : "center"
  return (
    <span
      class={join(
        "relative col-start-1 row-start-1 flex w-1/3 flex-col gap-1",
        align === "start" && "items-start text-start",
        align === "center" &&
          "-translate-x-1/2 [&:dir(rtl)]:translate-x-1/2 items-center text-center",
        align === "end" && "-translate-x-full [&:dir(rtl)]:translate-x-full items-end text-end",
      )}
      style={{ insetInlineStart: thumbCentre(fraction) }}
    >
      <span
        aria-hidden="true"
        class="h-2 w-px bg-[var(--color-border-strong,oklch(0.707_0.022_261.325))]"
      />
      <span>{mark.label}</span>
    </span>
  )
}
