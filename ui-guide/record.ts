/**
 * Typed iteration over a `Record` whose keys are a union.
 *
 * The demos cover a component's whole prop vocabulary by iterating a
 * `Record<Union, …>` — the record itself is the exhaustiveness guard, because a union member
 * with no entry does not compile. `Object.entries` erases the key union down to `string`, which
 * would throw that guard away at the point of use, so every demo reads its vocabulary through
 * here instead.
 */

/**
 * `Object.entries` with the key union preserved.
 *
 * @param record Any record; the keys are not widened to `string`.
 * @returns The record's entries, typed as a list of `[key, value]` pairs.
 */
export function entries<const K extends string, V>(record: Record<K, V>): Array<[K, V]> {
  return Object.entries(record) as Array<[K, V]>
}
