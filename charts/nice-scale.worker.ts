/**
 * Worker used by `scales.test.ts` to call {@link niceScale} off the main thread.
 *
 * `niceScale`'s own tick generation (`ticksForStep`) can loop as many times as an absurd `target`
 * option asks for, and `deno test` has no per-test timeout, so a regression here would hang the
 * whole suite instead of failing it. Running the call in a worker lets the test terminate it on a
 * deadline and report a failure — the same reason `ticks.worker.ts` exists for the public `ticks`.
 */

import { niceScale, type NiceScaleOptions } from "./scales.ts"

interface NiceScaleRequest {
  min: number
  max: number
  options?: NiceScaleOptions
}

// The DOM lib types `self.postMessage` as the window two-argument form, so the worker scope is
// declared explicitly rather than fought with.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<NiceScaleRequest>) => void) | null
  postMessage: (ticks: number[]) => void
}

scope.onmessage = (event) => {
  const { min, max, options } = event.data
  scope.postMessage(niceScale(min, max, options).ticks)
}
