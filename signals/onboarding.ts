import { computed, type ReadonlySignal, signal } from "@preact/signals"

/**
 * `@spy4x/preact-signals/onboarding` — what an onboarding checklist or tour shows, derived from the
 * app's own facts about each step plus one stored "dismissed" flag.
 *
 * It renders nothing. `OnboardingChecklist` in `@spy4x/preact-ui` takes plain props and works
 * without it; this store is for an app that wants the same answers ("show it?", "which step is
 * next?", "all done?") in more than one place, or for a tour that has no checklist.
 */

/** What the store needs to know about one step. `OnboardingStep` from `@spy4x/preact-ui` fits. */
export interface OnboardingStepFact {
  /** The step's id, unique in the list. */
  id: string
  /** Whether the app's own data says the step is done. */
  done: boolean
}

/**
 * Where the "dismissed" flag lives: `localStorage`, a user setting on the server, or memory.
 *
 * `read()` is synchronous, so an app that keeps the flag on the server loads it before it creates
 * the store. `write()` may be synchronous or return a promise; see {@link OnboardingState.dismiss}.
 */
export interface OnboardingDismissedPort {
  /** The stored flag. Called once, when the store is created. */
  read(): boolean
  /**
   * Store the flag. Called by `dismiss()` and `reset()`. A throw, or a rejected promise, means the
   * flag was not saved.
   */
  write(value: boolean): void | Promise<void>
}

/** What {@link createOnboardingState} takes. */
export interface OnboardingStateOptions {
  /** The steps in order. A step's `done` comes from the app's data, so it changes there. */
  steps: ReadonlySignal<readonly OnboardingStepFact[]>
  /** Where the dismissed flag is read from and written to. */
  dismissed: OnboardingDismissedPort
}

/** How many steps are done, out of how many. */
export interface OnboardingProgress {
  done: number
  total: number
}

/** The derived onboarding state, and the two ways to change the dismissed flag. */
export interface OnboardingState {
  /**
   * `true` until the user dismisses. A checklist whose steps are all done stays visible, so the
   * user sees the completion message and presses Finish, which is what dismisses it.
   */
  visible: ReadonlySignal<boolean>
  /** The id of the first step not done, in order, or `null` when none is left. */
  next: ReadonlySignal<string | null>
  /** `true` when no step is left to do, which includes an empty list. */
  allDone: ReadonlySignal<boolean>
  /** Done steps and all steps, for a progress bar. */
  progress: ReadonlySignal<OnboardingProgress>
  /**
   * Hide the onboarding by writing `true` through the port.
   *
   * A synchronous write runs first and `visible` turns `false` after it, so a write that throws
   * leaves `visible` as it was and the error reaches the caller. When the write returns a promise,
   * `visible` turns `false` at once. If the promise rejects, `visible` falls back to the newest
   * call that has not failed, or to the stored flag. Once every write has settled, `visible`
   * follows the newest call whose write succeeded. The returned promise rejects with the same
   * error. Catch it: a caller that drops the promise gets an unhandled rejection.
   *
   * @returns The write's promise, settled after `visible` has fallen back on failure, or nothing
   * for a synchronous write.
   */
  dismiss(): void | Promise<void>
  /** Show the onboarding again: writes `false`, as {@link OnboardingState.dismiss} does `true`. */
  reset(): void | Promise<void>
}

/**
 * Create an onboarding store over the app's step facts and a port for the dismissed flag.
 *
 * A synchronous port is written before `visible` changes, so a port that throws leaves `visible` as
 * it was. An asynchronous port changes `visible` at once and takes it back when its promise
 * rejects; `dismiss()` and `reset()` return that promise, so the caller sees the error either way.
 * Once every write has settled, `visible` follows the newest call whose write succeeded.
 *
 * @example
 * ```ts
 * const onboarding = createOnboardingState({
 *   steps: computed(() => [
 *     { id: "profile", done: user.value.hasProfile },
 *     { id: "invite", done: members.value.length > 1 },
 *   ]),
 *   dismissed: {
 *     read: () => localStorage.getItem("onboarding-dismissed") === "1",
 *     write: (value) => localStorage.setItem("onboarding-dismissed", value ? "1" : "0"),
 *   },
 * })
 * ```
 */
export function createOnboardingState(options: OnboardingStateOptions): OnboardingState {
  const { steps, dismissed: port } = options
  const dismissed = signal(port.read())
  const next = computed(() => steps.value.find((step) => !step.done)?.id ?? null)
  const progress = computed(() => ({
    done: steps.value.filter((step) => step.done).length,
    total: steps.value.length,
  }))

  /**
   * The newest saved flag, then each later call whose write is still pending, in call order.
   * `visible` follows the last entry. A failed write leaves the list, and a saved one drops every
   * entry before it, so once all writes settle the list holds only the newest saved flag.
   */
  let standing: { value: boolean }[] = [{ value: dismissed.value }]
  const show = () => {
    dismissed.value = standing[standing.length - 1].value
  }

  function setDismissed(value: boolean): void | Promise<void> {
    // Written first: a synchronous write that throws changes nothing here.
    const saving = port.write(value)
    const call = { value }
    if (saving === undefined) {
      standing = [call]
      show()
      return
    }
    standing = [...standing, call]
    show()
    // One chain, returned to the caller, so a rejection is unhandled only if the caller drops it.
    return saving.then(
      () => {
        // Not found: a later call was saved first and has already dropped this one.
        const index = standing.indexOf(call)
        if (index !== -1) standing = standing.slice(index)
      },
      (error: unknown) => {
        standing = standing.filter((entry) => entry !== call)
        show()
        throw error
      },
    )
  }

  return {
    visible: computed(() => !dismissed.value),
    next,
    allDone: computed(() => next.value === null),
    progress,
    dismiss: () => setDismissed(true),
    reset: () => setDismissed(false),
  }
}
