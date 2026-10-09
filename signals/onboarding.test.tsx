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

  it("leaves visible as it was when the port's write throws", () => {
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
