import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { signal } from "@preact/signals"
import { render } from "preact-render-to-string"
import { OnboardingChecklist } from "@spy4x/preact-ui/onboarding-checklist"
import {
  createOnboardingState,
  type OnboardingDismissedPort,
  type OnboardingStepFact,
} from "./onboarding.ts"

/** An in-memory dismissed flag that records every read and write. */
function fakePort(stored = false): OnboardingDismissedPort & { reads: number; writes: boolean[] } {
  const port = {
    reads: 0,
    writes: [] as boolean[],
    read: () => {
      port.reads++
      return stored
    },
    write: (value: boolean) => {
      port.writes.push(value)
      stored = value
    },
  }
  return port
}

const facts = (...done: boolean[]): OnboardingStepFact[] =>
  done.map((value, index) => ({ id: `step-${index + 1}`, done: value }))

describe("createOnboardingState", () => {
  it("reads the stored dismissed flag once, when it is created", () => {
    const port = fakePort(true)
    const state = createOnboardingState({ steps: signal(facts(false)), dismissed: port })

    expect(state.visible.value).toBe(false)
    expect(state.visible.value).toBe(false)
    expect(port.reads).toBe(1)
  })

  it("names the first open step in list order as next, and follows the app's data", () => {
    const steps = signal(facts(true, false, false))
    const state = createOnboardingState({ steps, dismissed: fakePort() })
    expect(state.next.value).toBe("step-2")

    steps.value = facts(true, true, false)
    expect(state.next.value).toBe("step-3")

    // A later step done first does not skip an earlier open one.
    steps.value = facts(false, true, true)
    expect(state.next.value).toBe("step-1")
  })

  it("is all done with no next step once every step is done, or when there are none", () => {
    const steps = signal(facts(true, false))
    const state = createOnboardingState({ steps, dismissed: fakePort() })
    expect(state.allDone.value).toBe(false)

    steps.value = facts(true, true)
    expect(state.next.value).toBe(null)
    expect(state.allDone.value).toBe(true)

    steps.value = []
    expect(state.next.value).toBe(null)
    expect(state.allDone.value).toBe(true)
  })

  it("counts done steps out of all steps", () => {
    const steps = signal(facts(true, false, true, false))
    const state = createOnboardingState({ steps, dismissed: fakePort() })
    expect(state.progress.value).toEqual({ done: 2, total: 4 })

    steps.value = facts(true, true, true)
    expect(state.progress.value).toEqual({ done: 3, total: 3 })
  })

  it("stays visible once every step is done, until the user dismisses", () => {
    const state = createOnboardingState({ steps: signal(facts(true, true)), dismissed: fakePort() })

    expect(state.allDone.value).toBe(true)
    expect(state.visible.value).toBe(true)
  })

  it("writes true through the port on dismiss and false on reset, and follows it in visible", () => {
    const port = fakePort()
    const state = createOnboardingState({ steps: signal(facts(false)), dismissed: port })

    state.dismiss()
    expect(port.writes).toEqual([true])
    expect(state.visible.value).toBe(false)

    state.reset()
    expect(port.writes).toEqual([true, false])
    expect(state.visible.value).toBe(true)
  })

  it("leaves visible as it was when a synchronous write throws", () => {
    const state = createOnboardingState({
      steps: signal(facts(false)),
      dismissed: {
        read: () => false,
        write: () => {
          throw new Error("storage is full")
        },
      },
    })

    expect(() => state.dismiss()).toThrow("storage is full")
    expect(state.visible.value).toBe(true)
  })

  it("hides at once on an asynchronous write, and stays hidden when it resolves", async () => {
    const saved = Promise.withResolvers<void>()
    const writes: boolean[] = []
    const state = createOnboardingState({
      steps: signal(facts(false)),
      dismissed: {
        read: () => false,
        write: (value) => {
          writes.push(value)
          return saved.promise
        },
      },
    })

    const dismissing = state.dismiss()
    expect(writes).toEqual([true])
    expect(state.visible.value).toBe(false)

    saved.resolve()
    await dismissing
    expect(dismissing).toBeInstanceOf(Promise)
    expect(state.visible.value).toBe(false)
  })

  it("shows it again and rejects the caller's await when an asynchronous write fails", async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason)
      event.preventDefault()
    }
    globalThis.addEventListener("unhandledrejection", onUnhandled)
    try {
      const state = createOnboardingState({
        steps: signal(facts(false)),
        dismissed: { read: () => false, write: () => Promise.reject(new Error("server said 500")) },
      })

      const dismissing = state.dismiss()
      expect(state.visible.value).toBe(false)
      await expect(dismissing).rejects.toThrow("server said 500")
      expect(state.visible.value).toBe(true)

      // Unhandled rejections are reported after the microtask queue drains, so wait one task.
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).toEqual([])
    } finally {
      globalThis.removeEventListener("unhandledrejection", onUnhandled)
    }
  })

  it("keeps the latest choice when an earlier asynchronous write fails after it", async () => {
    const first = Promise.withResolvers<void>()
    let calls = 0
    const state = createOnboardingState({
      steps: signal(facts(false)),
      dismissed: { read: () => false, write: () => calls++ === 0 ? first.promise : undefined },
    })

    const dismissing = state.dismiss()
    state.reset()
    state.dismiss()
    first.reject(new Error("server said 500"))
    await expect(dismissing).rejects.toThrow("server said 500")

    expect(state.visible.value).toBe(false)
  })

  it("picks the same next step that OnboardingChecklist marks as current", () => {
    const lists = [
      facts(false, false, false),
      facts(true, false, false),
      facts(false, true, false),
      facts(true, true, false),
      facts(true, true, true),
    ]
    for (const list of lists) {
      const state = createOnboardingState({ steps: signal(list), dismissed: fakePort() })
      const html = render(
        <OnboardingChecklist
          steps={list.map((step) => ({ ...step, title: `Title ${step.id}` }))}
        />,
      )
      const current = html.match(/aria-current="step"[^>]*>[\s\S]*?Title (step-\d+)/)?.[1] ?? null

      expect(current, JSON.stringify(list)).toBe(state.next.value)
    }
  })
})
