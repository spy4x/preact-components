/**
 * Picks the X-axis labels that fit a `LineChart`'s width. Internal: no `exports` entry names this
 * module, so it is not part of the published API.
 */

/** Average width of one character of a 12 px axis label, in pixels. */
const CHAR_WIDTH = 7
/** Least space between two labels, in pixels. */
const GAP = 8

/** One X-axis label: where it sits along the axis, from 0 (left) to 1 (right), and its text. */
export interface AxisLabel {
  position: number
  label: string
}

/**
 * Keep the X labels that fit side by side in `width` pixels: the first, the last, and every n-th
 * one between them, with the smallest n at which no two labels overlap.
 *
 * A label's width is estimated from its length, at {@link CHAR_WIDTH} pixels a character. It is
 * placed the way `LineChart` draws it: from its left edge near the left end (before 5 %), up to its
 * right edge near the right end (past 95 %), centred everywhere else. When the last label would touch the one kept before it, that one is
 * dropped, so the right-hand end always keeps its label. When even the first and the last overlap,
 * only the first is kept.
 *
 * @param labels The candidates, in axis order.
 * @param width The axis's width, in pixels. Zero, negative or not finite keeps every label.
 * @returns The labels to draw, in axis order.
 */
export function fitXLabels<T extends AxisLabel>(
  labels: readonly T[],
  width: number,
): T[] {
  if (labels.length <= 1 || !Number.isFinite(width) || width <= 0) return [...labels]
  const span = (item: AxisLabel): [number, number] => {
    const size = item.label.length * CHAR_WIDTH
    const at = item.position * width
    if (item.position < 0.05) return [at, at + size]
    if (item.position > 0.95) return [at - size, at]
    return [at - size / 2, at + size / 2]
  }
  const clear = (left: AxisLabel, right: AxisLabel) => span(left)[1] + GAP <= span(right)[0]

  const first = labels[0]
  const last = labels[labels.length - 1]
  if (!clear(first, last)) return [first]

  for (let every = 1; every < labels.length; every++) {
    const kept: T[] = []
    for (let index = 0; index < labels.length - 1; index += every) kept.push(labels[index])
    while (kept.length > 1 && !clear(kept[kept.length - 1], last)) kept.pop()
    kept.push(last)
    if (kept.every((item, index) => index === 0 || clear(kept[index - 1], item))) return kept
  }
  return [first, last]
}
