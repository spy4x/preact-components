/**
 * The private half of a `LeaveGuard`: what `UnsavedGuard` drives its dialog with. It is not an
 * entry point of the package. An app sees only `LeaveGuard.navigate`.
 */

import { signal } from "@preact/signals"

/**
 * The question "leave with unsaved changes?" for navigation an app starts from code: a sidebar
 * button, a keyboard shortcut, a redirect. The app creates one with {@link createLeaveGuard}, gives
 * it to its `UnsavedGuard` as `leaveGuard`, and wraps its own navigation in `navigate`.
 */
export interface LeaveGuard {
  /**
   * Runs `go` at once when no `UnsavedGuard` with unsaved changes shares this guard. Otherwise it
   * asks first, in that guard's dialog: "Leave" runs `go`, "Stay" drops it.
   *
   * A call that arrives while the question is already on screen replaces the earlier `go`: the
   * dialog stays as it is, and "Leave" runs only the newest one.
   *
   * @param go The navigation itself, such as `() => setLocation("/lists")`.
   */
  navigate(go: () => void): void
}

/** What `UnsavedGuard` does with a {@link LeaveGuard}; reached through {@link leaveGuardInternals}. */
export interface LeaveGuardInternals {
  /**
   * Marks unsaved changes on behalf of `holder`, until the returned function is called. When the
   * last holder lets go, a navigation still waiting is dropped.
   *
   * @param holder Any object that stands for the caller, compared by identity.
   * @returns The function that lets go. Calling it twice does nothing more.
   */
  hold(holder: object): () => void
  /**
   * Whether `holder` should show the question now: a navigation is waiting and `holder` is the
   * earliest one still holding, so two guards that share a `LeaveGuard` never show two dialogs. It
   * reads signals, so a component that calls it while rendering re-renders when the answer changes.
   */
  asks(holder: object): boolean
  /**
   * Answers "Leave": closes the question and hands the waiting navigation to the caller, who runs
   * it. Handing it out first means nothing the caller does in between, such as dropping the
   * changes and unmounting the guard, can lose it.
   *
   * @returns The waiting navigation, or `null` when none waits.
   */
  take(): (() => void) | null
  /** Answers "Stay": closes the question and drops the waiting navigation. */
  stay(): void
}

const internals = new WeakMap<LeaveGuard, LeaveGuardInternals>()

/**
 * Creates a {@link LeaveGuard}. Create one for the app, outside any component, so the code that
 * navigates and the `UnsavedGuard` that asks share it.
 *
 * It knows no router and touches no global: the app passes its own navigation to `navigate` each
 * time.
 */
export function createLeaveGuard(): LeaveGuard {
  const holders = signal<readonly { holder: object }[]>([])
  const waiting = signal<(() => void) | null>(null)
  const guard: LeaveGuard = {
    navigate(go) {
      if (holders.value.length === 0) go()
      else waiting.value = go
    },
  }
  internals.set(guard, {
    hold(holder) {
      // Its own entry, so a release called twice cannot let go of a later hold by the same holder.
      const entry = { holder }
      holders.value = [...holders.value, entry]
      return () => {
        if (!holders.value.includes(entry)) return
        holders.value = holders.value.filter((other) => other !== entry)
        if (holders.value.length === 0) waiting.value = null
      }
    },
    asks: (holder) => waiting.value !== null && holders.value[0]?.holder === holder,
    take() {
      const go = waiting.value
      waiting.value = null
      return go
    },
    stay() {
      waiting.value = null
    },
  })
  return guard
}

/**
 * The private half of a guard that {@link createLeaveGuard} made.
 *
 * @throws When `guard` is any other object: only `createLeaveGuard` can make a `LeaveGuard`.
 */
export function leaveGuardInternals(guard: LeaveGuard): LeaveGuardInternals {
  const found = internals.get(guard)
  if (!found) {
    throw new Error("UnsavedGuard: `leaveGuard` must be an object that createLeaveGuard() returned")
  }
  return found
}
