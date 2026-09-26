import { Checkbox } from "@spy4x/preact-ui/checkbox"
import { Field } from "@spy4x/preact-ui/field"
import { Input, Select, type SelectOption, Textarea } from "@spy4x/preact-ui/input"
import type { ReadonlySignal, Signal } from "@preact/signals"
import type { ComponentChildren, JSX, VNode } from "preact"
import { Fragment } from "preact"
import { useId } from "preact/hooks"
import type { FieldIssue, ValidationModel } from "@spy4x/validation/model"

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
): JSX.Element | null {
  const field = vl.value[name]
  if (field === undefined) return null

  return (
    <>
      {Object.entries(field).map(([type, issue]) =>
        issue === undefined
          ? null
          : renderIssue === undefined
          ? <p key={type} class="mt-2 text-sm text-red-700 dark:text-red-300">{issue.message}</p>
          : <Fragment key={type}>{renderIssue(issue, type)}</Fragment>
      )}
    </>
  )
}

/** Whether the validation model holds at least one issue for this field. */
function hasIssues<M extends object>(
  vl: ReadonlySignal<ValidationModel<M>>,
  name: keyof M & string,
): boolean {
  const field = vl.value[name]
  return field !== undefined && Object.values(field).some((issue) => issue !== undefined)
}

/**
 * One grid cell: `ui`'s {@link Field} for the label, the control and the hint, then the issues.
 *
 * The label, hint and id wiring are `Field`'s, so a fix there reaches every CRUD editor. What this
 * cell adds is the part `Field` does not know about: the validation model's issues, rendered below
 * `Field` by {@link FieldIssues} (so a caller's `renderIssue` can still put a link next to one), and
 * wired back to the control through `aria-describedby` and `aria-invalid` while there are any.
 *
 * `control` receives the {@link ControlWiring} and returns the one element to render; the issues
 * come first in its `aria-describedby`, then `Field`'s hint.
 */
function FieldCell<M extends object>(
  { id, label, span, hint, vl, name, renderIssue, control }: {
    id: string
    label?: string
    span: string
    hint?: ComponentChildren
    vl: ReadonlySignal<ValidationModel<M>>
    name: keyof M & string
    renderIssue?: (issue: FieldIssue, type: string) => ComponentChildren
    control: (wiring: ControlWiring) => VNode
  },
): JSX.Element {
  const invalid = hasIssues(vl, name)
  const issuesId = `${id}-issues`
  return (
    <div class={span}>
      <Field id={id} label={label} hint={hint}>
        {(wiring) =>
          control({
            id: wiring.id,
            "aria-describedby": [invalid ? issuesId : undefined, wiring["aria-describedby"]]
              .filter(Boolean).join(" ") || undefined,
            "aria-invalid": invalid ? true : undefined,
          })}
      </Field>
      {invalid && (
        <div id={issuesId}>
          <FieldIssues vl={vl} name={name} renderIssue={renderIssue} />
        </div>
      )}
    </div>
  )
}

/**
 * The attributes {@link FieldCell} puts on a control: `Field`'s id and hint, plus the issues.
 *
 * Built through `Field`'s function child rather than its cloning form, because the clone sets
 * `aria-invalid` from `Field`'s own `error` and would overwrite the one the issues ask for.
 */
interface ControlWiring {
  id: string
  "aria-describedby": string | undefined
  "aria-invalid": true | undefined
}

/** One labelled text input. Commits on blur, trimmed, so a keystroke is not a store write. */
export function TextField<M extends object, K extends keyof M & string>(
  props: FieldProps<M, K>,
): JSX.Element {
  const id = useId()
  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      vl={props.vl}
      name={props.name}
      renderIssue={props.renderIssue}
      control={(wiring) => (
        <Input
          {...wiring}
          type="text"
          class={props.inputClass}
          placeholder={props.placeholder}
          value={fieldText(props.vm.value[props.name])}
          onBlur={(event) => setField(props.vm, props.name, event.currentTarget.value.trim())}
        />
      )}
    />
  )
}

/**
 * One labelled numeric input.
 *
 * A number input reports `""` for anything the browser cannot parse — and for the intermediate
 * states of typing `-`, `1e` or `1.` — so an empty or unparsable box commits `0` rather than
 * `NaN`, which is what the arktype schema would otherwise reject on every keystroke.
 */
export function NumberField<M extends object, K extends keyof M & string>(
  props: FieldProps<M, K>,
): JSX.Element {
  const id = useId()
  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      vl={props.vl}
      name={props.name}
      renderIssue={props.renderIssue}
      control={(wiring) => (
        <Input
          {...wiring}
          type="number"
          class={props.inputClass}
          placeholder={props.placeholder}
          value={fieldText(props.vm.value[props.name])}
          onBlur={(event) =>
            setField(props.vm, props.name, commitNumber(event.currentTarget.value))}
        />
      )}
    />
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
): JSX.Element {
  const id = useId()
  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      vl={props.vl}
      name={props.name}
      renderIssue={props.renderIssue}
      control={(wiring) => (
        <Textarea
          {...wiring}
          rows={props.rows ?? 4}
          class={props.inputClass}
          placeholder={props.placeholder}
          value={fieldText(props.vm.value[props.name])}
          onBlur={(event) => setField(props.vm, props.name, event.currentTarget.value.trim())}
        />
      )}
    />
  )
}

/** One option of a {@link SelectField}: `ui`'s own, so a numeric foreign key stays numeric. */
export type { SelectOption }

/** A {@link SelectField} adds its option list and the empty option to {@link FieldProps}. */
export interface SelectFieldProps<M extends object, K extends keyof M & string>
  extends FieldProps<M, K> {
  options: SelectOption[]
  /** Label of the empty option. Omit for a select that must always hold a value. */
  placeholder?: string
}

/**
 * One labelled select, on `ui`'s {@link Select}.
 *
 * The control's value is the model's, not each option's `selected` flag. When the model holds a
 * value no option carries — a foreign key the collection has not loaded yet, or the `0` a blank
 * model starts with — the select falls back to the empty option instead of silently displaying its
 * first entry as if it were chosen.
 *
 * Option values are stringified in the markup on purpose (`Select` does it). A browser only ever
 * reports a string, and the server renderer compares an option's value to the select's with `==`:
 * leaving a numeric `0` on an option made it match the empty placeholder (`"" == 0`), so two options
 * rendered selected. The picked option is looked up again on change, so the model gets the option's
 * own value back — a numeric foreign key stays numeric.
 */
export function SelectField<M extends object, K extends keyof M & string>(
  props: SelectFieldProps<M, K>,
): JSX.Element {
  const id = useId()
  const current = props.vm.value[props.name]
  const selected = props.options.find((option) => String(option.value) === String(current))

  return (
    <FieldCell
      id={id}
      label={props.label}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      vl={props.vl}
      name={props.name}
      renderIssue={props.renderIssue}
      control={(wiring) => (
        <Select
          {...wiring}
          class={props.inputClass}
          options={props.options}
          placeholder={props.placeholder}
          value={selected === undefined ? "" : String(selected.value)}
          onChange={(event) => {
            const picked = props.options.find(
              (option) => String(option.value) === event.currentTarget.value,
            )
            setField(props.vm, props.name, picked === undefined ? "" : picked.value)
          }}
        />
      )}
    />
  )
}

/**
 * One labelled checkbox, on `ui`'s {@link Checkbox}: the label is the checkbox's own, after the box.
 *
 * `Field` is therefore given no `label`, so it renders none of its own: a second one would name the
 * same `<input>` twice.
 */
export function CheckboxField<M extends object, K extends keyof M & string>(
  props: FieldProps<M, K>,
): JSX.Element {
  const id = useId()
  return (
    <FieldCell
      id={id}
      span={props.span ?? defaultSpan}
      hint={props.hint}
      vl={props.vl}
      name={props.name}
      renderIssue={props.renderIssue}
      control={(wiring) => (
        <Checkbox
          {...wiring}
          class={props.inputClass}
          checked={Boolean(props.vm.value[props.name])}
          onChange={(event) => setField(props.vm, props.name, event.currentTarget.checked)}
        >
          {props.label}
        </Checkbox>
      )}
    />
  )
}
