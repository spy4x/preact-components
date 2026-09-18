import { cn } from "@preact-components/signals/cn"
import type { ReadonlySignal, Signal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import { Fragment } from "preact"
import { useId } from "preact/hooks"
import type { FieldIssue, ValidationModel } from "./validation.ts"

/**
 * Field rows for a CRUD editor.
 *
 * A field row is the unit of duplication the editors were built from: a label, a control bound to
 * one field of the model signal, an optional hint, and the field's issues. The row owns the control
 * id it generates, so two editors (or two rows) on one page can no longer share `id="name"` and
 * steal each other's label.
 */

/** Grid cell a field row occupies when the caller does not say otherwise. */
const defaultSpan = "sm:col-span-3"

/**
 * What every field row receives.
 *
 * `M` is the model being edited and `K` the field this row owns, so a typo in `name` is a compile
 * error and the control's write is typed as that field.
 */
export interface FieldProps<M extends object, K extends keyof M & string> {
  /** Model signal the control reads and writes. */
  vm: Signal<M>
  /** Validation model signal the row reads its issues from. */
  vl: ReadonlySignal<ValidationModel<M>>
  /** Field of the model this row edits. */
  name: K
  /** Visible label. */
  label: string
  /** Grid span utilities of the wrapping cell. Defaults to `"sm:col-span-3"`. */
  span?: string
  /** Helper text under the control. */
  hint?: ComponentChildren
  /** Placeholder of the control, where the control has one. */
  placeholder?: string
  /** Extra utilities merged onto the control's own class. */
  inputClass?: string
  /**
   * Renders one issue instead of the default red paragraph.
   *
   * The editors that link to the row a value collides with use this to put a "Navigate to it"
   * button next to the message.
   */
  renderIssue?: (issue: FieldIssue, type: string) => ComponentChildren
}

/**
 * Merge one field into a model signal.
 *
 * The write builds a fresh object because signals compare by reference: mutating
 * `vm.value[name]` in place would change the store and render nothing.
 *
 * `value` is `unknown` and asserted into place on the assignment. A computed key cannot be checked
 * against a generic `M`, so this is where that single assertion lives — every call site then passes
 * the field's own type and needs no cast of its own.
 */
export function setField<M extends object>(
  vm: Signal<M>,
  name: keyof M & string,
  value: unknown,
): void {
  vm.value = { ...vm.value, [name]: value } as M
}

/** A model value as the text a control shows. `null` and `undefined` render empty, never `"null"`. */
export function fieldText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}

/** The issues of one field, or nothing when it has none. */
export function FieldIssues<M extends object>(
  { vl, name, renderIssue }: {
    vl: ReadonlySignal<ValidationModel<M>>
    name: keyof M & string
    renderIssue?: (issue: FieldIssue, type: string) => ComponentChildren
  },
) {
  const field = vl.value[name]
  if (field === undefined) return null

  return (
    <>
      {Object.entries(field).map(([type, issue]) =>
        issue === undefined
          ? null
          : renderIssue === undefined
          ? <p key={type} class="text-sm text-red-700 mt-2">{issue.message}</p>
          : <Fragment key={type}>{renderIssue(issue, type)}</Fragment>
      )}
    </>
  )
}

/** Label, control, hint and issues of one grid cell. The field controls below differ only in control. */
function FieldCell(
  { id, label, span, hint, issues, children }: {
    id: string
    label: string
    span: string
    hint?: ComponentChildren
    issues: ComponentChildren
    children: ComponentChildren
  },
) {
  return (
    <div class={span}>
      <label for={id} class="label">{label}</label>
      <div class="mt-2">{children}</div>
      {hint !== undefined && <p class="mt-2 text-sm text-gray-500">{hint}</p>}
      {issues}
    </div>
  )
}

/** One labelled text input. Commits on blur, trimmed, so a keystroke is not a store write. */
export function TextField<M extends object, K extends keyof M & string>(props: FieldProps<M, K>) {
  const id = useId()
  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      issues={<FieldIssues vl={props.vl} name={props.name} renderIssue={props.renderIssue} />}
    >
      <input
        type="text"
        id={id}
        class={cn("input", props.inputClass)}
        placeholder={props.placeholder}
        value={fieldText(props.vm.value[props.name])}
        onBlur={(event) => setField(props.vm, props.name, event.currentTarget.value.trim())}
      />
    </FieldCell>
  )
}

/**
 * One labelled numeric input.
 *
 * A number input reports `""` for anything the browser cannot parse — and for the intermediate
 * states of typing `-`, `1e` or `1.` — so an empty or unparsable box commits `0` rather than
 * `NaN`, which is what the arktype schema would otherwise reject on every keystroke.
 */
export function NumberField<M extends object, K extends keyof M & string>(props: FieldProps<M, K>) {
  const id = useId()
  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      issues={<FieldIssues vl={props.vl} name={props.name} renderIssue={props.renderIssue} />}
    >
      <input
        type="number"
        id={id}
        class={cn("input", props.inputClass)}
        placeholder={props.placeholder}
        value={fieldText(props.vm.value[props.name])}
        onBlur={(event) => setField(props.vm, props.name, commitNumber(event.currentTarget.value))}
      />
    </FieldCell>
  )
}

/** Parse a numeric input's value, tolerating the empty and half-typed boxes a browser reports. */
export function commitNumber(raw: string): number {
  const parsed = Number(raw.trim())
  return Number.isFinite(parsed) ? parsed : 0
}

/** One labelled multi-line text input. Commits on blur, trimmed. */
export function TextareaField<M extends object, K extends keyof M & string>(
  props: FieldProps<M, K> & { rows?: number },
) {
  const id = useId()
  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      issues={<FieldIssues vl={props.vl} name={props.name} renderIssue={props.renderIssue} />}
    >
      <textarea
        id={id}
        rows={props.rows ?? 4}
        class={cn("textarea", props.inputClass)}
        placeholder={props.placeholder}
        value={fieldText(props.vm.value[props.name])}
        onBlur={(event) => setField(props.vm, props.name, event.currentTarget.value.trim())}
      />
    </FieldCell>
  )
}

/** One option of a {@link SelectField}. `value` keeps its type, so a numeric foreign key stays numeric. */
export interface SelectOption {
  value: number | string
  label: string
}

/** A {@link SelectField} adds its option list and the empty option to {@link FieldProps}. */
export interface SelectFieldProps<M extends object, K extends keyof M & string>
  extends FieldProps<M, K> {
  options: SelectOption[]
  /** Label of the empty option. Omit for a select that must always hold a value. */
  placeholder?: string
}

/**
 * One labelled select.
 *
 * The control's value is the model's, not each option's `selected` flag. When the model holds a
 * value no option carries — a foreign key the collection has not loaded yet, or the `0` a blank
 * model starts with — the select falls back to the empty option instead of silently displaying its
 * first entry as if it were chosen.
 *
 * Option values are stringified in the markup on purpose. A browser only ever reports a string, and
 * the server renderer compares an option's value to the select's with `==`: leaving a numeric `0`
 * on an option made it match the empty placeholder (`"" == 0`), so two options rendered selected.
 */
export function SelectField<M extends object, K extends keyof M & string>(
  props: SelectFieldProps<M, K>,
) {
  const id = useId()
  const current = props.vm.value[props.name]
  const selected = props.options.find((option) => String(option.value) === String(current))

  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      issues={<FieldIssues vl={props.vl} name={props.name} renderIssue={props.renderIssue} />}
    >
      <select
        id={id}
        class={cn("select", props.inputClass)}
        value={selected === undefined ? "" : String(selected.value)}
        onChange={(event) => {
          const picked = props.options.find(
            (option) => String(option.value) === event.currentTarget.value,
          )
          setField(props.vm, props.name, picked === undefined ? "" : picked.value)
        }}
      >
        {props.placeholder !== undefined && <option value="">{props.placeholder}</option>}
        {props.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
        ))}
      </select>
    </FieldCell>
  )
}

/** One labelled checkbox, with its label after the box. */
export function CheckboxField<M extends object, K extends keyof M & string>(
  props: FieldProps<M, K>,
) {
  const id = useId()
  return (
    <div class={props.span ?? defaultSpan}>
      <div class="flex gap-2 items-center">
        <input
          type="checkbox"
          id={id}
          class={cn("checkbox", props.inputClass)}
          checked={Boolean(props.vm.value[props.name])}
          onChange={(event) => setField(props.vm, props.name, event.currentTarget.checked)}
        />
        <label for={id} class="label">{props.label}</label>
      </div>
      {props.hint !== undefined && <p class="mt-2 text-sm text-gray-500">{props.hint}</p>}
      <FieldIssues vl={props.vl} name={props.name} renderIssue={props.renderIssue} />
    </div>
  )
}
