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

/**
 * One step of a scripted order of calls. A call names how its write ends: it `saves` or `throws`
 * synchronously, or it `waits` on a promise until a later `resolve <n>` or `reject <n>` step ends
 * it. Calls are numbered from 1 in the order they are made, whatever their ending.
 */
type Step =
  | `${"dismiss" | "reset"} ${"saves" | "throws" | "waits"}`
  | `${"resolve" | "reject"} ${number}`

/**
 * Play `steps` against a store whose stored flag starts as `stored`, and return `visible` once
 * they have all run. Each call's result and each pending write's rejection is checked on the way.
 */
async function play(stored: boolean, steps: readonly Step[]): Promise<boolean> {
  let ending = ""
  const calls: { saving?: PromiseWithResolvers<void>; result: void | Promise<void> }[] = []
  let saving: PromiseWithResolvers<void> | undefined
  const state = createOnboardingState({
    steps: signal(facts(false)),
    dismissed: {
      read: () => stored,
      write: () => {
        if (ending === "throws") throw new Error("storage is full")
        if (ending === "saves") return
        saving = Promise.withResolvers<void>()
        return saving.promise
      },
    },
  })
  for (const step of steps) {
    const [action, argument] = step.split(" ")
    if (action === "dismiss" || action === "reset") {
      ending = argument
      saving = undefined
      if (ending === "throws") {
        expect(() => state[action]()).toThrow("storage is full")
        calls.push({ result: undefined })
      } else {
        calls.push({ result: state[action](), saving })
      }
      continue
    }
    const call = calls[Number(argument) - 1]
    if (action === "resolve") {
      call.saving!.resolve()
      call.saving = undefined
      await call.result
    } else {
      call.saving!.reject(new Error(`save ${argument} failed`))
      call.saving = undefined
      await expect(call.result).rejects.toThrow(`save ${argument} failed`)
    }
  }
  expect(calls.filter((call) => call.saving), "every pending write is ended").toEqual([])
  return state.visible.value
}

/** The rule: `visible` is the inverse of the newest call whose write succeeded, or of `stored`. */
function settledVisible(stored: boolean, steps: readonly Step[]): boolean {
  const values: boolean[] = []
  let saved = { call: 0, value: stored }
  for (const step of steps) {
    const [action, argument] = step.split(" ")
    if (action === "dismiss" || action === "reset") values.push(action === "dismiss")
    const call = action === "resolve" ? Number(argument) : values.length
    const succeeded = action === "resolve" || argument === "saves"
    if (succeeded && call > saved.call) saved = { call, value: values[call - 1] }
  }
  return !saved.value
}

/** Every order of `count` calls, each with every ending, with pending writes ended in any order. */
function* everyOrder(
  count: number,
  made = 0,
  waiting: readonly number[] = [],
  done: readonly Step[] = [],
): Generator<readonly Step[]> {
  if (made === count && waiting.length === 0) yield done
  if (made < count) {
    for (const action of ["dismiss", "reset"] as const) {
      for (const ending of ["saves", "throws", "waits"] as const) {
        const now = ending === "waits" ? [...waiting, made + 1] : waiting
        yield* everyOrder(count, made + 1, now, [...done, `${action} ${ending}`])
      }
    }
  }
  for (const call of waiting) {
    for (const end of ["resolve", "reject"] as const) {
      const now = waiting.filter((other) => other !== call)
      yield* everyOrder(count, made, now, [...done, `${end} ${call}`])
    }
  }
}

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

  const orders: { name: string; stored: boolean; steps: Step[]; visible: boolean }[] = [
    {
      name: "shows it again when two asynchronous dismissals both fail",
      stored: false,
      steps: ["dismiss waits", "dismiss waits", "reject 1", "reject 2"],
      visible: true,
    },
    {
      name: "shows it again when an asynchronous dismissal fails after a later reset threw",
      stored: false,
      steps: ["dismiss waits", "reset throws", "reject 1"],
      visible: true,
    },
    {
      name: "shows it again when a later asynchronous reset fails before the dismissal fails",
      stored: false,
      steps: ["dismiss waits", "reset waits", "reject 2", "reject 1"],
      visible: true,
    },
    {
      name: "stays hidden when an earlier asynchronous dismissal saves after a later reset failed",
      stored: false,
      steps: ["dismiss waits", "reset waits", "reject 2", "resolve 1"],
      visible: false,
    },
    {
      name: "stays hidden when an asynchronous reset fails after a dismissal saved",
      stored: false,
      steps: ["dismiss waits", "resolve 1", "reset waits", "reject 2"],
      visible: false,
    },
    {
      name: "stays shown when a later synchronous reset saved before an earlier dismissal",
      stored: false,
      steps: ["dismiss waits", "reset saves", "resolve 1"],
      visible: true,
    },
    {
      name: "stays hidden when an asynchronous reset of a stored dismissal fails",
      stored: true,
      steps: ["reset waits", "reject 1"],
      visible: false,
    },
  ]
  for (const order of orders) {
    it(order.name, async () => {
      expect(settledVisible(order.stored, order.steps)).toBe(order.visible)
      expect(await play(order.stored, order.steps)).toBe(order.visible)
    })
  }

  it("follows the newest saved flag in every order of up to three calls", async () => {
    let played = 0
    for (const stored of [false, true]) {
      for (const count of [1, 2, 3]) {
        for (const steps of everyOrder(count)) {
          expect(await play(stored, steps), `stored ${stored}: ${steps.join(", ")}`)
            .toBe(settledVisible(stored, steps))
          played++
        }
      }
    }
    // A generator that yields nothing would pass the loop above; the count proves it ran.
    expect(played).toBe(4976)
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
