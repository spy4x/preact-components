import { cn } from "@spy4x/preact-cn"
import { IconMinus, IconPlus } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { useLabels, useT } from "./i18n.tsx"

/** Every word {@link NumberStepper} shows or announces. */
export interface NumberStepperLabels {
  /** Accessible name of the − button. */
  decrease: string
  /** Accessible name of the + button. */
  increase: string
}

/** The English words of {@link NumberStepper}, the same as the `NumberStepper.*` keys of `i18n/en.ts`. */
export const numberStepperLabels: NumberStepperLabels = {
  decrease: "Decrease",
  increase: "Increase",
}

/** The whole-number range a {@link NumberStepper} moves in, as {@link numberStepperKey} reads it. */
export interface NumberStepperRange {
  min: number
  max: number
  step: number
  largeStep: number
}

/** Props of {@link NumberStepper}. */
export interface NumberStepperProps {
  /** The number on screen. A value outside `min`…`max` is shown clamped, and is not reported. */
  value: number
  /** Called with the next whole number on every change, never with the number already shown. */
  onChange: (next: number) => void
  /** The largest value. */
  max: number
  /** The smallest value. Defaults to `0`. */
  min?: number
  /** What one arrow key or button press adds or takes away. Defaults to `1`. */
  step?: number
  /**
   * What PageUp and PageDown add or take away. Defaults to a tenth of the range, rounded, and at
   * least `step`.
   */
  largeStep?: number
  /** A word shown, and announced, in place of `0`, such as "Off". Unset, `0` reads as a number. */
  zeroLabel?: string
  /** Makes the whole control inert, such as while offline. */
  disabled?: boolean
  /** Locale the number is written in. Defaults to the translator's language. */
  locale?: string
  /** The accessible name. Give it, or `aria-labelledby` to point at a visible label. */
  label?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  labels?: Partial<NumberStepperLabels>
  /** The id of the spinbutton, the element that takes focus. */
  id?: string
  class?: string
}

/** `value` rounded to a whole number and held inside `min`…`max`. */
function clampWhole(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * The value a key press on a {@link NumberStepper} moves `value` to, or `undefined` for a key the
 * stepper leaves alone.
 *
 * ArrowUp and ArrowRight add `step`, ArrowDown and ArrowLeft take it away, with Left and Right
 * swapped when `rtl`; PageUp and PageDown move by `largeStep`; Home and End go to `min` and `max`;
 * a digit `0`–`9` sets that number when it lies in the range. The result is always a whole number
 * inside the range, and may equal `value` at an edge.
 */
export function numberStepperKey(
  key: string,
  value: number,
  { min, max, step, largeStep }: NumberStepperRange,
  rtl: boolean,
): number | undefined {
  const by = (delta: number) => clampWhole(value + delta, min, max)
  switch (key) {
    case "ArrowUp":
      return by(step)
    case "ArrowDown":
      return by(-step)
    case "ArrowRight":
      return by(rtl ? -step : step)
    case "ArrowLeft":
      return by(rtl ? step : -step)
    case "PageUp":
      return by(largeStep)
    case "PageDown":
      return by(-largeStep)
    case "Home":
      return min
    case "End":
      return max
  }
  if (!/^[0-9]$/.test(key)) return undefined
  const digit = Number(key)
  return digit >= min && digit <= max ? digit : undefined
}

/** − and +: 44 px on a phone, 36 px from `sm`, joined to the value between them. */
const side = "size-11 sm:size-9 shrink-0"

/**
 * A small whole number applied as it changes: "− 3 +". The number sits in a fixed-width box with
 * tabular figures, so the row does not shift between 9 and 10, and `zeroLabel` can show a word
 * such as "Off" for `0`.
 *
 * The box is the one tab stop, a `role="spinbutton"` that owns the keyboard: the arrows step
 * (Left and Right swap in a right-to-left page), PageUp and PageDown take a larger step, Home and
 * End go to the ends, and a digit in range sets that number. − and + are buttons outside the tab
 * order, disabled at the ends; a click on one moves focus to the box, so the next key press steps
 * too.
 *
 * Controlled: `onChange` fires on every change and the caller saves it; the stepper keeps no state.
 * Every decision about zero and the ends is made on the number, never on its formatted text.
 */
export function NumberStepper({
  value,
  onChange,
  max,
  min = 0,
  step = 1,
  largeStep,
  zeroLabel,
  disabled = false,
  locale,
  label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  labels,
  id,
  class: className,
}: NumberStepperProps): JSX.Element {
  if (label === undefined && labelledBy === undefined) {
    throw new Error("NumberStepper needs a `label` or an `aria-labelledby`")
  }
  const words = useLabels("NumberStepper", numberStepperLabels, labels)
  const language = useT().language
  const box = useRef<HTMLDivElement>(null)
  const wholeStep = Math.max(1, Math.round(step))
  const range: NumberStepperRange = {
    min,
    max,
    step: wholeStep,
    largeStep: Math.max(wholeStep, Math.round(largeStep ?? (max - min) / 10)),
  }
  const shown = clampWhole(value, min, max)
  const text = shown === 0 && zeroLabel !== undefined
    ? zeroLabel
    : new Intl.NumberFormat(locale ?? language, { maximumFractionDigits: 0 }).format(shown)

  function change(next: number): void {
    if (next !== shown) onChange(next)
  }

  function press(delta: number): void {
    change(clampWhole(shown + delta, min, max))
    box.current?.focus()
  }

  function onKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>): void {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl"
    const next = numberStepperKey(event.key, shown, range, rtl)
    if (next === undefined) return
    event.preventDefault()
    change(next)
  }

  return (
    <div class={cn("inline-flex items-stretch", className)}>
      <Button
        variant="outline"
        size="none"
        class={cn(side, "rounded-e-none")}
        tabIndex={-1}
        aria-label={words.decrease}
        disabled={disabled || shown <= min}
        onClick={() => press(-wholeStep)}
      >
        <IconMinus class="size-4" />
      </Button>
      <div
        ref={box}
        id={id}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-valuenow={shown}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={text}
        aria-disabled={disabled ? "true" : undefined}
        onKeyDown={onKeyDown}
        class={cn(
          "pc-num relative inline-flex min-w-16 items-center justify-center border-y border-control bg-surface px-2 text-sm font-medium text-foreground focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden",
          disabled && "opacity-50",
        )}
      >
        {text}
      </div>
      <Button
        variant="outline"
        size="none"
        class={cn(side, "rounded-s-none")}
        tabIndex={-1}
        aria-label={words.increase}
        disabled={disabled || shown >= max}
        onClick={() => press(wholeStep)}
      >
        <IconPlus class="size-4" />
      </Button>
    </div>
  )
}
