import { IconLoading } from "@spy4x/preact-icons"
import { ConfirmDialog } from "@spy4x/preact-ui/confirm-dialog"
import { ErrorState } from "@spy4x/preact-ui/error-state"
import { Stack } from "@spy4x/preact-ui/layout"
import { type ReadonlySignal, type Signal, useSignal } from "@preact/signals"
import type { Type } from "arktype"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { formatTime, timeAgo } from "@spy4x/platform/universal/time"
import { setFieldIssue, type ValidationModel } from "@spy4x/validation/model"
import {
  CrudEditor,
  type CrudEditorBaseProps,
  type CrudEditorMode,
  type CrudEditorSlot,
} from "./crud-editor.tsx"
import { setField } from "./field.tsx"
import type { CrudEditorStore } from "./store.ts"
import type { CrudRow, OperationResult, OperationState, StoreErrorLike } from "./types.ts"

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
 *    delete that every other editor needs. A removal or a restore the store refuses, or one that
 *    throws, is shown in the dialog that asked, in the library's `ErrorState`, which takes focus;
 *    one that succeeds is copied into the form, so the footer offers the opposite action at once.
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
    update: (id: string | number) => ReadonlySignal<OperationState | undefined>
    /** Per-row removal status, for the Delete button. */
    delete: (id: string | number) => ReadonlySignal<OperationState | undefined>
    /** Per-row restore status, for the Restore button. */
    undelete: (id: string | number) => ReadonlySignal<OperationState | undefined>
  }
  /** End the row. A junction row is removed, not archived. */
  delete: (id: string | number) => Promise<OperationResult<M>>
  /** Bring a removed row back, so a duplicate can be repaired instead of created. */
  undelete: (id: string | number) => Promise<OperationResult<M>>
}

/** The two writes an association editor performs outside the form's own submit. */
export interface AssociationActions<M extends CrudRow> {
  /** End the row for good. */
  remove: (id: string | number) => Promise<OperationResult<M>>
  /** Bring a removed row back. */
  restore: (id: string | number) => Promise<OperationResult<M>>
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
 * through the same rule every other invalid field uses. A numeric id of the duplicate travels as
 * the issue's payload, so a field row can link straight at it; a string id does not yet, because
 * `@spy4x/validation` types the payload as a number.
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
    // `@spy4x/validation` types an issue's payload as a number, so a string id cannot travel yet
    // and the issue carries no payload. It moves unchanged once that type widens (ts-libs#678).
    typeof conflicting.id === "number" ? conflicting.id : undefined,
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
  /** Name of the cross in both dialogs' corner. Defaults to `"Close"`. */
  confirmCloseLabel?: string
  /** Label of the remove button. Defaults to `"Delete"`. */
  deleteLabel?: string
  /** Label of the restore button. Defaults to `"Restore"`. */
  restoreLabel?: string
  /**
   * What a failed removal is introduced with, before the store's own message. Defaults to
   * `"Could not delete"`.
   */
  deleteErrorLabel?: string
  /**
   * What a failed restore is introduced with, before the store's own message. Defaults to
   * `"Could not restore"`.
   */
  restoreErrorLabel?: string
  /**
   * The line beside Restore on a removed row, given how long ago it was removed (`"2 days ago"`).
   * Defaults to `` (ago) => `Removed ${ago}` ``. A function, because where the time falls in the
   * sentence is the translator's business.
   */
  removedLabel?: (ago: string) => string
  /**
   * The sentence beside the offer to restore a removed duplicate. Defaults to an English sentence.
   */
  restoreHint?: string
  /** Label of the Cancel link. Defaults to `"Cancel"`. */
  cancelLabel?: string
  /** Label of the Save button. Defaults to `"Save"`. */
  saveLabel?: string
  /** What a failed save is introduced with. Defaults to `"Could not save"`. */
  saveErrorLabel?: string
  /** Shown when `mode="edit"` names a row the store does not hold. Defaults to `<entity> not found`. */
  notFoundLabel?: string
  /** Level of the title's heading, `<h1>` to `<h6>`. Defaults to `1`. */
  headingLevel?: CrudEditorBaseProps<M>["headingLevel"]
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
    errorLabel: props.restoreErrorLabel ?? "Could not restore",
    title: props.confirmRestoreTitle ?? `Restore ${entity}?`,
    message: props.confirmRestore ?? `Are you sure you want to restore this ${entity}?`,
    cancelLabel: props.confirmCancelLabel,
    closeLabel: props.confirmCloseLabel,
  }
  const deleteWording: ConfirmWording = {
    label: deleteLabel ?? "Delete",
    errorLabel: props.deleteErrorLabel ?? "Could not delete",
    title: props.confirmDeleteTitle ?? `Delete ${entity}?`,
    message: props.confirmDelete ?? `Are you sure you want to delete this ${entity}?`,
    cancelLabel: props.confirmCancelLabel,
    closeLabel: props.confirmCloseLabel,
  }

  const shared = {
    store,
    blank,
    entity,
    cancelHref,
    schema,
    title,
    headingLevel: props.headingLevel,
    cancelLabel: props.cancelLabel,
    saveLabel: props.saveLabel,
    saveErrorLabel: props.saveErrorLabel,
    notFoundLabel: props.notFoundLabel,
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
        hint={props.restoreHint}
        canChange={canChange}
      />
    ),
    footerSlot: ({ vm }: CrudEditorSlot<M>) =>
      props.mode === "add" ? null : (
        <AssociationFooter
          store={store}
          vm={vm}
          deleteWording={deleteWording}
          restoreWording={restoreWording}
          removedLabel={props.removedLabel}
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
  /** What a failure is introduced with, before the store's own message. */
  errorLabel: string
  /** Name of the cross in the dialog's corner; the dialog's own default when left out. */
  closeLabel?: string
}

/** What a store's removal or restore answers with, as far as the dialog reads it. */
type ActionOutcome = { error: StoreErrorLike | null } | null | undefined

/**
 * A button that asks before it acts: it opens a `ConfirmDialog`, and only the dialog's confirming
 * action runs `run`.
 *
 * The dialog stays open, busy, while `run` is in flight. When the store answers without an error it
 * closes, so focus goes back to a button that is enabled again. When the store refuses, or throws,
 * the dialog stays and shows why in an `ErrorState`, a `role="alert"` that takes focus, so the
 * person is told and can try again or leave. A store that throws is logged as well, so the app's
 * error reporting still sees it.
 */
function ConfirmedAction(
  { wording, class: className, inProgress, danger, run }: {
    wording: ConfirmWording
    class: string
    /** The store reports the action as in flight. */
    inProgress: boolean
    /** The action destroys something: the dialog and its confirming action are tinted. */
    danger?: boolean
    run: () => Promise<ActionOutcome>
  },
) {
  const confirming = useSignal(false)
  const running = useSignal(false)
  const failure = useSignal("")
  const close = () => {
    running.value = false
    failure.value = ""
    confirming.value = false
  }
  const fail = (message: string) => {
    running.value = false
    failure.value = message ? `${wording.errorLabel}: ${message}` : wording.errorLabel
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
          confirmLabel={wording.label}
          cancelLabel={wording.cancelLabel}
          closeLabel={wording.closeLabel}
          tone={danger ? "danger" : "default"}
          busy={running.value}
          onConfirm={() => {
            running.value = true
            // Cleared first, so the same refusal twice in a row is a new message: it is announced
            // and takes focus again.
            failure.value = ""
            Promise.resolve().then(run).then(
              (outcome) => outcome?.error ? fail(outcome.error.message) : close(),
              (error) => {
                console.error(`${wording.label} failed`, error)
                fail(error instanceof Error ? error.message : String(error))
              },
            )
          }}
          onCancel={close}
        >
          <Stack>
            <p class="text-sm text-muted">{wording.message}</p>
            <ErrorState focusOnAppear message={failure.value} class="mx-0 max-w-none text-left" />
          </Stack>
        </ConfirmDialog>
      )}
    </>
  )
}

/**
 * The restore offer for a duplicate that was removed earlier. Renders nothing otherwise.
 *
 * A restore that succeeds takes the offer away, and with it the button that had focus. Focus then
 * goes to the form's first invalid control: the restored row is now a live duplicate, so that is
 * the field it is reported on, which the person has to change next. A field row marks itself with
 * `aria-invalid`; a caller's own control that does not keeps the browser's default.
 */
function RemovedConflict<M extends CrudRow>(
  { store, vm, conflict, restoreWording, hint, canChange }: {
    store: CrudAssociationStore<M>
    vm: Signal<M>
    conflict: (row: M, rows: M[]) => M | undefined
    restoreWording: ConfirmWording
    hint?: string
    /** The editor's own port: a viewer it refuses gets no Restore offer, as no Delete either. */
    canChange?: () => boolean
  },
) {
  const offer = useRef<HTMLDivElement>(null)
  // The form a restore is running in, kept until the offer has gone and focus can move.
  // A signal read with `peek`, so writing it never re-renders.
  const restoredIn = useSignal<HTMLFormElement | null>(null)
  const conflicting = conflict(vm.value, store.list.all.value)
  const restorable = isRestorable(conflicting)

  useEffect(() => {
    const form = restoredIn.peek()
    if (restorable || form === null) return
    restoredIn.value = null
    form.querySelector<HTMLElement>(`[aria-invalid="true"]`)?.focus()
  }, [restorable])

  if (!isRestorable(conflicting) || !(canChange?.() ?? true)) return null

  const id = conflicting.id
  const restoring = store.op.undelete(id).value?.inProgress === true
  const actions = associationActions(store)

  return (
    <div ref={offer} class="mt-4 flex items-center gap-3">
      <p class="text-sm text-danger">
        {hint ??
          "Restoring it keeps the record that was there before instead of creating a second one."}
      </p>
      <ConfirmedAction
        wording={restoreWording}
        class="btn btn-primary-outline"
        inProgress={restoring}
        run={async () => {
          // Noted before the store is asked, not after it answers: the store's own write can
          // take the offer away before this function resumes, and the effect above would then
          // find nothing to move focus in.
          restoredIn.value = offer.current?.closest("form") ?? null
          try {
            const outcome = await actions.restore(id)
            if (outcome.error !== null) restoredIn.value = null
            return outcome
          } catch (error) {
            restoredIn.value = null
            throw error
          }
        }}
      />
    </div>
  )
}

/**
 * Delete this row, or restore it when it was removed earlier. Sits at the start of the footer.
 *
 * The form holds its own copy of the row, so a removal or a restore that succeeds is written into
 * that copy: the footer then offers the opposite action, and a later Save does not send the old
 * `deletedAt` back. One button serves both actions, so focus returns to it when the dialog closes.
 */
function AssociationFooter<M extends CrudRow>(
  { store, vm, deleteWording, restoreWording, removedLabel }: {
    store: CrudAssociationStore<M>
    vm: Signal<M>
    deleteWording: ConfirmWording
    restoreWording: ConfirmWording
    removedLabel?: (ago: string) => string
  },
) {
  const id = vm.value.id
  const removed = Boolean(vm.value.deletedAt)
  const inProgress = removed
    ? store.op.undelete(id).value?.inProgress === true
    : store.op.delete(id).value?.inProgress === true
  const actions = associationActions(store)
  const ago = timeAgo(vm.value.deletedAt)

  return (
    <>
      <ConfirmedAction
        wording={removed ? restoreWording : deleteWording}
        class={removed ? "btn btn-primary-outline mr-auto" : "btn btn-danger mr-auto"}
        inProgress={inProgress}
        danger={!removed}
        run={async () => {
          const outcome = removed ? await actions.restore(id) : await actions.remove(id)
          if (outcome.error === null) {
            setField(vm, "deletedAt", removed ? null : outcome.result.deletedAt ?? new Date())
          }
          return outcome
        }}
      />
      {removed && (
        <span class="text-danger mr-auto" title={formatTime(vm.value.deletedAt, { full: true })}>
          {removedLabel?.(ago) ?? `Removed ${ago}`}
        </span>
      )}
    </>
  )
}
