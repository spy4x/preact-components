/**
 * The keys that step through a chart's items — a line chart's points, a donut's slices — shared so
 * every chart moves the same way: ArrowRight and ArrowDown go to the next item, ArrowLeft and
 * ArrowUp to the previous one, Home and End to the ends, and Escape clears the choice.
 */

/** How each key moves the item at `current` (or none) among `count` items. */
const MOVES: Record<string, (current: number | null, last: number) => number | null> = {
  ArrowRight: (current, last) => current === null ? 0 : Math.min(last, current + 1),
  ArrowDown: (current, last) => current === null ? 0 : Math.min(last, current + 1),
  ArrowLeft: (current, last) => current === null ? last : Math.max(0, current - 1),
  ArrowUp: (current, last) => current === null ? last : Math.max(0, current - 1),
  Home: () => 0,
  End: (_, last) => last,
  Escape: () => null,
}

/**
 * The item `key` moves to from `current` among `count` items: an index, `null` for none (Escape),
 * or `undefined` when the key is not one a chart handles or there are no items.
 */
export function stepIndex(
  key: string,
  current: number | null,
  count: number,
): number | null | undefined {
  const move = MOVES[key]
  if (!move || count <= 0) return undefined
  return move(current, count - 1)
}
