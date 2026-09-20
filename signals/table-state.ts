/**
 * `@preact-components/signals/table-state` — framework-free multi-column sort state.
 *
 * Ported from `warthunder-stats/libs/client/preact/table-state.ts`. Nothing here touches signals,
 * Preact or the DOM: the rules are plain data, so the same code backs a URL parameter, a signal or
 * a server-rendered table.
 */

/** Sort direction of one rule. */
export type SortDirection = "asc" | "desc"

/** One column in the sort order. The first rule is the primary sort. */
export interface SortRule<K extends string = string> {
  key: K
  direction: SortDirection
}

/**
 * Advance one column through `asc` → `desc` → `off`.
 *
 * A column not yet sorted is appended as the least significant rule, so the priorities a user has
 * already built up are preserved.
 */
export function toggleSort<K extends string>(rules: SortRule<K>[], key: K): SortRule<K>[] {
  const index = rules.findIndex((rule) => rule.key === key)
  if (index === -1) return [...rules, { key, direction: "asc" }]

  const current = rules[index]
  if (current.direction === "asc") {
    return rules.map((rule, ruleIndex) =>
      ruleIndex === index ? { ...rule, direction: "desc" } : rule
    )
  }
  return rules.filter((_, ruleIndex) => ruleIndex !== index)
}

/** Removes one sort priority while preserving all remaining priorities. */
export function removeSortRule<K extends string>(rules: SortRule<K>[], key: K): SortRule<K>[] {
  return rules.filter((rule) => rule.key !== key)
}

/**
 * Whether a cell holds nothing a reader would call a value.
 *
 * `null`, `undefined`, the empty string and `NaN` are the four ways a column ends up with a blank
 * cell, and a table shows all four the same way. `0` and `false` are values and are not empty.
 */
function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === "" ||
    (typeof value === "number" && Number.isNaN(value))
}

/** Compare two strings the way a column of text sorts: case-insensitive, `"item 2"` before `"item 10"`. */
function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" })
}

/**
 * Compare two non-empty cells, never returning `NaN`.
 *
 * Two strings compare as text. Anything else compares numerically, and a pair that has no numeric
 * difference — a string against a number, an object against anything — falls back to comparing the
 * two values written out, so the comparator stays total whatever a row holds.
 */
function compareCells(left: unknown, right: unknown): number {
  if (typeof left === "string" && typeof right === "string") return compareText(left, right)
  const difference = Number(left) - Number(right)
  return Number.isNaN(difference) ? compareText(String(left), String(right)) : difference
}

/**
 * Sort rows by every rule in order.
 *
 * Strings compare with `localeCompare` at numeric granularity (`"item 2"` before `"item 10"`),
 * everything else numerically. Rows that tie on every rule keep their input order, so the sort is
 * stable and a re-render never shuffles equal rows.
 *
 * **An empty cell sorts last in both directions** — `null`, `undefined`, `""` and `NaN` — because
 * that is where a reader looks for the rows a column says nothing about, whichever way the column
 * is pointing. Two empty cells tie, so the next rule decides. Comparing them arithmetically is what
 * produced `NaN` from `Number(undefined)`, and a comparator that returns `NaN` leaves the array in
 * its input order: one blank cell used to stop the whole column sorting.
 */
export function sortRows<T, K extends Extract<keyof T, string>>(
  rows: T[],
  rules: SortRule<K>[],
): T[] {
  return rows.map((row, index) => ({ row, index })).sort((a, b) => {
    for (const rule of rules) {
      const left = a.row[rule.key]
      const right = b.row[rule.key]
      const leftEmpty = isEmptyCell(left)
      const rightEmpty = isEmptyCell(right)
      // Returned before the direction is applied: empty last means last either way.
      if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1
      if (leftEmpty) continue
      const result = compareCells(left, right)
      if (result !== 0) return rule.direction === "asc" ? result : -result
    }
    return a.index - b.index
  }).map(({ row }) => row)
}

/**
 * Read sort rules out of a URL parameter.
 *
 * Accepts `"key:dir,key:dir"`. Unknown keys, repeated keys and invalid directions are dropped
 * rather than rejected, so an old bookmark degrades to the rules it can still honour. `"none"`
 * means the user turned sorting off and stays off; an empty value means "not in the URL yet" and
 * yields `fallback`.
 */
export function parseSort<K extends string>(
  value: string | null,
  allowed: readonly K[],
  fallback: SortRule<K>[],
): SortRule<K>[] {
  if (value === "none") return []
  if (!value) return fallback
  const allowedSet = new Set<string>(allowed)
  const seen = new Set<string>()
  const rules: SortRule<K>[] = []
  for (const part of value.split(",")) {
    const [key, direction] = part.split(":")
    if (!allowedSet.has(key) || seen.has(key) || !["asc", "desc"].includes(direction)) continue
    seen.add(key)
    rules.push({ key: key as K, direction: direction as SortDirection })
  }
  return rules.length > 0 ? rules : fallback
}

/** Write sort rules into a URL parameter. No rules serializes to `"none"`, not to `""`. */
export function serializeSort<K extends string>(rules: SortRule<K>[]): string {
  return rules.length === 0
    ? "none"
    : rules.map((rule) => `${rule.key}:${rule.direction}`).join(",")
}
