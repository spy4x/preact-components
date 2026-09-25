import { IconLoading } from "@preact-components/icons"
import { cn } from "@preact-components/cn"
import { PageTitle } from "@preact-components/ui/page-title"
import { type ReadonlySignal, type Signal, useSignal, useSignalEffect } from "@preact/signals"
import type { Type } from "arktype"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"
import {
  type FieldIssue,
  FORM_FIELD,
  isValid,
  sameValidation,
  validateSchema,
  type ValidationModel,
} from "@spy4x/validation/model"
import { DeletionValidation } from "./deletion-validation.tsx"
import { setField } from "./field.tsx"
import type { CrudEditorStore } from "./store.ts"
import { formatTimestamp, timeAgo } from "./time-ago.ts"
import type { CrudRow, DeletionDependency, StoreErrorLike } from "./types.ts"

/**
 * The six-part editor harness, once.
 *
 * Every source editor was the same sequence — load the row from the store once, validate it on
 * every change, offer the archive toggle, submit through the store, reload the row, and render a
 * page title, a card, a footer and the dependency list — with a different field list in the middle.
 * The field list is the `children` slot; everything around it is here. Nothing about the entity is
 * hardcoded, so an editor is its schema plus its fields.
 */

/** Whether the form validates, whether it is busy, and whether Save is live. */
export interface EditorState {
  /** The form is initialised and carries no issue. */
  valid: boolean
  /** The user may not change the entity, or a request is in flight. */
  busy: boolean
  /** Save is enabled: valid, not busy, and nothing blocks the archive. */
  saveEnabled: boolean
}

/** What {@link editorState} derives its answer from. */
export interface EditorStateInput<M extends object> {
  /** Whether the model has been loaded from the store. */
  initialized: boolean
  /** The current validation model. */
  validation: ValidationModel<M>
  /** Whether the current user may change this entity. */
  canChange: boolean
  /** Whether the create or update request is in flight. */
  inProgress: boolean
  /** How many entities block the archive. */
  blocked: number
}

/**
 * Derive the form's chrome from the store's state.
 *
 * Split out of the component so the save-enabled rule is testable without a DOM: a form is only
 * savable once it has been initialised — an editor whose row has not loaded is not an empty row,
 * it is a form nobody has seen yet.
 */
export function editorState<M extends object>(input: EditorStateInput<M>): EditorState {
  const valid = input.initialized && isValid(input.validation)
  const busy = !input.canChange || input.inProgress
  return { valid, busy, saveEnabled: valid && !busy && input.blocked === 0 }
}

/** The store slice a submit writes through. */
export type CrudSubmitStore<M extends CrudRow> = Pick<CrudEditorStore<M>, "create" | "update">

/** What {@link submitEditor} decided. */
export interface CrudSubmitOutcome<M extends CrudRow> {
  /** The row a create returned, so the caller can navigate to it. */
  created: M | null
  /** Whether a row was updated — the caller then reloads the form from the store. */
  updated: boolean
  /** The failure, when the store reported one. */
  error: StoreErrorLike | null
}

/** A submit, narrowed by mode: an edit has an id to patch, an add does not. */
export type CrudSubmitInput<M extends CrudRow> =
  | { mode: "add"; store: CrudSubmitStore<M>; value: M }
  | {
    mode: "edit"
    id: number
    store: CrudSubmitStore<M>
    value: M
    /** How many entities block the archive. A blocked edit is not submitted at all. */
    blocked?: number
  }

/**
 * Route a submit to the store operation the mode implies.
 *
 * Split out of the component so the routing is testable against a fake store: an add creates and
 * hands the new row back for navigation, an edit patches and asks for a reload, and an edit whose
 * archive is blocked writes nothing. A store failure is returned, never thrown — the store already
 * reported it through its own operation state and the toast port.
 */
export async function submitEditor<M extends CrudRow>(
  input: CrudSubmitInput<M>,
): Promise<CrudSubmitOutcome<M>> {
  if (input.mode === "add") {
    const outcome = await input.store.create(input.value)
    return outcome.error === null
      ? { created: outcome.result, updated: false, error: null }
      : { created: null, updated: false, error: outcome.error }
  }

  if ((input.blocked ?? 0) > 0) return { created: null, updated: false, error: null }

  const outcome = await input.store.update(input.id, input.value)
  return outcome.error === null
    ? { created: null, updated: true, error: null }
    : { created: null, updated: false, error: outcome.error }
}

/** What the archive toggle changes: the soft-delete column, and what blocks it. */
export interface ArchiveToggleState {
  /** The next value of `deletedAt`: a fresh instant, or `null` when un-archiving. */
  deletedAt: Date | null
  /** Entities blocking the archive; empty when un-archiving. */
  blocked: DeletionDependency[]
}

/**
 * The archive toggle's next state.
 *
 * Archiving asks what still points at the row before it stamps it, because a row whose children
 * would be orphaned is not archived at all; un-archiving clears the list. Either way the row keeps
 * its place in the collection — this is a soft delete, expressed as a field of the update the form
 * submits, so the scaffold never issues a `DELETE`.
 */
export function toggleArchiveState<M extends CrudRow>(
  row: M,
  dependencies?: (row: NoInfer<M>) => DeletionDependency[],
): ArchiveToggleState {
  if (row.deletedAt) return { deletedAt: null, blocked: [] }
  return { deletedAt: new Date(), blocked: dependencies?.(row) ?? [] }
}

/** What the form body receives: the model signal to write, the validation signal to read. */
export interface CrudEditorSlot<M extends CrudRow> {
  /** Model signal the field rows read and write. */
  vm: Signal<M>
  /** Validation model signal the field rows show issues from. */
  vl: ReadonlySignal<ValidationModel<M>>
}

/** Which mode the editor is in. `editId` is required exactly when the mode is `"edit"`. */
export type CrudEditorMode =
  | { mode: "add"; editId?: undefined }
  | { mode: "edit"; editId: number }

/**
 * Everything a CRUD editor needs, whatever it is editing.
 *
 * The row type is inferred from `blank` alone: every other mention of `M` is wrapped in `NoInfer`,
 * because a store's `create` and a field row's `vm` are inference sites too, and TypeScript would
 * otherwise give up and settle on the `CrudRow` constraint rather than the caller's row.
 */
export interface CrudEditorBaseProps<M extends CrudRow> {
  /** Store the row is read from and written back to. */
  store: CrudEditorStore<NoInfer<M>>
  /**
   * Model `mode="add"` starts from.
   *
   * The whole row, including the server-owned columns: the store's create schema ignores them, and
   * the archive toggle and the dependency lookup read `deletedAt` and `id` from the same signal.
   */
  blank: M
  /**
   * Schema the model is validated against on every change.
   *
   * Omit it for a form with nothing to validate — an association row has no rules of its own — and
   * only the caller's own `validate` port runs.
   */
  schema?: Type
  /** Entity name in the page title and the "not found" message, for example `"Region"`. */
  entity: string
  /** Full page title. Defaults to `Add <entity>` or `Edit <entity>`. */
  title?: ComponentChildren
  /** Where Cancel points. */
  cancelHref: string
  /** Label of the Cancel link. Defaults to `"Cancel"`. */
  cancelLabel?: string
  /** Called after a successful create, with the created row. Navigate from here. */
  onCreated?: (row: NoInfer<M>) => void
  /** Whether the current user may change this entity. Defaults to `true`; `false` renders a read-only form. */
  canChange?: () => boolean
  /**
   * Extra validation, run after the schema on every change.
   *
   * Domain checks belong here — a value that must be unique, a foreign key that points at an
   * archived row. Reading signals inside it is what makes the editor re-validate when those rows
   * load, so a check against a not-yet-loaded collection fixes itself.
   */
  validate?: (
    value: NoInfer<M>,
    vl: ValidationModel<NoInfer<M>>,
  ) => ValidationModel<NoInfer<M>>
  /**
   * The archive toggle, for a row that is archived rather than removed.
   *
   * Omit it and the form has no toggle at all — which is what a junction row wants, since a
   * relation between two entities has no life of its own to keep. Passing the object is what turns
   * the toggle on, so an editor whose entity nothing points at still archives.
   */
  archive?: ArchiveConfig<NoInfer<M>>
  /**
   * The form body: the editor's own field rows, one per grid cell.
   *
   * A function rather than children so the rows receive the model and validation signals directly
   * — the same contract every field row in `field.tsx` takes. Whatever cannot be expressed as a
   * field row (a schedule grid, a nested table) is written here and gets the same harness around it.
   */
  children: (slot: CrudEditorSlot<NoInfer<M>>) => ComponentChildren
  /**
   * Content between the field grid and the footer: a conflict notice, a warning, a hint.
   *
   * A function of the editor's context like `children`, so a component wrapping this one can read
   * the model — which is what an association editor needs in order to notice a duplicate. The
   * caller keeps the explanation; the scaffold only reserves the slot.
   */
  notice?: (slot: CrudEditorSlot<NoInfer<M>>) => ComponentChildren
  /**
   * Content at the start of the footer, before Cancel and Save. A function of the editor's context,
   * like `children`.
   *
   * Where an operation the scaffold does not perform belongs — an association editor's Delete and
   * Restore, which end a row instead of archiving it.
   */
  footerSlot?: (slot: CrudEditorSlot<NoInfer<M>>) => ComponentChildren
  class?: string
}

/**
 * The archive toggle: a checkbox in the footer that stamps `deletedAt` through the update the form
 * already submits, plus whatever has to be archived first for it to be allowed.
 */
export interface ArchiveConfig<M extends CrudRow> {
  /** Label of the checkbox. Defaults to `"Is Archived?"`. */
  label?: string
  /**
   * Entities blocking the archive of a row. A non-empty answer disables Save and is listed under
   * the form. Omit it when nothing can block the archive.
   */
  dependencies?: (row: M) => DeletionDependency[]
}

/** {@link CrudEditorBaseProps} plus the mode. */
export type CrudEditorProps<M extends CrudRow> = CrudEditorBaseProps<M> & CrudEditorMode

/**
 * Add/edit form for one row of a collection.
 *
 * Add and edit differ in exactly three places: where the starting model comes from, which operation
 * the busy flag watches, and what happens after a successful submit. Everything else — the
 * validation loop, the archive toggle, the soft delete that is an update and never a `DELETE`, the
 * blocking-dependency list — is shared.
 *
 * One issue type has no field row to appear beside: a `schema` rule that compares two fields, or a
 * value arktype rejects before it becomes an object. `validateSchema` files that under
 * {@link FORM_FIELD}, and this is where it is shown — a live region above Save, present on
 * every render (empty until such an issue arrives, the same "created once, filled later" shape
 * `Combobox` uses, so assistive technology announces the message rather than staying silent about a
 * region that arrived with its text already inside it) and always named by Save's
 * `aria-describedby`, so a screen-reader user who lands on the disabled button — Tab skips it, but
 * browse mode does not — is told why. An issue here always fails {@link isValid}, the same as any
 * field's.
 */
export function CrudEditor<M extends CrudRow>(props: CrudEditorProps<M>): JSX.Element {
  const {
    store,
    blank,
    schema,
    entity,
    title,
    cancelHref,
    cancelLabel,
    onCreated,
    canChange,
    validate,
    archive,
    class: className,
  } = props

  const vm = useSignal<M>(structuredClone(blank))
  const vl = useSignal<ValidationModel<M>>({})
  const initialized = useSignal(false)
  const error = useSignal("")
  const blocked = useSignal<DeletionDependency[]>([])
  const archiveId = useId()
  const formIssueId = useId()

  /** Copy the row out of the store into the form. Runs once, and again after a successful update. */
  function loadFromStore(): void {
    if (props.mode === "add") {
      initialized.value = true
      return
    }

    const row = store.one.byId(props.editId).value
    if (row === undefined) {
      error.value = `${entity} not found`
      return
    }

    // Cloned, because the form mutates what it holds: an edit that was never submitted must not
    // reach the store the rest of the page reads from.
    vm.value = structuredClone(row)
    error.value = ""
    initialized.value = true
  }

  /** Schema validation plus the caller's own checks, in that order. Either may be absent. */
  function runValidation(value: M, current: ValidationModel<M>): ValidationModel<M> {
    const next = schema === undefined ? current : validateSchema(schema, value, current)
    return validate?.(value, next) ?? next
  }

  // Load once. `one.byId` is a computed over the collection, so a row that has not arrived yet
  // re-runs this effect when it does — the editor does not need the caller to wait for a load.
  useSignalEffect(() => {
    if (!initialized.value) loadFromStore()
  })

  useSignalEffect(() => {
    if (!initialized.value) return
    const current = vl.peek()
    const next = runValidation(vm.value, current)
    if (!sameValidation(next, current)) vl.value = next
  })

  /**
   * Read one signal through whichever accessor the caller wants — `.value` for the render below,
   * where subscribing is the point, and `.peek()` for `readyToSave`'s guard, an event handler where
   * it is not. Anything with both accessors works: `Signal` and `ReadonlySignal` both qualify.
   */
  interface Readable<T> {
    readonly value: T
    peek(): T
  }

  /**
   * `editorState`'s five inputs, gathered once through `read` rather than written out twice.
   *
   * The render reads through `.value` and `readyToSave` through `.peek()`; building both from this
   * one function means an input's derivation (`inProgress`, say) cannot change in one path and not
   * the other.
   */
  function editorStateInput(read: <T>(signal: Readable<T>) => T): EditorStateInput<M> {
    return {
      initialized: read(initialized),
      validation: read(vl),
      canChange: canChange?.() ?? true,
      inProgress: props.mode === "add"
        ? read(store.op.create).inProgress
        : read(store.op.update(props.editId))?.inProgress === true,
      blocked: read(blocked).length,
    }
  }

  const state = editorState(editorStateInput((signal) => signal.value))

  // An issue with no field of its own — a cross-field `.narrow`, or a value that was never an
  // object — is filed under `FORM_FIELD` rather than on one of the rows `children` renders, so
  // there is no field row to show it next to. This is the one place it is shown.
  const formIssue = vl.value[FORM_FIELD]
  const formMessages = formIssue === undefined
    ? []
    : Object.values(formIssue).filter((issue): issue is FieldIssue => issue !== undefined)

  /**
   * Turn the soft-delete column on, or off.
   *
   * Nothing here calls `delete`: the row stays in the collection with a `deletedAt` on it, and the
   * update that carries the stamp is the one the form already submits.
   */
  function toggleArchive(): void {
    const next = toggleArchiveState(vm.value, archive?.dependencies)
    blocked.value = next.blocked
    setField(vm, "deletedAt", next.deletedAt)
  }

  /**
   * Whether the form may be saved right now, read straight off the signals rather than off `state`
   * above.
   *
   * `state` is a value closed over by the render that created this `submit` function, and the
   * button's own `disabled` attribute is the only thing that ever kept an invalid form from reaching
   * this function — nothing inside it checked. A click on that disabled button never fires, and
   * Enter is refused by the browser's own implicit-submission rule while no button is enabled, but a
   * script that calls `form.requestSubmit()` or dispatches a `submit` event bypasses both and still
   * reached `store.create`/`store.update` with data the validation model had just rejected.
   *
   * `.peek()` here, not `.value`: this runs inside an event handler, outside any effect or computed,
   * so either accessor would track nothing regardless — `.peek()` is chosen only to say so, so a
   * reader does not have to work out whether the difference matters here.
   */
  function readyToSave(): boolean {
    return editorState(editorStateInput((signal) => signal.peek())).saveEnabled
  }

  async function submit(event: Event): Promise<void> {
    event.preventDefault()
    if (!readyToSave()) return

    const outcome = props.mode === "add"
      ? await submitEditor({ mode: "add", store, value: vm.value })
      : await submitEditor({
        mode: "edit",
        id: props.editId,
        store,
        value: vm.value,
        blocked: blocked.value.length,
      })

    if (outcome.created !== null) onCreated?.(outcome.created)
    if (outcome.updated) loadFromStore()
  }

  return (
    <section class={cn("page-layout", className)}>
      <PageTitle>
        {title ?? (props.mode === "add" ? `Add ${entity}` : `Edit ${entity}`)}
      </PageTitle>
      {error.value !== "" && <p class="text-red-700">{error.value}</p>}

      <form class="card" onSubmit={submit}>
        <fieldset disabled={state.busy}>
          <div class="card-body">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              {props.children({ vm, vl })}
            </div>
            {props.notice?.({ vm, vl })}
            {
              /*
              The form-level live region, rendered on every render and empty until an issue with no
              field of its own arrives — the same shape `Combobox` and `Toastr` use: a region created
              together with its text announces nothing, because assistive technology announces a
              *change* to a region it is already watching, so the empty container has to exist first
              and gain its text on a later render. `aria-describedby` on Save points here always, not
              only while a message is present, so the association never has to be added and removed.
            */
            }
            <div id={formIssueId} role="status" aria-live="polite" aria-atomic="true">
              {formMessages.map((issue, index) => (
                <p key={index} class="text-sm text-red-700 mt-2">{issue.message}</p>
              ))}
            </div>
          </div>
          {(canChange?.() ?? true) && (
            <div class="card-footer">
              {props.footerSlot?.({ vm, vl })}
              {props.mode === "edit" && archive !== undefined && (
                <div class="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    id={archiveId}
                    class="checkbox"
                    checked={Boolean(vm.value.deletedAt)}
                    onChange={toggleArchive}
                  />
                  <label for={archiveId} class="label">
                    {archive.label ?? "Is Archived?"} {vm.value.deletedAt
                      ? (
                        <span
                          title={formatTimestamp(vm.value.deletedAt, { full: true })}
                          class="text-red-500"
                        >
                          ({timeAgo(vm.value.deletedAt)})
                        </span>
                      )
                      : ""}
                  </label>
                </div>
              )}

              <a href={cancelHref} class="btn btn-link ml-auto">{cancelLabel ?? "Cancel"}</a>
              <button
                type="submit"
                class="btn btn-primary"
                aria-describedby={formIssueId}
                disabled={!state.saveEnabled}
              >
                {state.busy && <IconLoading />}
                Save
              </button>
            </div>
          )}
        </fieldset>
      </form>

      <DeletionValidation dependencies={blocked.value} model={entity} />
    </section>
  )
}
