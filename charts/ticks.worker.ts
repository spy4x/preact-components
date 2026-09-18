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

// The DOM lib types `self.postMessage` as the window two-argument form, so the worker scope is
// declared explicitly rather than fought with.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TicksRequest>) => void) | null
  postMessage: (values: number[]) => void
}

scope.onmessage = (event) => {
  const { min, max, maxTicks } = event.data
  scope.postMessage(ticks(min, max, maxTicks))
}
