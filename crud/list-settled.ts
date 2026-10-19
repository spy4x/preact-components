import type { OperationState } from "./types.ts"

/**
 * Whether a collection load has settled with a result.
 *
 * `inProgress` alone does not say so: a store that fills its collection from a pushed list, as
 * `buildModelStore` does, never sets it, and before the first rows arrive its `op.list` is the same
 * `{ inProgress: false, error: null }` as after an empty answer. Only `result` tells the two apart.
 * Not exported from the package: `CrudList` and `CrudEditor` share it.
 */
export function listSettled(load: OperationState): boolean {
  return !load.inProgress && load.result !== null && load.result !== undefined
}
