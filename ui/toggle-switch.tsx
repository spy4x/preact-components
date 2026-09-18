import { cn } from "@preact-components/signals/cn"

export interface ToggleSwitchProps {
  value: boolean
  /** Called with the flipped value; the component never mutates `value` itself. */
  onToggle: (value: boolean) => void
  disabled?: boolean
  /** Accessible name, applied as `aria-label`. */
  label?: string
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
 */
export function ToggleSwitch(
  { value, onToggle, disabled, label, class: className }: ToggleSwitchProps,
) {
  return (
    <button
      type="button"
      class={cn(
        track,
        value ? "bg-purple-900 dark:bg-purple-700" : "bg-gray-200 dark:bg-gray-600",
        className,
      )}
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onToggle(!value)}
    >
      <span aria-hidden="true" class={cn(knob, value ? "translate-x-5" : "translate-x-0")} />
    </button>
  )
}
