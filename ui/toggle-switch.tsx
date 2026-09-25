import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

export interface ToggleSwitchProps {
  value: boolean
  /** Called with the flipped value; the component never mutates `value` itself. */
  onToggle: (value: boolean) => void
  disabled?: boolean
  /** Accessible name, applied as `aria-label`. */
  label?: string
  /**
   * `id` of the `<button>`. The switch renders the button itself and forwards nothing, so this is
   * the only way a caller can point a label, an `aria-describedby` or a test at the control.
   */
  id?: string
  /**
   * Ids of the elements that name this switch. The button cannot take a `for`, so a visible label
   * outside it names it through this attribute instead — see {@link ToggleField}.
   */
  "aria-labelledby"?: string
  /** Ids of the elements that describe this switch, typically its error and its hint. */
  "aria-describedby"?: string
  class?: string
}

const track =
  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"

const knob =
  "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out dark:bg-gray-200"

/**
 * Two-state switch.
 *
 * Controlled: it renders `value` and reports the intended new value through `onToggle`, which
 * is where persistence belongs.
 *
 * The wiring props above exist because the control is a `<button>`: a wrapper cannot put an `id` on
 * it by cloning, and it cannot attach a working `for`. A labelled row is
 * {@link ToggleField} — import it rather than re-deriving the association.
 *
 * **A disabled switch refuses to report.** The native `disabled` attribute stops a browser from
 * dispatching a click at all, so the guard has no effect on mouse and keyboard use — it is there for
 * every path that does not go through hit testing: a programmatic `click()`, an assistive tool that
 * synthesises an activation, or a wrapper that calls the handler it composed. Without it a disabled
 * control is a *hint* rather than a constraint, and a caller who forwarded `onToggle` into a store
 * would flip it. The control owns this because it is the only thing that knows its own `disabled`.
 */
export function ToggleSwitch(
  {
    value,
    onToggle,
    disabled,
    label,
    id,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    class: className,
  }: ToggleSwitchProps,
): JSX.Element {
  return (
    <button
      type="button"
      id={id}
      class={cn(
        track,
        value ? "bg-purple-900 dark:bg-purple-700" : "bg-gray-200 dark:bg-gray-600",
        className,
      )}
      role="switch"
      aria-checked={value}
      aria-label={label}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onToggle(!value)
      }}
    >
      <span aria-hidden="true" class={cn(knob, value ? "translate-x-5" : "translate-x-0")} />
    </button>
  )
}
