import type { ReadonlySignal } from "@preact/signals"
import type {
  CrudModel,
  CrudRow,
  OperationResult,
  OperationState,
  StoreErrorLike,
} from "./types.ts"

/**
 * The store slices the scaffold reads, as structural interfaces.
 *
 * `@spy4x/preact-signals` is built in a parallel pull request, so this package does not
 * import it: a real `ModelStore` from `buildModelStore` satisfies both interfaces as written,
 * because TypeScript compares shapes rather than declared names. A follow-up that lands after
 * `signals/` should replace these with `ModelStore`-derived types and delete the duplication —
 * until then this file is the whole contract, and a test double only implements what is listed.
 *
 * Two rules hold for both interfaces:
 *
 * - `ReadonlySignal` is what the store exposes, so a `computed` from the store, a `signal` from a
 *   test, and (via the `Signal extends ReadonlySignal` relationship) a `useSignal` all satisfy it.
 * - Everything optional in the state layer stays optional here. The scaffold reads `inProgress` and
 *   `error`; `result` is typed `unknown` and never touched.
 */

/**
 * The slice `CrudList` reads.
 *
 * `list.nonDeleted` and `list.deleted` are the two status slices, and `op.list` carries the load
 * error the banner shows. `signals/`' `list.nonDeleted`/`list.deleted` are exactly these, so any
 * model store satisfies this interface unchanged.
 */
export interface CrudListStore<M extends CrudModel> {
  list: {
    /** Rows with no `deletedAt`: the Active status and the count badge. */
    nonDeleted: ReadonlySignal<M[]>
    /** Rows carrying a `deletedAt`: the Archived status. */
    deleted: ReadonlySignal<M[]>
  }
  op: {
    /** Status of the collection load; its `error` drives the banner above the table. */
    list: ReadonlySignal<OperationState>
  }
}

/**
 * The slice `CrudEditor` reads and writes.
 *
 * `T` is the payload the form submits — the base model, without the server-owned columns. It
 * defaults to the row type, which is what a store whose create and update schemas accept the whole
 * base model resolves to.
 */
export interface CrudEditorStore<M extends CrudRow, T = M> {
  one: {
    /** The row being edited, or `undefined` while the collection has not loaded it yet. */
    byId: (id: number) => ReadonlySignal<M | undefined>
  }
  op: {
    /** Status of the last create; `inProgress` disables the form. */
    create: ReadonlySignal<OperationState>
    /** Per-row update status; `inProgress` disables the form. */
    update: (id: number) => ReadonlySignal<OperationState | undefined>
  }
  /** Validate, `POST`, carry the created row back. */
  create: (data: T) => Promise<OperationResult<M>>
  /** Validate, `PATCH`, carry the updated row back. */
  update: (id: number, data: T) => Promise<OperationResult<M, StoreErrorLike>>
}
