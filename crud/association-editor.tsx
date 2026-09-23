import { IconLoading } from "@preact-components/icons"
import type { ReadonlySignal, Signal } from "@preact/signals"
import type { Type } from "arktype"
import type { ComponentChildren, JSX } from "preact"
import { CrudEditor, type CrudEditorMode, type CrudEditorSlot } from "./crud-editor.tsx"
import type { CrudEditorStore } from "./store.ts"
import { timeAgo } from "./time-ago.ts"
import type { CrudRow, OperationResult, OperationState } from "./types.ts"
import { setFieldIssue, type ValidationModel } from "./validation.ts"

/**
 * The editor for a junction row, composed from {@link CrudEditor} rather than rebuilt beside it.
 *
 * An association editor differs from a validated form in three ways, and each one is a slot or a
 * port rather than a second harness:
 *
 * 1. **No validation model.** A junction row has no rules of its own, so `CrudEditor` gets no
 *    schema; its only rule arrives through the same `validate` port everything else uses.
 * 2. **A conflict instead of a dependency list.** The row that would be duplicated is reported as a
 *    validation issue on the field the user has to change, which is where the source editors put it
 *    and which blocks Save through the one rule the harness already has.
 * 3. **Removal instead of archiving.** A junction row means nothing on its own, so Delete ends it
 *    and Restore brings it back — written into `footerSlot`, since the harness only knows the soft
 *    delete that every other editor needs.
 *
 * Ported from `gb`'s `lamp-boxes/[id]/zones/(_islands)/Editor.tsx` (215 lines),
 * `schedules/[id]/zones/(_islands)/Editor.tsx` (223) and `lamp-boxes/[id]/lamps/(_islands)/Editor.tsx`
 * (295), which were near-identical to one another.
 */

/** Issue type a duplicate association is reported under. */
export const CONFLICT = "CONFLICT"

/**
 * The slice of a model store an association editor reads and writes.
 *
 * `list.all`, not `list.nonDeleted`: the duplicate the user has to be told about is often a row that
 * was removed earlier and can be restored instead of re-created. Every source editor scanned
 * `nonDeleted` and then branched on `deletedAt`, so its "you can restore the old one" branch was
 * unreachable.
 */
export interface CrudAssociationStore<M extends CrudRow, T = M> extends CrudEditorStore<M, T> {
  list: {
    /** Every row, removed ones included — that is what makes a restorable duplicate findable. */
    all: ReadonlySignal<M[]>
  }
  op: {
    create: ReadonlySignal<OperationState>
    update: (id: number) => ReadonlySignal<OperationState | undefined>
    /** Per-row removal status, for the Delete button. */
    delete: (id: number) => ReadonlySignal<OperationState | undefined>
    /** Per-row restore status, for the Restore button. */
    undelete: (id: number) => ReadonlySignal<OperationState | undefined>
  }
  /** End the row. A junction row is removed, not archived. */
  delete: (id: number) => Promise<OperationResult<M>>
  /** Bring a removed row back, so a duplicate can be repaired instead of created. */
  undelete: (id: number) => Promise<OperationResult<M>>
}

/** The two writes an association editor performs outside the form's own submit. */
export interface AssociationActions<M extends CrudRow> {
  /** End the row for good. */
  remove: (id: number) => Promise<OperationResult<M>>
  /** Bring a removed row back. */
  restore: (id: number) => Promise<OperationResult<M>>
}

/**
 * Bind the two module-level writes to a store.
 *
 * A seam rather than an inline call, for the same reason `submitEditor` is one: which store method a
 * button reaches is exactly what drifted between the source editors, and this way it is asserted
 * against a fake store without a DOM.
 */
export function associationActions<M extends CrudRow>(
  store: CrudAssociationStore<M>,
): AssociationActions<M> {
  return {
    remove: (id) => store.delete(id),
    restore: (id) => store.undelete(id),
  }
}

/** Whether a conflicting row is one that was removed and can be restored. */
export function isRestorable<M extends CrudRow>(conflicting: M | undefined): conflicting is M {
  return conflicting !== undefined && Boolean(conflicting.deletedAt)
}

/** Everything {@link conflictIssue} needs to decide. */
export interface ConflictInput<M extends CrudRow> {
  /** Every row of the collection, removed ones included. */
  rows: M[]
  /** The row that would be duplicated, or `undefined`. */
  conflict: (row: M, rows: M[]) => M | undefined
  /** Field the issue is reported on — the foreign key the user has to change. */
  field: keyof M & string
  /** Message for a live duplicate. */
  message: string
  /** Message for a duplicate that was removed earlier. */
  removedMessage: string
}

/**
 * Fold the duplicate into the validation model.
 *
 * The conflict is reported as an issue on one field rather than as a dependency list, so it lands
 * beside the control the user has to change (where the source editors put it) and disables Save
 * through the same rule every other invalid field uses. The id of the duplicate travels as the
 * issue's payload, so a field row can link straight at it.
 */
export function conflictIssue<M extends CrudRow>(
  value: M,
  vl: ValidationModel<M>,
  input: ConflictInput<M>,
): ValidationModel<M> {
  const conflicting = input.conflict(value, input.rows)
  if (conflicting === undefined) {
    return setFieldIssue(vl, input.field, CONFLICT, undefined)
  }

  return setFieldIssue(
    vl,
    input.field,
    CONFLICT,
    isRestorable(conflicting) ? input.removedMessage : input.message,
    conflicting.id,
  )
}

/** Everything an association editor needs, whatever the two entities are. */
export interface AssociationEditorBaseProps<M extends CrudRow> {
  store: CrudAssociationStore<NoInfer<M>>
  /** Model `mode="add"` starts from, with the parent's id already filled in. */
  blank: M
  /** Entity name in the page title, for example `"Lamp box to zone association"`. */
  entity: string
  /** Where Cancel points. */
  cancelHref: string
  /** Field the duplicate is reported on — the foreign key of the association. */
  conflictField: keyof NoInfer<M> & string
  /** The row this one would duplicate, if it would. */
  conflict: (row: NoInfer<M>, rows: NoInfer<M>[]) => NoInfer<M> | undefined
  /** Message for a live duplicate. */
  conflictMessage?: string
  /** Message for a duplicate that was removed earlier. */
  conflictRemovedMessage?: string
  /** Confirmation before removing this row. */
  confirmDelete?: string
  /** Confirmation before restoring a removed row. */
  confirmRestore?: string
  /** Label of the remove button. Defaults to `"Delete"`. */
  deleteLabel?: string
  /** Label of the restore button. Defaults to `"Restore"`. */
  restoreLabel?: string
  /** Schema for the row's own rules, if it has any. Usually omitted. */
  schema?: Type
  title?: ComponentChildren
  /** Called after a successful create, with the created row. Navigate from here. */
  onCreated?: (row: NoInfer<M>) => void
  /** Whether the current user may change this association. Defaults to `true`. */
  canChange?: () => boolean
  children: (slot: CrudEditorSlot<NoInfer<M>>) => ComponentChildren
  class?: string
}

/** {@link AssociationEditorBaseProps} plus the mode. */
export type AssociationEditorProps<M extends CrudRow> =
  & AssociationEditorBaseProps<M>
  & CrudEditorMode

/**
 * Add/edit form for a row that exists only to join two entities.
 *
 * Everything the validated editors have is still here — load once, validate, submit, chrome — and
 * the three differences above are wired into it.
 */
export function AssociationEditor<M extends CrudRow>(
  props: AssociationEditorProps<M>,
): JSX.Element {
  const {
    store,
    blank,
    entity,
    cancelHref,
    conflictField,
    conflict,
    conflictMessage,
    conflictRemovedMessage,
    confirmDelete,
    confirmRestore,
    deleteLabel,
    restoreLabel,
    schema,
    title,
    onCreated,
    canChange,
    children,
    class: className,
  } = props

  const shared = {
    store,
    blank,
    entity,
    cancelHref,
    schema,
    title,
    onCreated,
    canChange,
    class: className,
    children,
    validate: (value: M, vl: ValidationModel<M>) =>
      conflictIssue(value, vl, {
        rows: store.list.all.value,
        conflict,
        field: conflictField,
        message: conflictMessage ?? `This ${entity} already exists.`,
        removedMessage: conflictRemovedMessage ??
          `This ${entity} existed before and was removed.`,
      }),
    notice: ({ vm }: CrudEditorSlot<M>) => (
      <RemovedConflict
        store={store}
        vm={vm}
        conflict={conflict}
        entity={entity}
        label={restoreLabel ?? "Restore"}
        confirmRestore={confirmRestore}
      />
    ),
    footerSlot: ({ vm }: CrudEditorSlot<M>) =>
      props.mode === "add" ? null : (
        <AssociationFooter
          store={store}
          vm={vm}
          entity={entity}
          confirmDelete={confirmDelete}
          confirmRestore={confirmRestore}
          deleteLabel={deleteLabel ?? "Delete"}
          restoreLabel={restoreLabel ?? "Restore"}
        />
      ),
  }

  return props.mode === "add"
    ? <CrudEditor {...shared} mode="add" />
    : <CrudEditor {...shared} mode="edit" editId={props.editId} />
}

/** The restore offer for a duplicate that was removed earlier. Renders nothing otherwise. */
function RemovedConflict<M extends CrudRow>(
  { store, vm, conflict, entity, label, confirmRestore }: {
    store: CrudAssociationStore<M>
    vm: Signal<M>
    conflict: (row: M, rows: M[]) => M | undefined
    entity: string
    label: string
    confirmRestore?: string
  },
) {
  const conflicting = conflict(vm.value, store.list.all.value)
  if (!isRestorable(conflicting)) return null

  const id = conflicting.id
  const restoring = store.op.undelete(id).value?.inProgress === true
  const actions = associationActions(store)

  return (
    <div class="mt-4 flex items-center gap-3">
      <p class="text-sm text-red-600">
        Restoring it keeps the record that was there before instead of creating a second one.
      </p>
      <button
        type="button"
        class="btn btn-primary-outline"
        disabled={restoring}
        onClick={() =>
          confirm(confirmRestore ?? `Are you sure you want to restore this ${entity}?`) &&
          actions.restore(id)}
      >
        {restoring && <IconLoading />}
        {label}
      </button>
    </div>
  )
}

/** Delete this row, or restore it when it was removed earlier. Sits at the start of the footer. */
function AssociationFooter<M extends CrudRow>(
  { store, vm, entity, confirmDelete, confirmRestore, deleteLabel, restoreLabel }: {
    store: CrudAssociationStore<M>
    vm: Signal<M>
    entity: string
    confirmDelete?: string
    confirmRestore?: string
    deleteLabel: string
    restoreLabel: string
  },
) {
  const id = vm.value.id
  const removed = Boolean(vm.value.deletedAt)
  const inProgress = removed
    ? store.op.undelete(id).value?.inProgress === true
    : store.op.delete(id).value?.inProgress === true
  const actions = associationActions(store)

  if (removed) {
    return (
      <>
        <button
          type="button"
          class="btn btn-primary-outline mr-auto"
          disabled={inProgress}
          onClick={() =>
            confirm(confirmRestore ?? `Are you sure you want to restore this ${entity}?`) &&
            actions.restore(id)}
        >
          {inProgress && <IconLoading />}
          {restoreLabel}
        </button>
        <span class="text-red-500 mr-auto" title={vm.value.deletedAt?.toString()}>
          Removed {timeAgo(vm.value.deletedAt)}
        </span>
      </>
    )
  }

  return (
    <button
      type="button"
      class="btn btn-danger mr-auto"
      disabled={inProgress}
      onClick={() =>
        confirm(confirmDelete ?? `Are you sure you want to delete this ${entity}?`) &&
        actions.remove(id)}
    >
      {inProgress && <IconLoading />}
      {deleteLabel}
    </button>
  )
}
