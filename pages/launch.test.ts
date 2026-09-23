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
  matchesArgument,
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

  it("lets a concurrent teardown() share a failed attempt's own cleanup, instead of finding nothing", async () => {
    // The exact regression review reproduced 2 of 2 with a real launch: `launchOnce`'s failure path
    // used to call `trackAttempt(undefined)` — clearing the attempt — *before* awaiting its own
    // `shutdownChromium` call, so a SIGTERM arriving during that call's grace period found nothing
    // tracked and tore down nothing, while the browser and its profile directory survived. Here,
    // `endChromium()` plays the part of that failure path's own cleanup, started first and still
    // pending its grace period when `teardown()` — playing the part of the signal handler — is
    // called concurrently. Both must end up waiting for the one real kill.
    const lifecycle = new ChromiumLifecycle()
    const process = fakeProcess()
    lifecycle.trackAttempt({ process, profile: "/tmp/launch-test-attempt-race" })

    const attemptCleanup = lifecycle.endChromium(FAST_GRACEFUL_CLOSE_MS)
    let serverClosed = false
    const signalTeardown = lifecycle.teardown(() => {
      serverClosed = true
      return Promise.resolve()
    }, FAST_GRACEFUL_CLOSE_MS)

    // Awaiting only `signalTeardown` (not both promises together) is what makes this a real
    // ordering assertion: if `teardown()` ran its own independent, uncoordinated pass instead of
    // sharing the attempt's own in-progress cleanup, it would resolve — and close the server —
    // before the kill the *other* promise is still waiting on had happened.
    await signalTeardown

    expect(process.killedWith).toEqual(["SIGKILL"])
    expect(serverClosed).toBe(true)
    await attemptCleanup
  })

  it("tears down an attempt that starts after teardown has already begun", async () => {
    // The losing side of the phase deadline's own Promise.race keeps running after `teardown()` has
    // already torn down whatever was tracked at the time — an attempt that only spawns *after* that
    // point would never have `teardown()` called on its behalf again. `trackAttempt` has to notice
    // and act on its own, immediately, rather than merely recording an attempt nothing will ever
    // revisit.
    const lifecycle = new ChromiumLifecycle()
    const first = fakeProcess()
    lifecycle.trackAttempt({ process: first, profile: "/tmp/launch-test-late-a" })
    await lifecycle.teardown(undefined, FAST_GRACEFUL_CLOSE_MS)

    const late = fakeProcess()
    lifecycle.trackAttempt({ process: late, profile: "/tmp/launch-test-late-b" })
    // trackAttempt's own cleanup for a late attempt is fire-and-forget; give it a moment to run.
    await late.status

    expect(late.killedWith).toEqual(["SIGKILL"])
  })
})

describe("matchesArgument", () => {
  const token = "--user-data-dir=/tmp/pages-chromium-abc123"

  it("matches the token as its own argument in a NUL-separated cmdline", () => {
    const cmdline = `/usr/bin/chromium-browser\0--headless=new\0${token}\0about:blank\0`
    expect(matchesArgument(cmdline, token)).toBe(true)
  })

  it("does not match when the token is only a substring of a longer, different argument", () => {
    // Review's own finding: a plain substring check on the whole line matches
    // --user-data-dir=/tmp/profile-123 inside the unrelated, longer
    // --user-data-dir=/tmp/profile-123-decoy. This is the same shape with this file's own token.
    const decoy = "--user-data-dir=/tmp/pages-chromium-abc123-decoy"
    const cmdline = `/usr/bin/chromium-browser\0${decoy}\0about:blank\0`
    expect(matchesArgument(cmdline, token)).toBe(false)
  })

  it("matches a profile path containing a space, when cmdline is properly NUL-separated", () => {
    const spacedToken = "--user-data-dir=/tmp/pages chromium abc123"
    const cmdline = `/usr/bin/chromium-browser\0${spacedToken}\0about:blank\0`
    expect(matchesArgument(cmdline, spacedToken)).toBe(true)
  })

  it("does not match a decoy argument even when the profile path contains a space", () => {
    const spacedToken = "--user-data-dir=/tmp/pages chromium abc123"
    const decoy = "--user-data-dir=/tmp/pages chromium abc123-decoy"
    const cmdline = `/usr/bin/chromium-browser\0${decoy}\0about:blank\0`
    expect(matchesArgument(cmdline, spacedToken)).toBe(false)
  })

  it("falls back to a substring check when cmdline carries no NUL separator at all", () => {
    // Measured on this repository's own dev host: a cmdline can come back already space-joined,
    // with no NUL to split on, losing argument boundaries before this ever reads it.
    const cmdline = `/usr/bin/chromium-browser --headless=new ${token} about:blank`
    expect(matchesArgument(cmdline, token)).toBe(true)
  })

  it("matches a spaced profile path even in the no-NUL fallback shape", () => {
    const spacedToken = "--user-data-dir=/tmp/pages chromium abc123"
    const cmdline = `/usr/bin/chromium-browser --headless=new ${spacedToken} about:blank`
    expect(matchesArgument(cmdline, spacedToken)).toBe(true)
  })
})
