import { join } from "@spy4x/preact-cn/join"
import { IconCheck } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"

/** One chip of a {@link RadioChips} group. */
export interface RadioChipOption {
  /** The radio's submitted value, and what `onChange` carries. Unique within the group. */
  value: string
  /** The chip's visible text, and its radio's accessible name. */
  label: ComponentChildren
  disabled?: boolean
  /** The radio's `id`, for page CSS such as `:has(#mode-all:checked)`. */
  id?: string
  /**
   * Extra attributes on the radio, such as `data-*` analytics hooks. They go on the input rather
   * than the label because a label click is passed on to its input as a second click, which would
   * count twice. `type`, `name`, `value` and the checked state are the component's own.
   */
  inputAttributes?: Record<string, string>
}

/** Props of {@link RadioChips}. */
export interface RadioChipsProps {
  /** The group's accessible name, rendered as the `<legend>`. */
  legend: ComponentChildren
  /** Keeps the legend for screen readers only. */
  hideLegend?: boolean
  /** Replaces the visible legend's classes, `"pc-label mb-2"` by default. */
  legendClass?: string
  /** Shared `name` of every radio: the browser groups them, and a form submits it, by this. */
  name: string
  options: RadioChipOption[]
  /** The option checked in the server-rendered markup; the browser keeps the choice after that. */
  defaultValue?: string
  /** Controlled checked option, for an island that owns the choice. Wins over `defaultValue`. */
  value?: string | null
  /** Called with the picked option's value and the radio's native event. */
  onChange?: (value: string, event: JSX.TargetedEvent<HTMLInputElement, Event>) => void
  /** Utilities on the `<fieldset>`. */
  class?: string
  /** Utilities added to the row that holds the chips, `"flex flex-wrap gap-2"`. */
  optionsClass?: string
}

/**
 * The chip, matching an unpressed `ToggleChips` chip: 44 px tall on a phone, 32 px from `sm`, the
 * surface with full-strength text and a quiet border. Each state reads its radio through `:has()`,
 * so the look follows the browser's own checked, focus and disabled state with no script.
 */
const chip =
  "group/chip relative inline-flex items-center gap-1 min-h-11 sm:min-h-8 px-3 py-1 border rounded-md text-xs font-medium normal-case whitespace-nowrap cursor-pointer transition-colors bg-surface text-foreground border-subtle hover:bg-hover"

/** A checked chip: `ToggleChips`'s pressed chip in its default accent, hover included. */
const checked =
  "has-[:checked]:border-transparent has-[:checked]:bg-selected has-[:checked]:text-selected-foreground has-[:checked]:hover:bg-selected"

/** The focus ring of a `ToggleChips` chip, drawn on the chip while its hidden radio has focus. */
const focused =
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-focus"

const disabled = "has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"

/**
 * A single choice drawn as `ToggleChips` chips, built on native radios so it works before, or
 * without, any JavaScript.
 *
 * A `<fieldset>` named by its `<legend>`, and per option a `<label>` around a visually hidden
 * `<input type="radio">`. Roles, the one tab stop and the arrow keys are the platform's: every radio
 * shares `name`, and the component adds no key handler, `tabIndex` or `aria-*`. The checked chip
 * fills with the accent and shows a check, so being checked does not rest on colour alone.
 *
 * Use it where the page must work server-rendered, such as a demo that page CSS switches through
 * `:has(#id:checked)`, or inside a plain form; use `ToggleChips` for filters an island owns.
 * Classes are joined with `join`, so an island that renders it carries no `tailwind-merge`.
 */
export function RadioChips(
  {
    legend,
    hideLegend = false,
    legendClass = "pc-label mb-2",
    name,
    options,
    defaultValue,
    value,
    onChange,
    class: className,
    optionsClass,
  }: RadioChipsProps,
): JSX.Element {
  const controlled = value !== undefined
  return (
    <fieldset class={className}>
      <legend class={hideLegend ? "sr-only" : legendClass}>{legend}</legend>
      <div class={join("flex flex-wrap gap-2", optionsClass)}>
        {options.map((option) => (
          <label key={option.value} class={join(chip, checked, focused, disabled)}>
            <input
              {...option.inputAttributes}
              type="radio"
              class="sr-only"
              id={option.id}
              name={name}
              value={option.value}
              disabled={option.disabled}
              {...(controlled
                ? { checked: value === option.value }
                : { defaultChecked: defaultValue === option.value })}
              onChange={onChange === undefined
                ? undefined
                : (event) =>
                  onChange(event.currentTarget.value, event)}
            />
            <IconCheck class="hidden size-3.5 group-has-[:checked]/chip:block" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
