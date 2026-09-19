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

/**
 * What {@link Field}'s own label points at through `for`.
 *
 * The name is only the prop's; the spelling of the DOM attribute is `for`, and the two are the same
 * thing seen from either end.
 */
export type FieldLabelFor = boolean | string

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
  /**
   * `for` target of the label above. `true` (the default) points it at `id`, the control itself.
   *
   * Pass `false` when the control supplies its own labelling — a {@link Checkbox} and every
   * {@link Radio} render a `<label>` that wraps their `<input>`, and a `RadioGroup` is a
   * `<fieldset>` named by its `<legend>`. Neither a `<label>` nor a `<fieldset>` is a **labelable
   * element**, so `for` cannot resolve against one: pointing it at them yields a dead reference,
   * names the control twice, and leaves `Field` with two labels competing for one control.
   *
   * Pass a string only to aim the label at some *other* element that is labelable — the inner
   * `<input>` of a wrapper, say. `Field` never guesses: the decision is the caller's, and inferred
   * from markup it would be fragile.
   */
  labelFor?: FieldLabelFor
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
 * {(wiring) => {
 *   const child = <SomeControl class="mt-2" />
 *   const other = child.props["aria-describedby"]
 *   return <SomeControl id={wiring.id} aria-describedby={other} />
 * }}
 * ```
 *
 * A function child **bypasses** the `aria-invalid` marking on an error: `wireElement` is what adds
 * it, and a function child is handed the wiring instead of being cloned, so the caller sets
 * `aria-invalid` on the control itself when it wants it. The wiring carries `id`,
 * `aria-describedby`, `errorId` and `hintId` — deliberately not `aria-invalid`, which is a control
 * state rather than an id to reference.
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
 * The label's `for` is emitted only against something that can carry it. A `for` resolves against
 * **labelable elements** — `button`, `input` of a type other than `hidden`, `meter`, `output`,
 * `progress`, `select`, `textarea` — and nothing else: a `<fieldset>` is not labelable, and neither
 * is a `<label>`. So a control that labels itself, or that names a group of controls, is passed with
 * `labelFor={false}`:
 *
 * ```tsx
 * <Field id={id} label="Notification method" labelFor={false}>
 *   <RadioGroup legend="Notification method" name={name} options={options} id={id} />
 * </Field>
 * ```
 *
 * The `id` prop is still required and still lands on the control, so `aria-describedby` keeps
 * working; only the label's `for` goes away, because the group's `<legend>` (or the `Checkbox`'s own
 * wrapping `<label>`) is what names it. Without `labelFor={false}` the label emits
 * `for="notification-method"` pointing at a `<fieldset>`, which is a dead reference, and on a
 * `Checkbox` it is a second label for the same `<input>`.
 *
 * An `error` also marks the control `aria-invalid`, which is the only place a screen reader learns a
 * value was rejected — `aria-describedby` announces the message but not the invalid state. That
 * marking is `wireElement`'s, so it applies to the element-child form only: a function child is
 * handed the wiring and sets `aria-invalid` itself.
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
    labelFor,
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
      <label for={labelTarget(labelFor, id)} class={cn("label", disabled && "opacity-50")}>
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
 * The `for` value of {@link Field}'s label, given the caller's {@link FieldProps.labelFor}.
 *
 * Resolved here, in one pure place, rather than inline in the component: what a `for` may point at
 * is the whole point of this file, and `field.test.tsx` asserts it both through the rendered markup
 * and directly.
 *
 * `undefined` means the label carries no `for` attribute at all, which is the only correct output
 * when the control or group owns its own labelling. Note that `undefined` is therefore *not* the
 * absent prop: a caller who passes nothing gets `true`'s behaviour, because `true` is the default.
 *
 * @param labelFor The caller's `labelFor`: `true` or `undefined` for the field's own control, a
 * non-empty string for another element, `false` to omit the attribute.
 * @param id The field's `id`, used when `labelFor` is `true` or absent.
 * @returns The `for` value, or `undefined` to omit the attribute.
 * @throws When `labelFor` is neither a boolean nor a non-empty string — a plain-JS caller never
 * sees the type, and `for=""` in the markup is a reference to nothing.
 */
export function labelTarget(labelFor: FieldLabelFor | undefined, id: string): string | undefined {
  if (labelFor === false) return undefined
  if (labelFor === undefined || labelFor === true) return id
  if (typeof labelFor === "string" && labelFor.length > 0) return labelFor
  throw new TypeError(
    `Field(${id}): labelFor must be true, false, undefined or a non-empty id, got ` +
      `${JSON.stringify(labelFor)}.`,
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
