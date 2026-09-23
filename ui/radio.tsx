import { cn } from "@preact-components/cn"
import type { ComponentChildren, JSX } from "preact"
import { forwardRef } from "./forward-ref.ts"

/** One choice of a {@link RadioGroup}. */
export interface RadioOption {
  /** Submitted value. The markup stringifies it; the caller's `onChange` gets the string back. */
  value: number | string
  /** Visible label, and the choice's accessible name. */
  label: ComponentChildren
  /** Renders this choice unavailable; a disabled group disables all of them. */
  disabled?: boolean
}

/**
 * Radio choice with its own label.
 *
 * A real `<input type="radio">` inside its `<label>`, so the box and the text are one hit area and
 * the accessible name needs no `for`/`id` pair. Give it an `id` only when something outside the
 * label has to reference it.
 */
export interface RadioProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "type" | "children"> {
  /** Plain utilities. Narrowed from Preact's `Signalish<string>`: this package never renders a signal in `class`. */
  class?: string
  /** Utilities on the wrapping `<label>`. */
  labelClass?: string
  children?: ComponentChildren
}

export interface RadioGroupProps
  extends Omit<JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>, "class" | "children" | "onChange"> {
  /** Group accessible name, rendered as the `<legend>`. Required — a group without one is unlabelled. */
  legend: ComponentChildren
  /** Shared `name` of every radio in the group, and the key the browser groups them by. */
  name: string
  options: RadioOption[]
  /** Currently checked value, compared as a string. `null` or `undefined` checks nothing. */
  value?: number | string | null
  /**
   * Called with the picked option's value as a string, plus the input's native event.
   *
   * Replaces the fieldset's own `onChange`: the change event fires on the radio, not on the group,
   * so a fieldset handler would only ever see a bubbled event with the wrong `currentTarget`. The
   * value is passed first because that is what every caller actually wants off it.
   */
  onChange?: (value: string, event: JSX.TargetedEvent<HTMLInputElement, Event>) => void
  class?: string
}

/**
 * One radio choice. The `name` is the caller's — the platform groups on it, this component does not.
 *
 * Wrapped in `forwardRef` from `./forward-ref.ts` — this package's own, not `preact/compat`'s; see
 * that file for why. Preact strips `ref` off a function component's props and applies it to the
 * component instance rather than a DOM node, so a plain function here would make
 * `<Radio ref={box} />` type-check and never reach the native `<input>`. `ref`'s type comes from
 * `RadioProps` (via `JSX.InputHTMLAttributes<HTMLInputElement>`), so it is already
 * `Ref<HTMLInputElement>` — no cast needed at the call site. `RadioGroup` renders its options through
 * this same component and passes no `ref` of its own, so it is unaffected.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { class: className, labelClass, children, ...rest },
  ref,
) {
  return (
    <label class={cn("label", "gap-2 items-center", labelClass)}>
      <input {...rest} ref={ref} type="radio" class={cn("radio", className)} />
      {children}
    </label>
  )
})

/**
 * Radio set with an accessible group name.
 *
 * Rendered as a `<fieldset>`/`<legend>` pair: that is the native group, so the legend gives the whole
 * set its accessible name and the fieldset's own `disabled` reaches every radio inside it. No `role`,
 * because `<fieldset>` and `<input type="radio">` already carry the roles a `radiogroup` would
 * duplicate.
 *
 * Arrow-key navigation is the platform's: every radio shares one `name`, which puts them in a single
 * tab stop and lets the browser move the selection with the arrows once focus is inside. The component
 * adds no key handler, no `tabIndex`, and no `aria-checked` — reimplementing the roving tab stop is
 * what breaks the behaviour on one platform or another.
 */
export function RadioGroup(
  {
    legend,
    name,
    options,
    value,
    onChange,
    class: className,
    ...rest
  }: RadioGroupProps,
) {
  const current = value === null || value === undefined ? undefined : String(value)
  const id = rest.id === undefined ? undefined : String(rest.id)

  return (
    <fieldset {...rest} class={cn("space-y-3", className)}>
      <legend class="label mb-2">{legend}</legend>
      <div class="flex flex-col gap-2">
        {options.map((option, index) => (
          <Radio
            key={String(option.value)}
            id={radioId(id, index)}
            name={name}
            value={String(option.value)}
            checked={current !== undefined && current === String(option.value)}
            disabled={option.disabled}
            onChange={onChange === undefined
              ? undefined
              : (event) => onChange(event.currentTarget.value, event)}
          >
            {option.label}
          </Radio>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * `id` of the radio at `index`.
 *
 * Derived from the fieldset's `id` and the option's index — indices are stable for a given `options`
 * array, and values may be any string. Falls back to `undefined` when the group has no `id`, because a
 * generated `id` that no `<label>` references is worse than none: the wrapping labels already name
 * their radios.
 */
function radioId(groupId: string | undefined, index: number): string | undefined {
  return groupId === undefined ? undefined : `${groupId}-${index}`
}
