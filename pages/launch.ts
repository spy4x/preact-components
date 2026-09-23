/**
 * Chromium's own process lifecycle: retrying a launch attempt, tearing the whole tree down
 * afterwards, and tracking a launch that is still in progress so a deadline elsewhere can reach it.
 *
 * Split out of `verify.ts` because `verify.ts` is a script — the moment anything imports it, its
 * top-level `await staticPhase()` and the browser phase behind it start running, and the process
 * exits when they finish. Nothing in a file shaped like that can be driven from a test. Everything
 * here is instead plain, injectable functions and one small class: `launch.test.ts` drives
 * {@link withOneRetry} with a fake attempt function and {@link ChromiumLifecycle} with a fake
 * process, no real Chromium, `/proc` entry or `Deno.Command` required for either.
 */

import type { Devtools } from "./checks/harness.ts"

/**
 * The subset of `Deno.ChildProcess` this module needs, narrow enough that a test double can satisfy
 * it without spawning anything: a `pid` to log and to match against `/proc`, a `status` promise that
 * resolves on exit, and `kill`.
 */
export interface Killable {
  readonly pid: number
  readonly status: Promise<Deno.CommandStatus>
  kill(signo?: Deno.Signal): void
}

/** How long `Browser.close` and the direct-kill fallback each get before the next step runs. */
const GRACEFUL_CLOSE_TIMEOUT_MS = 5_000

/** Whether `process` exits on its own within `timeoutMs`. */
export async function exitedWithin(process: Killable, timeoutMs: number): Promise<boolean> {
  return await Promise.race([
    process.status.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ])
}

/**
 * Kill anything still alive whose command line carries the exact `--user-data-dir=<profile>`
 * argument.
 *
 * This is the mechanism `shutdownChromium` actually relies on to take Chromium's helpers down: the
 * renderer, GPU, zygote and crash-reporter processes are children of the main browser process, not
 * of this script, so killing that one process (however that happens — `Browser.close`, a direct
 * `kill`, or the OS killing it out from under the run) reparents them; it does not end them. A
 * `--user-data-dir` value comes from `Deno.makeTempDir` and is unique to one launch attempt, so
 * matching it exactly (not as a substring of the whole command line, which a review of this file
 * caught: a coincidental substring match could in principle reach a process this run never spawned)
 * cannot reach anything else on the machine. `/proc/<pid>/cmdline` is documented as NUL-separated
 * per argument; measured on this repository's own dev host it instead reads back space-joined, so
 * splitting on either character is what keeps the match exact on both.
 *
 * Best-effort and silent: no `/proc` (a non-Linux host) or a `pid` directory that disappears
 * mid-scan is not this function's problem to report.
 *
 * @param profile Absolute path of the profile directory to search for.
 */
export async function killByProfile(profile: string): Promise<void> {
  const token = `--user-data-dir=${profile}`
  try {
    for await (const entry of Deno.readDir("/proc")) {
      if (!/^\d+$/.test(entry.name)) continue
      const pid = Number(entry.name)
      try {
        const cmdline = await Deno.readTextFile(`/proc/${pid}/cmdline`)
        if (cmdline.split(/[\0 ]/).includes(token)) Deno.kill(pid, "SIGKILL")
      } catch {
        // Gone already, or unreadable — nothing left to kill.
      }
    }
  } catch {
    // No /proc on this platform; there is no other mechanism here.
  }
}

/**
 * Take one Chromium process and everything it spawned down, and only then remove its profile.
 *
 * Every step below runs unconditionally, never gated on whether an earlier one already looked
 * successful: the browser process itself exiting is not evidence that its helpers did too, and a
 * crashed or externally killed browser process leaves `process.status` resolved *before* any of its
 * helpers have gone anywhere — measured by killing one out from under a run while diagnosing #221.
 *
 * `Browser.close` asks Chromium to shut its own helpers down in the order it chooses, which is the
 * one path that reliably takes the zygote, GPU and crash-reporter processes with it — a bare
 * `SIGKILL` gives none of them the chance. If the process has not exited on its own after that (or
 * there was no `devtools` to ask), it is killed directly. Either way, {@link killByProfile} then
 * sweeps for anything still alive under this profile — the actual mechanism that reaches the
 * helpers, since they are not this function's own child and a signal to the one process it holds a
 * handle to was never going to reach them. `Deno.kill(-pid, …)` to the whole process group was an
 * earlier, since-removed step here: it depended on Chromium being spawned `detached: true`, which
 * also put it in its own session, out of reach of a signal sent to this script's own process group —
 * `timeout` and Ctrl-C stopped reaching Chromium at all (found in review). Chromium is spawned
 * plainly now, sharing this script's process group, specifically so those *do* still reach it.
 *
 * Safe to call more than once, and safe to call with a `process` whose attempt never reached a
 * session — every path that can end a launch attempt or the browser phase itself calls this, so the
 * profile is never removed while something might still be writing to it.
 *
 * @param process The spawned process, if the launch got that far.
 * @param profile The profile directory the launch attempt created for it.
 * @param devtools A connected session, when one exists, for the graceful path.
 * @param gracefulCloseTimeoutMs How long the graceful path gets before the direct kill — defaults to
 * {@link GRACEFUL_CLOSE_TIMEOUT_MS}; `launch.test.ts` shortens it so a fake process that never exits
 * on its own does not cost the production budget on every assertion.
 */
export async function shutdownChromium(
  process: Killable | undefined,
  profile: string | undefined,
  devtools?: Devtools,
  gracefulCloseTimeoutMs = GRACEFUL_CLOSE_TIMEOUT_MS,
): Promise<void> {
  if (process) {
    if (devtools) {
      await devtools.send("Browser.close", {}, gracefulCloseTimeoutMs).catch(() => {})
    }
    if (!await exitedWithin(process, gracefulCloseTimeoutMs)) {
      try {
        process.kill("SIGKILL")
      } catch {
        // Already gone.
      }
      await process.status.catch(() => {})
    }
  }

  if (profile) await killByProfile(profile)
  if (profile) await Deno.remove(profile, { recursive: true }).catch(() => {})
}

/** One attempt's outcome: a value, or why there is none. */
export type AttemptResult<T> = { ok: true; value: T } | { ok: false; reason: string }

/**
 * Try `attempt` once; on failure, retry it once more; record one named check either way.
 *
 * Generic over what an attempt produces, and over how the outcome is recorded, so this is
 * unit-testable without spawning anything real: `launch.test.ts` drives it with a fake `attempt`
 * that fails once then succeeds, fails twice, or succeeds immediately, and a fake `record` that
 * just appends to an array. `verify.ts` uses it with `launchOnce` as the attempt and `check` from
 * `checks/harness.ts` as `record`.
 *
 * @param attempt Runs one attempt; called at most twice.
 * @param checkName Recorded once, true or false, with both attempts' outcomes in its detail — so a
 * report never says only "no Chromium" without saying why a launch that failed twice did.
 * @param record How to record the check.
 * @param onRetrying Called with the first attempt's failure reason before the second attempt runs.
 * @returns The value from whichever attempt succeeded, or `undefined` if neither did.
 */
export async function withOneRetry<T>(
  attempt: () => Promise<AttemptResult<T>>,
  checkName: string,
  record: (name: string, ok: boolean, detail: string) => void,
  onRetrying?: (reason: string) => void,
): Promise<T | undefined> {
  const first = await attempt()
  if (first.ok) {
    record(checkName, true, "attempt 1 succeeded")
    return first.value
  }

  onRetrying?.(first.reason)
  const second = await attempt()
  if (second.ok) {
    record(checkName, true, `attempt 1 failed (${first.reason}); attempt 2 succeeded`)
    return second.value
  }

  record(
    checkName,
    false,
    `attempt 1 failed (${first.reason}); attempt 2 failed (${second.reason})`,
  )
  return undefined
}

/** A Chromium process and profile a launch attempt has spawned but not finished with yet. */
export interface InFlightAttempt {
  process: Killable
  profile: string
}

/** A Chromium process, profile and DevTools session a launch attempt finished with. */
export interface ChromiumSession extends InFlightAttempt {
  devtools: Devtools
}

/**
 * Tracks what `teardown()` should act on: a launch still in progress, or one that finished — never
 * both, and never neither once a launch has started.
 *
 * This exists because the browser phase's own deadline can fire *while `launchOnce` is still
 * awaiting its port file or its DevTools target* — the launch attempt that was running has a real
 * Chromium process, but no `ChromiumSession` yet, since that is only built once the attempt
 * succeeds. Before this class, the deadline branch's `teardown` only knew about a finished session,
 * so a browser that was still starting when time ran out was invisible to it and never torn down —
 * found in review, with a fake browser whose debugging endpoint accepts a connection and never
 * answers: the phase deadline fired, and the fake process and its profile directory were both still
 * there afterwards. `launchOnce` calls {@link ChromiumLifecycle.trackAttempt} the moment it spawns a
 * process, before any of its own bounded waits, so that window no longer exists.
 */
export class ChromiumLifecycle {
  #session?: ChromiumSession
  #inFlight?: InFlightAttempt
  #teardownPromise?: Promise<void>

  /** Record (or clear) the process and profile a launch attempt currently in progress owns. */
  trackAttempt(attempt: InFlightAttempt | undefined): void {
    this.#inFlight = attempt
  }

  /** Record a finished session; clears whatever in-flight attempt produced it. */
  trackSession(session: ChromiumSession): void {
    this.#session = session
    this.#inFlight = undefined
  }

  /**
   * Tear down whichever of a finished session or an in-flight attempt is currently tracked, and
   * close `server` if given. Idempotent: every caller is handed the same promise, so a second call
   * — from a signal handler racing the phase deadline, say — awaits the first call's real
   * completion instead of returning early while teardown is still in progress. A `torn` boolean
   * flag was the earlier shape here and had exactly that gap, found in review.
   *
   * @param closeServer Closes the preview server, if there is one.
   * @param gracefulCloseTimeoutMs Forwarded to `shutdownChromium` — see its own doc.
   */
  teardown(closeServer?: () => Promise<void>, gracefulCloseTimeoutMs?: number): Promise<void> {
    return this.#teardownPromise ??= (async () => {
      if (this.#session) {
        await shutdownChromium(
          this.#session.process,
          this.#session.profile,
          this.#session.devtools,
          gracefulCloseTimeoutMs,
        )
      } else if (this.#inFlight) {
        await shutdownChromium(
          this.#inFlight.process,
          this.#inFlight.profile,
          undefined,
          gracefulCloseTimeoutMs,
        )
      }
      await closeServer?.()
    })()
  }
}
