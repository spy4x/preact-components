/**
 * `withOneRetry` and `ChromiumLifecycle` are the two pieces of `launch.ts` that do not need a real
 * Chromium to exercise: retrying and recording, and knowing which of a session or an in-flight
 * attempt to tear down. `shutdownChromium`'s own `Browser.close`/kill/`/proc`-sweep ordering is
 * exercised through `ChromiumLifecycle.teardown` here rather than a third time on its own — every
 * test below drives it with a fake process, never a real one.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  type AttemptResult,
  ChromiumLifecycle,
  type ChromiumSession,
  type Killable,
  withOneRetry,
} from "./launch.ts"

/**
 * `shutdownChromium`'s default grace period before it kills a process that has not exited on its
 * own is production-sized (seconds). `fakeProcess` below never exits on its own — its `status` only
 * settles once `kill()` is called — so every `teardown()` in this file passes this instead, to keep
 * the tests fast without touching production behaviour.
 */
const FAST_GRACEFUL_CLOSE_MS = 10

/** A `Killable` double: `kill()` records the signal and settles `status`, like a real process would. */
function fakeProcess(): Killable & { readonly killedWith: readonly Deno.Signal[] } {
  const killedWith: Deno.Signal[] = []
  let resolveStatus!: (status: Deno.CommandStatus) => void
  const status = new Promise<Deno.CommandStatus>((resolve) => {
    resolveStatus = resolve
  })

  return {
    pid: 4242,
    status,
    killedWith,
    kill(signo: Deno.Signal = "SIGTERM") {
      killedWith.push(signo)
      resolveStatus({ success: false, code: 137, signal: signo })
    },
  }
}

describe("withOneRetry", () => {
  it("does not retry when the first attempt succeeds", async () => {
    const calls: number[] = []
    const checks: Array<{ name: string; ok: boolean; detail: string }> = []

    const value = await withOneRetry<string>(
      () => {
        calls.push(calls.length)
        return Promise.resolve({ ok: true, value: "session-a" })
      },
      "Chromium started",
      (name, ok, detail) => checks.push({ name, ok, detail }),
    )

    expect(value).toBe("session-a")
    expect(calls).toHaveLength(1)
    expect(checks).toEqual([{ name: "Chromium started", ok: true, detail: "attempt 1 succeeded" }])
  })

  it("retries once after a failed first attempt, and records both attempts' outcomes", async () => {
    const results: AttemptResult<string>[] = [
      { ok: false, reason: "no port file" },
      { ok: true, value: "session-b" },
    ]
    let calls = 0
    const checks: Array<{ name: string; ok: boolean; detail: string }> = []

    const value = await withOneRetry<string>(
      () => Promise.resolve(results[calls++]),
      "Chromium started",
      (name, ok, detail) => checks.push({ name, ok, detail }),
    )

    expect(value).toBe("session-b")
    expect(calls).toBe(2)
    expect(checks).toEqual([
      {
        name: "Chromium started",
        ok: true,
        detail: "attempt 1 failed (no port file); attempt 2 succeeded",
      },
    ])
  })

  it("gives up after two failed attempts, naming both reasons in the one recorded check", async () => {
    const results: AttemptResult<string>[] = [
      { ok: false, reason: "no port file" },
      { ok: false, reason: "no DevTools target" },
    ]
    let calls = 0
    const checks: Array<{ name: string; ok: boolean; detail: string }> = []

    const value = await withOneRetry<string>(
      () => Promise.resolve(results[calls++]),
      "Chromium started",
      (name, ok, detail) => checks.push({ name, ok, detail }),
    )

    expect(value).toBeUndefined()
    expect(calls).toBe(2)
    expect(checks).toEqual([
      {
        name: "Chromium started",
        ok: false,
        detail: "attempt 1 failed (no port file); attempt 2 failed (no DevTools target)",
      },
    ])
  })

  it("calls onRetrying with the first attempt's reason, before the second attempt runs", async () => {
    const events: string[] = []
    let calls = 0

    await withOneRetry<string>(
      () => {
        calls++
        if (calls === 1) return Promise.resolve({ ok: false, reason: "boom" })
        events.push("second attempt started")
        return Promise.resolve({ ok: true, value: "session-c" })
      },
      "x",
      () => {},
      (reason) => events.push(`retrying after: ${reason}`),
    )

    expect(events).toEqual(["retrying after: boom", "second attempt started"])
  })
})

describe("ChromiumLifecycle", () => {
  it("tears down the in-flight attempt when no session ever completed", async () => {
    const lifecycle = new ChromiumLifecycle()
    const process = fakeProcess()
    lifecycle.trackAttempt({ process, profile: "/tmp/launch-test-inflight" })

    // The scenario this class exists for: the phase deadline (or a signal) fires while a launch
    // attempt is still awaiting its port file or its DevTools target, before it ever becomes a
    // session. Removing `trackAttempt`'s effect on `teardown` — checking only a completed session —
    // is exactly the regression this test catches: `killedWith` would stay empty.
    await lifecycle.teardown(undefined, FAST_GRACEFUL_CLOSE_MS)

    expect(process.killedWith).toEqual(["SIGKILL"])
  })

  it("tears down the session, not a stale in-flight attempt, once a launch completes", async () => {
    const lifecycle = new ChromiumLifecycle()
    const abandonedAttempt = fakeProcess()
    lifecycle.trackAttempt({ process: abandonedAttempt, profile: "/tmp/launch-test-abandoned" })
    const sessionProcess = fakeProcess()
    // No real `Devtools` here — it is a class with true-private fields, so nothing outside it can
    // construct one structurally. `shutdownChromium` already treats `devtools` as optional (no
    // `Browser.close` to send when there is none), which this cast leans on.
    lifecycle.trackSession(
      {
        process: sessionProcess,
        profile: "/tmp/launch-test-session",
      } as unknown as ChromiumSession,
    )

    await lifecycle.teardown(undefined, FAST_GRACEFUL_CLOSE_MS)

    expect(sessionProcess.killedWith).toEqual(["SIGKILL"])
    expect(abandonedAttempt.killedWith).toEqual([])
  })

  it("closes the server exactly once, even when torn down", async () => {
    const lifecycle = new ChromiumLifecycle()
    const process = fakeProcess()
    lifecycle.trackAttempt({ process, profile: "/tmp/launch-test-server" })
    let closes = 0

    await lifecycle.teardown(() => {
      closes++
      return Promise.resolve()
    }, FAST_GRACEFUL_CLOSE_MS)

    expect(closes).toBe(1)
  })

  it("gives a second caller the first call's own completion, instead of returning early", async () => {
    const lifecycle = new ChromiumLifecycle()
    const process = fakeProcess()
    lifecycle.trackAttempt({ process, profile: "/tmp/launch-test-shared" })

    // A `torn` boolean flag was the shape here before this class: a second caller saw the flag
    // already set and returned immediately, without waiting for the first call's own kill to have
    // happened yet — found in review. Asserting on `process.killedWith` from the *second* promise
    // is what a regression back to that shape would fail: nothing guarantees the kill has run by
    // the time an early `return` resolves.
    const first = lifecycle.teardown(undefined, FAST_GRACEFUL_CLOSE_MS)
    const second = lifecycle.teardown(undefined, FAST_GRACEFUL_CLOSE_MS)
    await second

    expect(process.killedWith).toEqual(["SIGKILL"])
    await first
  })
})
