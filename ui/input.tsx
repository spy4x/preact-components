import { cn } from "@preact-components/cn"
import type { JSX } from "preact"
import { forwardRef } from "./forward-ref.ts"

/**
 * The single-line text control of the library.
 *
 * A real `<input>` with `.input` on it: every native attribute (`type`, `name`, `placeholder`,
 * `required`, `autocomplete`, `disabled`, `aria-*`, …) passes straight through, so nothing the
 * platform already does is reimplemented here.
 */
export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class"> {
  /** Plain utilities. Narrowed from Preact's `Signalish<string>`: this package never renders a signal in `class`. */
  class?: string
}

/** Multi-line control of the library. Same contract as {@link Input}, on a `<textarea>`. */
export type TextareaProps = Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "class"> & {
  class?: string
}

/** One option of a {@link Select}. `value` keeps its type; the markup stringifies it. */
export interface SelectOption {
  value: number | string
  label: string
}

/** Native `<select>` of the library, with its option list as data. */
export interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "class"> {
  class?: string
  options: SelectOption[]
  /** Label of a leading empty option. Omit for a select that must always hold a value. */
  placeholder?: string
}

/**
 * Controlled text input.
 *
 * Has no internal value state: it renders the `value` prop and reports every keystroke through
 * `onInput` (or `onChange`, whichever the caller passes — both get the native event). Keeping a
 * draft inside the component would make the rendered value and the caller's state disagree.
 *
 * Wrapped in `forwardRef` from `./forward-ref.ts` — this package's own, not `preact/compat`'s; see
 * that file for why. Preact strips `ref` off a function component's props and applies it to the
 * component instance rather than a DOM node, so a plain function here would make
 * `<Input ref={box} />` type-check and never reach the native `<input>`. `ref`'s type comes from
 * `InputProps` (via `JSX.InputHTMLAttributes<HTMLInputElement>`), so it is already
 * `Ref<HTMLInputElement>` — no cast needed at the call site.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>("Input", function Input(
  { class: className, ...rest },
  ref,
) {
  return <input {...rest} ref={ref} class={cn("input", className)} />
})

/** Controlled multi-line input. See {@link Input} for the state contract. */
export function Textarea({ class: className, ...rest }: TextareaProps) {
  return <textarea {...rest} class={cn("textarea", className)} />
}

/**
 * Controlled select.
 *
 * The options are data, the selection is the caller's `value` — the selected option is derived from
 * it, never set per option, so a model holding a value no option carries falls back to the browser's
 * blank state instead of mislabelling its first entry. A `placeholder` renders as the leading empty
 * option; without one, pass `value=""` and supply your own empty option in `options`.
 */
export function Select({ class: className, options, placeholder, ...rest }: SelectProps) {
  return (
    <select {...rest} class={cn("select", className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
      ))}
    </select>
  )
}
