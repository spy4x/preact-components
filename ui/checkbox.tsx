import { cn } from "@preact-components/signals/cn"
import type { ComponentChildren, JSX } from "preact"

/**
 * Checkbox with its own label.
 *
 * A real `<input type="checkbox">` with `.checkbox` on it, wrapped in a `.label`. The label is the
 * input's parent, so the browser's own activation behaviour binds the two — no `for`/`id` pair and
 * no click handler reimplementing what the platform already does. Give it an `id` anyway when a
 * {@link Field} or a form describes it.
 *
 * Controlled, natively: `checked` in, and the new state read off `event.currentTarget.checked` in
 * `onChange`. There is no draft state inside.
 */
export interface CheckboxProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "type" | "children"> {
  /** Plain utilities. Narrowed from Preact's `Signalish<string>`: this package never renders a signal in `class`. */
  class?: string
  /** Utilities on the wrapping `<label>`; `class` styles the box itself. */
  labelClass?: string
  /** Label text. The checkbox renders bare without it — pass `aria-label` on the input then. */
  children?: ComponentChildren
}

/**
 * Render the box and its label.
 *
 * The label comes *after* the box in the source guide's markup for a plain checkbox, and wraps it so
 * the accessible name and the hit area both come from the browser.
 */
export function Checkbox(
  { class: className, labelClass, children, ...rest }: CheckboxProps,
) {
  return (
    <label class={cn("label", "gap-2 items-center", labelClass)}>
      <input {...rest} type="checkbox" class={cn("checkbox", className)} />
      {children}
    </label>
  )
}
