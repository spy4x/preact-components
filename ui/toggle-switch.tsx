import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

/** Props every {@link ToggleSwitch} takes, whichever name its value port goes by. */
interface ToggleSwitchBaseProps {
  value: boolean
  disabled?: boolean
  /** Accessible name, applied as `aria-label`. */
  ariaLabel?: string
  /**
   * Accessible name, applied as `aria-label`; `ariaLabel` wins when both are given.
   *
   * @deprecated Use `ariaLabel`. Removed in the next major.
   */
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
  /**
   * Marks the switch invalid; `Field` sets it while it carries an error. There is no `required`: a
   * switch is on or off, never empty, so `Field`'s `required` does nothing here.
   */
  "aria-invalid"?: boolean | string
  class?: string
}

/**
 * The value port of a toggle: `onChange`, or its deprecated alias `onToggle`. One of the two, never
 * both, so a caller cannot wire two handlers by accident.
 */
export type ToggleChangeProps =
  | {
    /** Called with the flipped value; the component never mutates `value` itself. */
    onChange: (value: boolean) => void
    onToggle?: undefined
  }
  | {
    /**
     * Called with the flipped value.
     *
     * @deprecated Use `onChange`, which takes the same boolean. Removed in the next major.
     */
    onToggle: (value: boolean) => void
    onChange?: undefined
  }

/** Props of {@link ToggleSwitch}: the base props plus one value port. */
export type ToggleSwitchProps = ToggleSwitchBaseProps & ToggleChangeProps

const track =
  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"

const knob =
  "pointer-events-none inline-block size-5 transform rounded-full bg-surface shadow-raised ring-0 dark:bg-foreground transition duration-200 ease-in-out"

/**
 * Two-state switch.
 *
 * Controlled: it renders `value` and reports the intended new value through `onChange`, which
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
 * control is a *hint* rather than a constraint, and a caller who forwarded `onChange` into a store
 * would flip it. The control owns this because it is the only thing that knows its own `disabled`.
 */
export function ToggleSwitch(
  {
    value,
    onChange,
    onToggle,
    disabled,
    ariaLabel,
    label,
    id,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    class: className,
  }: ToggleSwitchProps,
): JSX.Element {
  return (
    <button
      type="button"
      id={id}
      class={cn(
        track,
        value ? "bg-selected" : "bg-track",
        className,
      )}
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel ?? label}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid === true || ariaInvalid === "true" ? true : undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        const report = onChange ?? onToggle
        report?.(!value)
      }}
    >
      <span aria-hidden="true" class={cn(knob, value ? "translate-x-5" : "translate-x-0")} />
    </button>
  )
}
