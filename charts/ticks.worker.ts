/**
 * Worker used by `scales.test.ts` to call {@link ticks} off the main thread.
 *
 * A tick loop that never advances `v` never returns, and `deno test` has no per-test timeout, so a
 * regression would hang the whole suite instead of failing it. Running the call in a worker lets the
 * test terminate it on a deadline and report a failure.
 */

import { ticks } from "./scales.ts"

interface TicksRequest {
  min: number
  max: number
  maxTicks?: number
}

/** What the worker posts: `ready` as the request arrives, then the call's `result`. */
type WorkerMessage = { kind: "ready" } | { kind: "result"; ticks: number[] }

// The DOM lib types `self.postMessage` as the window two-argument form, so the worker scope is
// declared explicitly rather than fought with.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TicksRequest>) => void) | null
  postMessage: (message: WorkerMessage) => void
}

// The handler runs only once module load and type-check are done, so `ready` marks the end of
// start-up: the test starts its termination deadline on it, and a slow runner's start-up is not
// mistaken for a loop that never ends. It is posted here rather than at the top level because a
// message posted while the module is still evaluating was lost in about one run in five under load.
// Keep the handler assigned synchronously at module level: with a top-level `await` before it, the
// request the test queued at start-up was dropped and the test reported "worker did not start".
scope.onmessage = (event) => {
  scope.postMessage({ kind: "ready" })
  const { min, max, maxTicks } = event.data
  scope.postMessage({ kind: "result", ticks: ticks(min, max, maxTicks) })
}
