/**
 * Picks and repeats the `e2e` block's specs for `--grep` and `--repeat` (#1224), so proving a
 * flaky spec's fix means running that one spec many times, not whole blocks.
 *
 * @module
 */

/**
 * The items whose `name` contains the text, ignoring case, in their original order.
 *
 * @param items The specs, or anything else with a name.
 * @param text What a name must contain; trimmed first.
 */
export function byName<T extends { name: string }>(items: readonly T[], text: string): T[] {
  const wanted = text.trim().toLowerCase()
  return items.filter((item) => item.name.toLowerCase().includes(wanted))
}

/**
 * Read a repeat count such as `20`.
 *
 * @returns The count, or `undefined` when the text is not a whole number of at least 1.
 */
export function parseRepeat(text: string): number | undefined {
  return /^\d+$/.test(text.trim()) && Number(text) >= 1 ? Number(text) : undefined
}

/** The whole list `times` times over: every item once, then every item again, and so on. */
export function repeated<T>(items: readonly T[], times: number): T[] {
  return Array.from({ length: times }, () => items).flat()
}
