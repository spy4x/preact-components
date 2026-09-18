/**
 * Shapes the CRUD scaffold shares.
 *
 * The pieces every list and editor needs and none of them owns: the row contract, a store
 * operation's state, the soft-delete column and the dependency list a blocked archive reports.
 * No imports — nothing here reaches for the state layer or an application singleton.
 */

/**
 * Minimum a row must have for the scaffold to manage it.
 *
 * Deliberately narrower than the state layer's `Model`: the list and the editor only ever need
 * `id` to key rows, match them and build row URLs, so a row type with an `id` satisfies this
 * without an open index signature.
 */
export interface CrudModel {
  id: number
}

/**
 * A row carrying the soft-delete column the editor toggles.
 *
 * `null` means live. A store that also allows `undefined` (a column the server omits) satisfies
 * this too, and the scaffold reads both as "not archived".
 */
export interface SoftDeletable {
  deletedAt: Date | string | null | undefined
}

/** A row the editor can load, archive and save. */
export interface CrudRow extends CrudModel, SoftDeletable {}

/**
 * An error a store operation settles with.
 *
 * Every error in the state layer carries `message`, so a real `StoreError` union satisfies this
 * without an adapter — and a test double only has to provide the one member the scaffold reads.
 */
export interface StoreErrorLike {
  message: string
}

/**
 * Status of one in-flight store operation.
 *
 * `result` is deliberately `unknown`: the scaffold never reads it, and widening it is what keeps a
 * real `OperationState<M, E>` assignable here without a cast.
 */
export interface OperationState<E = StoreErrorLike> {
  /** True between the start of a request and its settlement. */
  inProgress: boolean
  /** The payload the operation settled with; never read by the scaffold. */
  result: unknown
  /** The failure the operation settled with, or `null`. */
  error: E | null
}

/** Either a value or an error — never both, never neither. */
export type OperationResult<T, E = StoreErrorLike> =
  | { error: null; result: T }
  | { error: E; result: null }

/** Which slice of a collection a list shows. */
export type CrudStatus = "active" | "archived"

/** One row blocking a soft delete. */
export interface DeletionDependencyItem {
  /** Text of the link. */
  title: string
  /** Where the link goes so the user can archive the blocker first. */
  url: string
}

/** One entity kind blocking a soft delete, with the rows that block it. */
export interface DeletionDependency {
  /** Entity kind shown as the list heading, for example `"Zones"`. */
  kind: string
  /** The rows of that kind that block the archive. */
  values: DeletionDependencyItem[]
}
