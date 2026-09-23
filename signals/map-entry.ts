/**
 * Immutable writes for the `Map`s a store keeps its per-row operation state in.
 *
 * The original source application's code did `store.value.updateOps.set(id, …)` before handing the
 * result to a signals setter. `Map.set` returns the *same* Map instance, so the
 * signal's old and new values were reference-equal after a spread — consumers that
 * compared identity saw no change, and one other module mutated outright with no
 * setter at all. Copying first costs one allocation per operation and makes every
 * write observable.
 */

/** Return a copy of `map` with `key` set to `value`. The input is never mutated. */
export function setMapEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> {
  const next = new Map(map)
  next.set(key, value)
  return next
}

/** Return a copy of `map` without `key`. The input is never mutated. */
export function deleteMapEntry<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  const next = new Map(map)
  next.delete(key)
  return next
}
