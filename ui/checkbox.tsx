import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX, Ref, VNode } from "preact"
import { forwardRef } from "./forward-ref.ts"

/** The box's outline: the theme's square `.pc-checkbox`, or a circle, as a task list's check. */
export type CheckboxShape = "square" | "round"

/**
 * The round box, drawn by these utilities rather than by the browser: a native checkbox ignores
 * `border-radius`. The input stays a real checkbox — only its paint is replaced — so its role,
 * name, keyboard and form value are the browser's own. Keyboard focus draws `.btn`'s 2 px
 * outline, set off by 2 px, in `--color-ring`, the colour of every component's focus ring. The
 * tick is the box's `::after`, a rotated corner of two borders; while indeterminate it is a flat
 * bar instead. The empty ring is drawn in `--color-border-strong`, the token for a checkbox's
 * edge: gray-400 in the light palette, the square box's colour, and gray-500 in the dark ones,
 * where it clears 3:1. The tick is drawn in the surface colour, which clears 3:1 against the
 * accent fill in every palette. Every class is written out whole, so Tailwind's scanner finds it.
 */
const roundBox = [
  "grid size-5 shrink-0 cursor-pointer appearance-none place-content-center rounded-full border-2",
  "border-[color:var(--color-border-strong,oklch(0.707_0.022_261.325))] bg-[var(--color-surface,oklch(1_0_0))]",
  "checked:border-[color:var(--color-primary-muted,oklch(0.558_0.288_302.321))] checked:bg-[var(--color-primary-muted,oklch(0.558_0.288_302.321))]",
  "indeterminate:border-[color:var(--color-primary-muted,oklch(0.558_0.288_302.321))] indeterminate:bg-[var(--color-primary-muted,oklch(0.558_0.288_302.321))]",
  "after:hidden after:h-2.5 after:w-1.5 after:-translate-y-px after:rotate-45 after:border-r-2 after:border-b-2 after:content-['']",
  "after:border-[color:var(--color-surface,oklch(1_0_0))]",
  "checked:after:block indeterminate:after:block",
  "indeterminate:after:h-0 indeterminate:after:w-2.5 indeterminate:after:translate-y-0 indeterminate:after:rotate-0 indeterminate:after:border-r-0",
  "focus-visible:outline-2 focus-visible:outline-offset-2",
  "focus-visible:outline-[color:var(--color-ring,var(--color-accent-900,oklch(0.381_0.176_304.987)))]",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ")

/**
 * Checkbox with its own label.
 *
 * A real `<input type="checkbox">` with `.pc-checkbox` on it (or the round box, with
 * `shape="round"`), wrapped in a `.pc-label`. The label is the
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
  /** `"round"` draws a circle with a tick, as a task list's completion check. Defaults to `"square"`. */
  shape?: CheckboxShape
}

/**
 * Render the box and its label.
 *
 * The label comes *after* the box in the source guide's markup for a plain checkbox, and wraps it so
 * the accessible name and the hit area both come from the browser.
 *
 * Wrapped in `forwardRef` from `./forward-ref.ts` — this package's own, not `preact/compat`'s; see
 * that file for why. Preact strips `ref` off a function component's props and applies it to the
 * component instance rather than a DOM node, so a plain function here would make
 * `<Checkbox ref={box} />` type-check and never reach the native `<input>`. `ref`'s type comes from
 * `CheckboxProps` (via `JSX.InputHTMLAttributes<HTMLInputElement>`), so it is already
 * `Ref<HTMLInputElement>` — no cast needed at the call site.
 */
export const Checkbox: (
  props: CheckboxProps & { ref?: Ref<HTMLInputElement> },
) => VNode | null = forwardRef<HTMLInputElement, CheckboxProps>("Checkbox", function Checkbox(
  { class: className, labelClass, children, shape = "square", ...rest },
  ref,
) {
  const box = shape === "round" ? roundBox : "pc-checkbox"
  return (
    <label class={cn("pc-label", "gap-2 items-center", labelClass)}>
      <input {...rest} ref={ref} type="checkbox" class={cn(box, className)} />
      {children}
    </label>
  )
})
