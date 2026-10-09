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

/** Where the "dismissed" flag lives: `localStorage`, a user setting on the server, or memory. */
export interface OnboardingDismissedPort {
  /** The stored flag. Called once, when the store is created. */
  read(): boolean
  /** Store the flag. Called by `dismiss()` and `reset()`. */
  write(value: boolean): void
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
  /** Hide the onboarding: writes `true` through the port, then `visible` turns `false`. */
  dismiss(): void
  /** Show it again: writes `false` through the port, then `visible` turns `true`. */
  reset(): void
}

/**
 * Create an onboarding store over the app's step facts and a port for the dismissed flag.
 *
 * The port is written before `visible` changes, so a port that throws leaves `visible` as it was
 * and the caller sees the error.
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

  function setDismissed(value: boolean): void {
    port.write(value)
    dismissed.value = value
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
