import { cn } from "@preact-components/cn"
import type { ComponentChildren, JSX } from "preact"
import { ToggleSwitch } from "./toggle-switch.tsx"

/**
 * Labelled row for a {@link ToggleSwitch}: label, control, description and error.
 *
 * Why this does not render through `Field`, and why the label carries a `click` handler instead of a
 * `for` — both are the same reason: a switch is a `<button>`, and `<button>` is not a labelable
 * element. `label`/`for` resolves only against labelable elements (button, input, meter, output,
 * progress, select, textarea), so a `for` pointing at a button is inert markup: the label reads as
 * associated with nothing and activating it activates nothing. Two consequences:
 *
 * 1. `Field` would hand nothing useful here. It has the override a dead `for` needs —
 *    `labelFor={false}` is exactly the flag a caller who wants a bare label passes — but it cannot
 *    render this row: the control is the only child of a `mt-2` block and the label is rendered
 *    outside it, either above or below, where a settings row puts the label and the switch side by
 *    side (`justify-between items-center gap-3`) and spends `mt-2` on the message paragraphs
 *    underneath. That placement is neither the row a settings page needs nor fixable from outside,
 *    and reusing `Field` for its class tokens alone would mean rendering `mt-2` on a control that has
 *    to sit next to its label.
 * 2. There is no `for` to write, so the association is split across the two mechanisms that do
 *    work for a button: `aria-labelledby` gives the switch the label text as its accessible name,
 *    and an `onClick` on the label performs the activation the browser will not. The handler calls
 *    `preventDefault()` so a browser that activates a button through an associated label anyway
 *    cannot fire a second toggle.
 *
 * The two ids are derived from the required `id` rather than generated, so the wiring is visible to
 * a test and to the caller: the caller's `id` lands on the button, `${id}-label` on the label element
 * that names it. Nothing here is duplicated from `Field` beyond its class tokens, which are repeated
 * because rendering through `Field` is what would break the association.
 *
 * Controlled: it renders `value` and reports the intended new value through `onToggle`. It holds no
 * state and touches no DOM global, so it server-renders.
 */
export interface ToggleFieldProps {
  /**
   * `id` of the switch. Required and **not generated**, so the caller can point a test or a form at
   * it. Used as-is on the button; the label element becomes `${id}-label`.
   */
  id: string
  /** Visible label text. Names the switch through `aria-labelledby`. */
  label: ComponentChildren
  /** Current state of the switch. */
  value: boolean
  /**
   * Called with the flipped value. No `onChange`: the payload is the intended boolean, not a DOM
   * event, so the same prop name as {@link ToggleSwitch} keeps the pair interchangeable.
   */
  onToggle: (value: boolean) => void
  /**
   * Description under the row, expected and rendered as the field's `hint`: same slot, same classes,
   * and the id `Field` would have generated (`${id}-hint`). It is not a separate concept, and a
   * second one would mean two descriptions competing for the same `aria-describedby`.
   *
   * Content of nothing but whitespace is treated as absent — a lone space describes as little as an
   * empty string does — so it is rendered but not referred to. Anything else is passed through
   * untrimmed, since the caller's own spacing is theirs to keep.
   */
  description?: ComponentChildren
  /**
   * Message to show under the row. Empty, `null` or `undefined` renders nothing and wires nothing —
   * the same rule as `Field`'s `error`, because an error that is the empty string is not an error.
   */
  error?: string | null
  /** Adds a `*` after the label. A switch has no native `required` to carry, so it is visual only. */
  required?: boolean
  /** Dims the label and disables the switch itself. */
  disabled?: boolean
  /** Extra utilities on the wrapper, typically the grid span of the row. */
  class?: string
}

const labelText = "label items-center gap-3"
// The message classes are `Field`'s, character for character: a description on a switch row must not
// look different from a hint on an input row.
const errorText = "mt-2 text-sm text-red-700 dark:text-red-300"
const hintText = "mt-2 text-sm text-gray-500 dark:text-gray-400"

/**
 * Render one switch row.
 *
 * No `@throws`: the control is a component, not a cloned element, so there is no child to validate —
 * unlike `Field`, whose `wireElement` throws when it is handed something it cannot put an `id` on.
 */
export function ToggleField({
  id,
  label,
  value,
  onToggle,
  description,
  error,
  required,
  disabled,
  class: className,
}: ToggleFieldProps): JSX.Element {
  const message = typeof error === "string" && error.length > 0 ? error : undefined
  const errorId = message === undefined ? undefined : `${id}-error`
  // A description wires its paragraph only when it has something to say. `""` is what a computed
  // description degrades to when its input is missing, and `" "` is what a template literal produces
  // when its parts are all empty; either would leave one id in `aria-describedby` pointing at a
  // paragraph that reads as nothing. `Field` draws the same line at its `hint`: message ids are for
  // content, never for the mere presence of the prop.
  const hasDescription = typeof description === "string"
    ? description.trim().length > 0
    : description !== undefined && description !== null && description !== false
  const hintId = hasDescription ? `${id}-hint` : undefined
  const labelId = `${id}-label`
  // `A B` with an empty half would describe the control with an element that does not exist, so the
  // ids are joined only when there are ids to join — same rule as `Field`.
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined

  return (
    <div class={className}>
      <div class={cn("flex", !disabled && "justify-between")}>
        <label
          id={labelId}
          class={cn(labelText, disabled && "opacity-50")}
          onClick={(event) => {
            // Always, even when disabled: the browser does not activate a button through a label, so
            // without this the synthetic click a `dispatchEvent` or a user script produces would reach
            // the switch. `ToggleSwitch` refuses while disabled too — both are needed, because a
            // browser that one day does activate label-to-button would arrive through this handler.
            event.preventDefault()
            if (disabled) return
            onToggle(!value)
          }}
        >
          {label}
          {required && (
            <span aria-hidden="true" class="ml-1 text-red-700 dark:text-red-300">
              *
            </span>
          )}
        </label>
        <ToggleSwitch
          value={value}
          onToggle={onToggle}
          disabled={disabled}
          id={id}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
        />
      </div>
      {message !== undefined && <p id={errorId} class={errorText} aria-live="polite">{message}</p>}
      {hintId !== undefined && (
        <p id={hintId} class={hintText}>{description as ComponentChildren}</p>
      )}
    </div>
  )
}
