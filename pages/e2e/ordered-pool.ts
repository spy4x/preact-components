/**
 * A fixed number of workers over a list, whose results are handed on in list order.
 *
 * The `e2e` runner uses it to run several specs at once while the report still lists their checks
 * in spec order, the same on every run, whichever spec finishes first (#696).
 *
 * @module
 */

/**
 * Run `work` over `items` with at most `workers` calls in flight, and pass each result to `record`
 * in the order of `items`.
 *
 * Items start in list order, so the earliest item without a recorded result is always running or
 * finished: a result waits for its predecessors at most as long as the slowest of them runs.
 * `work` should not throw — the runner turns a spec's failure into a result — but if it does, the
 * call rejects once the calls already in flight have settled, and no later result is recorded.
 *
 * @param items What to run, in the order results are recorded.
 * @param workers How many calls may be in flight at once; at least 1.
 * @param work Runs one item and resolves with its result.
 * @param record Receives each result, in the order of `items`.
 * @throws When `workers` is not a positive whole number.
 */
export async function runInOrder<T, R>(
  items: readonly T[],
  workers: number,
  work: (item: T) => Promise<R>,
  record: (result: R, item: T) => void,
): Promise<void> {
  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error(`workers must be a positive whole number, got ${workers}`)
  }
  const results = new Map<number, R>()
  let started = 0
  let recorded = 0
  let failed = false
  const worker = async () => {
    while (!failed && started < items.length) {
      const index = started++
      try {
        results.set(index, await work(items[index]))
      } catch (error) {
        failed = true
        throw error
      }
      while (!failed && results.has(recorded)) {
        const result = results.get(recorded) as R
        results.delete(recorded)
        record(result, items[recorded])
        recorded++
      }
    }
  }
  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(workers, items.length) }, worker),
  )
  const rejected = settled.find((outcome) => outcome.status === "rejected")
  if (rejected) throw (rejected as PromiseRejectedResult).reason
}
