/**
 * Search helpers shared by every list.
 *
 * Ported from `gb/libs/shared/helpers.ts:534-551`. The source `search(value, word, condition)`
 * took a third argument that folded a caller-side condition into the match; that is the caller's
 * business, so it is gone and a match is written `row.module === Kind.X && search(label, word)`.
 */

/** Maximum number of words a query is split into; the rest are ignored. */
const MAX_WORDS = 16

/**
 * Split a search box's value into words.
 *
 * Runs of whitespace collapse, so `"  north  gate "` is `["north", "gate"]` and an empty box is an
 * empty list — which callers read as "no filter".
 */
export function searchWords(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).slice(0, MAX_WORDS)
}

/**
 * Whether one search word occurs in one value.
 *
 * A number matches by equality, so `search(lamp.index, "12")` is true for lamp 12 and false for
 * lamp 120. Any other type — including `null` and `undefined` — matches nothing, so a field a row
 * happens not to have cannot make every word match.
 */
export function search(value: unknown, word: string): boolean {
  if (typeof value === "number") return value === Number(word)
  if (typeof value === "string") return value.toLowerCase().includes(word.toLowerCase())
  return false
}

/**
 * Keep the rows that every word of the query matches.
 *
 * Words are ANDed, so `"north gate"` keeps only the rows that carry both. An empty query keeps
 * every row and returns the input array itself, which keeps a signal's identity stable.
 */
export function filterRows<M>(
  rows: M[],
  query: string,
  match: (row: M, word: string) => boolean,
): M[] {
  const words = searchWords(query)
  if (words.length === 0) return rows
  return rows.filter((row) => words.every((word) => match(row, word)))
}
