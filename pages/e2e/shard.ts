/**
 * Splits the `e2e` block's specs into shards, so CI can run them as several steps that each stay
 * well inside the browser phase's ceiling on a busy agent (#975).
 *
 * `--e2e-shard=2/4` runs the second of four shards. The split deals the specs out by their place in
 * the run order, one to each shard in turn: deterministic, and every shard gets a mix of every spec
 * file rather than one whole file. Together the shards `1/n` to `n/n` run every spec exactly once;
 * {@link shardGaps} is what a test holds the pipeline's list of shards to.
 *
 * @module
 */

/** One shard of the `e2e` block: the `index`-th of `count`, counting from 1. */
export interface Shard {
  index: number
  count: number
}

/**
 * Read a shard written as `index/count`, such as `2/4`.
 *
 * @returns The shard, or `undefined` when the text is not two whole numbers with
 * `1 <= index <= count`.
 */
export function parseShard(text: string): Shard | undefined {
  const match = /^(\d+)\/(\d+)$/.exec(text.trim())
  if (!match) return undefined
  const index = Number(match[1])
  const count = Number(match[2])
  return index >= 1 && index <= count ? { index, count } : undefined
}

/**
 * The items one shard runs, in their original order: every `count`-th item, starting at the
 * `index`-th.
 */
export function inShard<T>(items: readonly T[], shard: Shard): T[] {
  return items.filter((_, position) => position % shard.count === shard.index - 1)
}

/**
 * What keeps a list of shards from running every spec exactly once: a missing shard, a repeated
 * one, or shards that disagree on how many there are.
 *
 * @returns One sentence per problem; empty when the shards are exactly `1/n` to `n/n`.
 */
export function shardGaps(shards: readonly Shard[]): string[] {
  if (shards.length === 0) return [`no shard is listed`]
  const counts = [...new Set(shards.map((shard) => shard.count))]
  if (counts.length > 1) return [`the shards disagree on their count: ${counts.join(", ")}`]
  const count = counts[0]
  const gaps: string[] = []
  for (let index = 1; index <= count; index++) {
    const seen = shards.filter((shard) => shard.index === index).length
    if (seen === 0) gaps.push(`shard ${index}/${count} is missing, so its specs never run`)
    if (seen > 1) gaps.push(`shard ${index}/${count} is listed ${seen} times`)
  }
  return gaps
}
