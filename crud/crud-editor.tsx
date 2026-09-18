import { IconLoading } from "@preact-components/icons"
import { cn } from "@preact-components/signals/cn"
import { PageTitle } from "@preact-components/ui/page-title"
import { type ReadonlySignal, type Signal, useSignal, useSignalEffect } from "@preact/signals"
import type { Type } from "arktype"
import type { ComponentChildren } from "preact"
import { useId } from "preact/hooks"
import { DeletionValidation } from "./deletion-validation.tsx"
import { setField } from "./field.tsx"
import type { CrudEditorStore } from "./store.ts"
import { formatTimestamp, timeAgo } from "./time-ago.ts"
import type { CrudRow, DeletionDependency, StoreErrorLike } from "./types.ts"
import { isValid, sameValidation, validateSchema, type ValidationModel } from "./validation.ts"

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
  /** Schema the model is validated against on every change. */
  schema: Type
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
   * Entities blocking the archive of a row.
   *
   * When given, the footer carries the archive checkbox and a non-empty list blocks Save. Omit it
   * for an editor whose entity nothing points at.
   */
  dependencies?: (row: NoInfer<M>) => DeletionDependency[]
  /** Label of the archive checkbox. Defaults to `"Is Archived?"`. */
  archiveLabel?: string
  /**
   * The form body: the editor's own field rows, one per grid cell.
   *
   * A function rather than children so the rows receive the model and validation signals directly
   * — the same contract every field row in `field.tsx` takes. Whatever cannot be expressed as a
   * field row (a schedule grid, a sensor table) is written here and gets the same harness around it.
   */
  children: (slot: CrudEditorSlot<NoInfer<M>>) => ComponentChildren
  class?: string
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
 */
export function CrudEditor<M extends CrudRow>(props: CrudEditorProps<M>) {
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
    dependencies,
    archiveLabel,
    class: className,
  } = props

  const vm = useSignal<M>(structuredClone(blank))
  const vl = useSignal<ValidationModel<M>>({})
  const initialized = useSignal(false)
  const error = useSignal("")
  const blocked = useSignal<DeletionDependency[]>([])
  const archiveId = useId()

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

  /** Schema validation plus the caller's own checks, in that order. */
  function runValidation(value: M, current: ValidationModel<M>): ValidationModel<M> {
    const next = validateSchema(schema, value, current)
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

  const state = editorState({
    initialized: initialized.value,
    validation: vl.value,
    canChange: canChange?.() ?? true,
    inProgress: props.mode === "add"
      ? store.op.create.value.inProgress
      : store.op.update(props.editId).value?.inProgress === true,
    blocked: blocked.value.length,
  })

  /**
   * Turn the soft-delete column on, or off.
   *
   * Nothing here calls `delete`: the row stays in the collection with a `deletedAt` on it, and the
   * update that carries the stamp is the one the form already submits.
   */
  function toggleArchive(): void {
    const next = toggleArchiveState(vm.value, dependencies)
    blocked.value = next.blocked
    setField(vm, "deletedAt", next.deletedAt)
  }

  async function submit(event: Event): Promise<void> {
    event.preventDefault()

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
          </div>
          {(canChange?.() ?? true) && (
            <div class="card-footer">
              {props.mode === "edit" && (
                <div class="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    id={archiveId}
                    class="checkbox"
                    checked={Boolean(vm.value.deletedAt)}
                    onChange={toggleArchive}
                  />
                  <label for={archiveId} class="label">
                    {archiveLabel ?? "Is Archived?"} {vm.value.deletedAt
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
              <button type="submit" class="btn btn-primary" disabled={!state.saveEnabled}>
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
