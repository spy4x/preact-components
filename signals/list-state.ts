import { type ReadonlySignal, signal } from "@preact/signals"
import type { OperationState } from "./types.ts"

/**
 * `@preact-components/signals/list-state` — roley's framework-agnostic `{list, operations}`
 * store, reimplemented on `@preact/signals`.
 *
 * The shape is the one proven across roley's five entity stores: a paginated collection plus a
 * two-level operation map (`operation name` → `entity id` → state). It suits collections driven
 * by websocket request/reply rather than REST, where a single `buildModelStore` call does not fit,
 * and small lists that need no schema at all.
 */

/** Paginated collection state. */
export interface ListPagination<Entity> {
  data: Entity[]
  total: number
  page: number
  perPage: number
}

/**
 * Operation state, keyed by operation name and then by entity id.
 *
 * `0` stands in for an operation that is not about one entity — a list load, a bulk action.
 */
export interface ListOperations {
  [operation: string]: Record<number, OperationState<unknown, unknown>>
}

/** The whole store value. */
export interface ListState<Entity> {
  list: ListPagination<Entity>
  operations: ListOperations
}

/**
 * A patch for a list store. Nested objects are merged into what is there, never replaced wholesale,
 * so a caller cannot drop the pagination it did not mention.
 */
export interface ListStatePatch<Entity> {
  list?: Partial<ListPagination<Entity>>
  operations?: ListOperations
}

/** A list store: the read-only state signal plus the mutations that keep it immutable. */
export interface ListStateStore<Entity> {
  /** Read-only state signal. */
  state: ReadonlySignal<ListState<Entity>>
  /** Merge a patch into the state. */
  mutate(patch: ListStatePatch<Entity>): void
  /** Merge a patch into `list`, leaving `operations` alone. */
  mutateList(patch: Partial<ListPagination<Entity>>): void
  /** Shallow-merge a patch into one entity's slot. `id` defaults to `0`. */
  mutateOperation(
    operation: string,
    patch: Partial<OperationState<unknown, unknown>>,
    id?: number,
  ): void
  /** Mark an operation as running; clears its previous error and result. */
  startOperation(operation: string, id?: number): void
  /** Settle an operation with an error and an optional result. */
  endOperation(operation: string, error: unknown, result?: unknown, id?: number): void
  /** Back to the state this store was created with. */
  reset(): void
}

/** Initial state for a list store: an empty collection, no operations. */
export function createInitialListState<Entity>(
  list: Partial<ListPagination<Entity>> = {},
  operations: ListOperations = {},
): ListState<Entity> {
  return {
    list: { data: [], total: 0, page: 0, perPage: 0, ...list },
    operations: { ...operations },
  }
}

/**
 * Create a list store.
 *
 * Every mutation copies the objects it touches, so a `computed` or an `effect` reading the state
 * sees a new reference and fires. Svelte's store contract did that for roley; signals compare by
 * reference, so here the copies are load-bearing.
 *
 * Unlike roley's version there is no `payload` on `startOperation`: an operation's state carries
 * what the operation produced (`result`), and a request payload belongs to the caller until it
 * becomes a result.
 *
 * @param initial Starting value. `list` and `operations` are merged over the empty defaults.
 *
 * @example
 * ```ts
 * const store = createListState<Transaction>({ list: { perPage: 25 } })
 * store.startOperation("load")
 * store.endOperation("load", null, transactions, 1)
 * ```
 */
export function createListState<Entity>(
  initial: ListStatePatch<Entity> = {},
): ListStateStore<Entity> {
  const state = signal<ListState<Entity>>(
    createInitialListState<Entity>(initial.list, initial.operations),
  )

  function mutate(patch: ListStatePatch<Entity>): void {
    state.value = {
      list: { ...state.value.list, ...patch.list },
      operations: { ...state.value.operations, ...patch.operations },
    }
  }

  function mutateList(patch: Partial<ListPagination<Entity>>): void {
    mutate({ list: { ...state.value.list, ...patch } })
  }

  function mutateOperation(
    operation: string,
    patch: Partial<OperationState<unknown, unknown>>,
    id = 0,
  ): void {
    const operations = state.value.operations
    mutate({
      operations: {
        ...operations,
        [operation]: {
          ...operations[operation],
          [id]: { ...operations[operation]?.[id], ...patch },
        },
      },
    })
  }

  return {
    state,
    mutate,
    mutateList,
    mutateOperation,
    startOperation(operation: string, id = 0): void {
      mutateOperation(operation, { inProgress: true, error: null, result: null }, id)
    },
    endOperation(operation: string, error: unknown, result: unknown = null, id = 0): void {
      mutateOperation(operation, { inProgress: false, error, result }, id)
    },
    reset(): void {
      // A fresh object every time: assigning the same reference twice would not notify.
      state.value = createInitialListState<Entity>(initial.list, initial.operations)
    },
  }
}
