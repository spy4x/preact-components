import { IconLoading } from "@spy4x/preact-icons"
import { ConfirmDialog } from "@spy4x/preact-ui/confirm-dialog"
import { type ReadonlySignal, type Signal, useSignal } from "@preact/signals"
import type { Type } from "arktype"
import type { ComponentChildren, JSX } from "preact"
import { timeAgo } from "@spy4x/platform/universal/time"
import { setFieldIssue, type ValidationModel } from "@spy4x/validation/model"
import { CrudEditor, type CrudEditorMode, type CrudEditorSlot } from "./crud-editor.tsx"
import type { CrudEditorStore } from "./store.ts"
import type { CrudRow, OperationResult, OperationState } from "./types.ts"

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
 * Ported from three of a source application's near-identical junction editors (215, 223 and 295
 * lines).
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
  /** Entity name in the page title, for example `"Author to book association"`. */
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
  /** Question the dialog asks before removing this row. Defaults to an English sentence. */
  confirmDelete?: string
  /** Question the dialog asks before restoring a removed row. Defaults to an English sentence. */
  confirmRestore?: string
  /** Heading of the dialog that confirms a removal. Defaults to `Delete <entity>?`. */
  confirmDeleteTitle?: string
  /** Heading of the dialog that confirms a restore. Defaults to `Restore <entity>?`. */
  confirmRestoreTitle?: string
  /** Label of both dialogs' cancelling action. Defaults to `"Cancel"`. */
  confirmCancelLabel?: string
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
    deleteLabel,
    restoreLabel,
    schema,
    title,
    onCreated,
    canChange,
    children,
    class: className,
  } = props

  const restoreWording: ConfirmWording = {
    label: restoreLabel ?? "Restore",
    title: props.confirmRestoreTitle ?? `Restore ${entity}?`,
    message: props.confirmRestore ?? `Are you sure you want to restore this ${entity}?`,
    cancelLabel: props.confirmCancelLabel,
  }
  const deleteWording: ConfirmWording = {
    label: deleteLabel ?? "Delete",
    title: props.confirmDeleteTitle ?? `Delete ${entity}?`,
    message: props.confirmDelete ?? `Are you sure you want to delete this ${entity}?`,
    cancelLabel: props.confirmCancelLabel,
  }

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
        restoreWording={restoreWording}
      />
    ),
    footerSlot: ({ vm }: CrudEditorSlot<M>) =>
      props.mode === "add" ? null : (
        <AssociationFooter
          store={store}
          vm={vm}
          deleteWording={deleteWording}
          restoreWording={restoreWording}
        />
      ),
  }

  return props.mode === "add"
    ? <CrudEditor {...shared} mode="add" />
    : <CrudEditor {...shared} mode="edit" editId={props.editId} />
}

/** The words of one confirmed action: its button, and the dialog that asks first. */
interface ConfirmWording {
  /** Label of the button, and of the dialog's confirming action. */
  label: string
  /** Heading of the dialog. */
  title: string
  /** The question the dialog asks. */
  message: string
  /** Label of the dialog's cancelling action; the dialog's own default when left out. */
  cancelLabel?: string
}

/**
 * A button that asks before it acts: it opens a `ConfirmDialog`, and only the dialog's confirming
 * action runs `run`.
 *
 * The dialog stays open, busy, while `run` is in flight and closes when it settles, so focus goes
 * back to a button that is enabled again.
 */
function ConfirmedAction(
  { wording, class: className, inProgress, danger, run }: {
    wording: ConfirmWording
    class: string
    /** The store reports the action as in flight. */
    inProgress: boolean
    /** The action destroys something: the dialog and its confirming action are tinted. */
    danger?: boolean
    run: () => Promise<unknown>
  },
) {
  const confirming = useSignal(false)
  const running = useSignal(false)
  const close = () => {
    running.value = false
    confirming.value = false
  }

  return (
    <>
      <button
        type="button"
        class={className}
        disabled={inProgress}
        onClick={() => confirming.value = true}
      >
        {inProgress && <IconLoading />}
        {wording.label}
      </button>
      {confirming.value && (
        <ConfirmDialog
          title={wording.title}
          message={wording.message}
          confirmLabel={wording.label}
          cancelLabel={wording.cancelLabel}
          tone={danger ? "danger" : "default"}
          busy={running.value}
          onConfirm={() => {
            running.value = true
            // A store reports a failure through its own operation state; either way the dialog goes.
            run().then(close, close)
          }}
          onCancel={close}
        />
      )}
    </>
  )
}

/** The restore offer for a duplicate that was removed earlier. Renders nothing otherwise. */
function RemovedConflict<M extends CrudRow>(
  { store, vm, conflict, restoreWording }: {
    store: CrudAssociationStore<M>
    vm: Signal<M>
    conflict: (row: M, rows: M[]) => M | undefined
    restoreWording: ConfirmWording
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
      <ConfirmedAction
        wording={restoreWording}
        class="btn btn-primary-outline"
        inProgress={restoring}
        run={() => actions.restore(id)}
      />
    </div>
  )
}

/** Delete this row, or restore it when it was removed earlier. Sits at the start of the footer. */
function AssociationFooter<M extends CrudRow>(
  { store, vm, deleteWording, restoreWording }: {
    store: CrudAssociationStore<M>
    vm: Signal<M>
    deleteWording: ConfirmWording
    restoreWording: ConfirmWording
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
        <ConfirmedAction
          wording={restoreWording}
          class="btn btn-primary-outline mr-auto"
          inProgress={inProgress}
          run={() => actions.restore(id)}
        />
        <span class="text-red-500 mr-auto" title={vm.value.deletedAt?.toString()}>
          Removed {timeAgo(vm.value.deletedAt)}
        </span>
      </>
    )
  }

  return (
    <ConfirmedAction
      wording={deleteWording}
      class="btn btn-danger mr-auto"
      inProgress={inProgress}
      danger
      run={() => actions.remove(id)}
    />
  )
}
