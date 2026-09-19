import { cn } from "@preact-components/signals/cn"
import {
  cloneElement,
  type ComponentChild,
  type ComponentChildren,
  isValidElement,
  type JSX,
  type VNode,
} from "preact"

/**
 * The DOM attributes of one {@link Field}, handed to the control.
 *
 * `id` goes on the control and on nothing else; the label's `for` and the `aria-describedby` of the
 * error and the hint point back at it. Feeding these straight to a control is what keeps the wiring
 * correct: `ui`'s own primitives forward `id` and `aria-describedby` through `...rest`.
 *
 * The key is spelled `"aria-describedby"`, with the hyphen, on purpose: it is an HTML attribute name,
 * not a camelCase property, so neither Preact nor a control can silently drop it. Read it with a
 * bracket lookup in the function-child form.
 *
 * Deliberately only these two keys: the element-child form clones this object onto a real DOM node,
 * so anything else here would be rendered as a stray attribute. The message ids, which are for
 * `aria-labelledby` or a link to the message, arrive separately in {@link FieldWiring}.
 */
export interface FieldControlWiring {
  /** The control's `id`. */
  id: string
  /** Ready-made `aria-describedby`, or `undefined` when there is nothing to describe. */
  "aria-describedby"?: string
}

/**
 * The full {@link Field} wiring: the control's attributes plus the ids of the messages.
 *
 * A function child receives this, so it can wire a control that cannot be cloned — or point something
 * *else* at the error paragraph, which is what `crud`'s field rows do when an issue links to the row
 * that collides with the value.
 */
export interface FieldWiring extends FieldControlWiring {
  /** `id` of the error paragraph, when `error` has content. */
  errorId?: string
  /** `id` of the hint paragraph, when `hint` is set. */
  hintId?: string
}

/**
 * The control of one {@link Field}: exactly one element, or a function that returns one.
 *
 * Deliberately narrower than `ComponentChildren`. `Field` clones the child to put the wiring on it, so
 * it needs a single vnode to clone: an array or a text child has no element to receive an `id`, and
 * `cloneElement` would answer with `<undefined id="…">` in the markup instead of an error. Narrowing
 * the type is what makes that a compile error at the call site rather than a silent DOM element, and
 * {@link Field} throws for the same case at runtime because a plain-JS caller never sees the type.
 */
export type FieldChild = VNode | ((wiring: FieldWiring) => VNode)

export interface FieldProps {
  /**
   * `id` of the control. Required, and **not generated**: the id is the one piece of a field a
   * caller must be able to see, because it is what a test or a SSR snapshot asserts on. Generate it
   * with `useId()` when there is no natural id.
   */
  id: string
  /** Visible label text. Rendered above the control, or below it when `suffix` is set. */
  label?: ComponentChildren
  /** The one control of this field, or a function receiving the {@link FieldWiring}. */
  children: FieldChild
  /** Put the label *below* the control instead of above it. */
  suffix?: boolean
  /** Message to show under the control. Empty, `null` or `undefined` renders nothing and wires nothing. */
  error?: string | null
  /** Helper text under the control. */
  hint?: ComponentChildren
  /** Adds `required` and a `*` after the label. The native attribute is what the browser validates. */
  required?: boolean
  /** Renders the label dimmed. The `disabled` attribute itself belongs on the control. */
  disabled?: boolean
  /** Extra utilities on the wrapper, typically the grid span of the row. */
  class?: string
}

const errorText = "mt-2 text-sm text-red-700 dark:text-red-300"
const hintText = "mt-2 text-sm text-gray-500 dark:text-gray-400"

/**
 * Label, control and messages of one field row — the id/`for` wiring every consumer hand-rolls.
 *
 * The layout is the one `theme/preset.css` styles the controls for: `.label` above, the control in
 * a `mt-2` block, then the error and the hint. `suffix` flips the first two, which is the "label
 * under the input" pattern of the source guide.
 *
 * A single child element is cloned with the {@link FieldWiring} applied, so the short form works for
 * any control that forwards its props:
 *
 * ```tsx
 * <Field id={id} label="Email" error={error} required>
 *   <Input id={id} value={email} onInput={(event) => email = event.currentTarget.value} />
 * </Field>
 * ```
 *
 * A function child is handed the same wiring explicitly — use it when the control cannot be reached
 * by cloning, for example when it is a component of another package that swallows unknown props:
 *
 * ```tsx
 * <Field id={id} label="Email">
 *   {(wiring) => (
 *     <SomeControl id={wiring.id} aria-describedby={wiring["aria-describedby"]} />
 *   )}
 * </Field>
 * ```
 *
 * A function child returns one element too, so it is `VNode`-typed. To read a prop off it — the
 * caller's own `aria-describedby`, say — destructure it before returning:
 *
 * ```tsx
 * const child = <SomeControl class="mt-2" />
 * const other = child.props["aria-describedby"]
 * ```
 *
 * const other = child.props["aria-describedby"]
 * ```
 *
 * Precedence, both forms: the caller's own `aria-describedby` is **kept alongside** the messages
 * `Field` adds, never replaced by them. `<Field id="a" error="E"><input aria-describedby="own" /></Field>`
 * renders `aria-describedby="own a-error"`, because dropping a description the caller asked for would
 * silently unhook a control that has extra context `Field` knows nothing about. A caller who needs to
 * *replace* it says so through the function child, which receives the wiring instead of a merge.
 *
 * One `id` appears once in the output: on the control. The label's `for` and the `aria-describedby`
 * of the messages reference it. Duplicate `for` attributes in a consumer were the bug that put this
 * component on the roadmap, so the wiring is asserted in `field.test.tsx`, not assumed.
 *
 * An `error` also marks the control `aria-invalid`, which is the only place a screen reader learns a
 * value was rejected — `aria-describedby` announces the message but not the invalid state.
 */
export function Field(
  {
    id,
    label,
    children,
    suffix,
    error,
    hint,
    required,
    disabled,
    class: className,
  }: FieldProps,
) {
  const message = typeof error === "string" && error.length > 0 ? error : undefined
  const errorId = message === undefined ? undefined : `${id}-error`
  const hintId = hint === undefined || hint === null || hint === false ? undefined : `${id}-hint`
  const ariaDescribedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined
  const wiring: FieldWiring = { id, errorId, hintId, "aria-describedby": ariaDescribedBy }
  const control = typeof children === "function"
    ? children(wiring)
    : wireElement(children, id, ariaDescribedBy, message !== undefined)

  const labelElement = label === undefined || label === null
    ? null
    : (
      <label for={id} class={cn("label", disabled && "opacity-50")}>
        {label}
        {required && <span aria-hidden="true" class="ml-1 text-red-700 dark:text-red-300">*</span>}
      </label>
    )

  return (
    <div class={className}>
      {!suffix && labelElement}
      <div class="mt-2">{control}</div>
      {suffix && labelElement}
      {message !== undefined && <p id={errorId} class={errorText} aria-live="polite">{message}</p>}
      {hintId !== undefined && <p id={hintId} class={hintText}>{hint as ComponentChild}</p>}
    </div>
  )
}

/**
 * Clone the control with the field's wiring merged onto it.
 *
 * `Field`'s own `aria-describedby` comes last so it always survives, and the consumer's is kept in
 * front of it — see the precedence note on {@link Field}.
 *
 * @param child The single control element, validated rather than trusted.
 * @param id The control's `id`, and the label's `for`.
 * @param ariaDescribedBy The message ids to append to whatever the control already describes.
 * @param invalid Whether to mark the control `aria-invalid`.
 * @throws When `child` is not a single element — an array or a text child has no element to wire, and
 * cloning one would render `<undefined>` into the document instead of failing.
 */
function wireElement(
  child: FieldChild,
  id: string,
  ariaDescribedBy: string | undefined,
  invalid: boolean,
): ComponentChild {
  if (!isValidElement(child)) {
    throw new TypeError(
      `Field(${id}): children must be exactly one element, or a function returning one. ` +
        `An array or a text child has no element to receive the id and the labels.`,
    )
  }
  // `isValidElement` widens the props to `{}`; the cast is what lets the control's own
  // `aria-describedby` be read without narrowing the child type itself.
  const own = (child.props as JSX.HTMLAttributes<HTMLElement>)["aria-describedby"]
  const describedBy = [typeof own === "string" ? own : undefined, ariaDescribedBy]
    .filter(Boolean)
    .join(" ") || undefined

  return cloneElement(child, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": invalid ? true : undefined,
  } as JSX.HTMLAttributes<HTMLElement>)
}
