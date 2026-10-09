import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createNow, type NowTimers, type NowVisibility } from "./now.ts"

/** A clock the test moves, and timers that fire only when the test reaches their due time. */
function fakeTime(start: string) {
  let ms = Date.parse(start)
  const pending = new Map<number, { due: number; callback: () => void }>()
  let nextId = 1
  const clock = { now: () => ms }
  const timers: NowTimers = {
    setTimeout(callback, delay) {
      const id = nextId++
      pending.set(id, { due: ms + delay, callback })
      return id
    },
    clearTimeout(id) {
      pending.delete(id)
    },
  }
  /** Move the clock to `to`, firing every timer that falls due on the way, in order. */
  const advance = (to: string): void => {
    const target = Date.parse(to)
    for (;;) {
      const next = [...pending].sort(([, a], [, b]) => a.due - b.due)[0]
      if (!next || next[1].due > target) break
      pending.delete(next[0])
      ms = Math.max(ms, next[1].due)
      next[1].callback()
    }
    ms = target
  }
  /** Move the clock without firing anything, as a tab whose timers the browser paused. */
  const sleep = (to: string): void => {
    ms = Date.parse(to)
  }
  return { clock, timers, pending, advance, sleep }
}

/** A page whose visibility the test flips, firing `visibilitychange` like `document` would. */
function fakePage() {
  const listeners = new Set<() => void>()
  const page: NowVisibility & { visibilityState: string } = {
    visibilityState: "visible",
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }
  const show = (state: "visible" | "hidden"): void => {
    page.visibilityState = state
    listeners.forEach((listener) => listener())
  }
  return { page, listeners, show }
}

describe("createNow", () => {
  it("starts from what the clock reads", () => {
    const time = fakeTime("2026-10-09T10:00:00Z")
    const store = createNow({ zone: "UTC", clock: time.clock, timers: time.timers })

    expect(store.now.value.toISOString()).toBe("2026-10-09T10:00:00.000Z")
  })

  it("changes within a second of midnight in the given zone", () => {
    // Berlin is UTC+2 in October, so its midnight is 22:00Z.
    const time = fakeTime("2026-10-09T21:00:00Z")
    const store = createNow({
      zone: "Europe/Berlin",
      clock: time.clock,
      timers: time.timers,
      visibility: null,
    })
    store.start()

    time.advance("2026-10-09T21:59:59.999Z")
    expect(store.now.value.toISOString()).toBe("2026-10-09T21:00:00.000Z")

    time.advance("2026-10-09T22:00:01Z")
    expect(store.now.value.toISOString()).toBe("2026-10-09T22:00:00.000Z")
  })

  it("follows the zone it is given, not UTC midnight", () => {
    const time = fakeTime("2026-10-09T21:00:00Z")
    const store = createNow({
      zone: "America/New_York",
      clock: time.clock,
      timers: time.timers,
      visibility: null,
    })
    store.start()

    time.advance("2026-10-10T00:00:01Z")
    expect(store.now.value.toISOString()).toBe("2026-10-09T21:00:00.000Z")

    // New York is UTC-4 in October, so its midnight is 04:00Z.
    time.advance("2026-10-10T04:00:01Z")
    expect(store.now.value.toISOString()).toBe("2026-10-10T04:00:00.000Z")
  })

  it("changes again at the following midnight", () => {
    const time = fakeTime("2026-10-09T12:00:00Z")
    const store = createNow({
      zone: "UTC",
      clock: time.clock,
      timers: time.timers,
      visibility: null,
    })
    store.start()

    time.advance("2026-10-11T00:00:01Z")

    expect(store.now.value.toISOString()).toBe("2026-10-11T00:00:00.000Z")
  })

  it("re-reads the clock when the page becomes visible after sleeping through midnight", () => {
    const time = fakeTime("2026-10-09T23:00:00Z")
    const { page, show } = fakePage()
    const store = createNow({
      zone: "UTC",
      clock: time.clock,
      timers: time.timers,
      visibility: page,
    })
    store.start()

    show("hidden")
    time.sleep("2026-10-10T07:30:00Z")
    expect(store.now.value.toISOString()).toBe("2026-10-09T23:00:00.000Z")

    show("visible")
    expect(store.now.value.toISOString()).toBe("2026-10-10T07:30:00.000Z")
  })

  it("does not re-read the clock when the page is hidden", () => {
    const time = fakeTime("2026-10-09T23:00:00Z")
    const { page, show } = fakePage()
    const store = createNow({
      zone: "UTC",
      clock: time.clock,
      timers: time.timers,
      visibility: page,
    })
    store.start()

    time.sleep("2026-10-10T07:30:00Z")
    show("hidden")

    expect(store.now.value.toISOString()).toBe("2026-10-09T23:00:00.000Z")
  })

  it("keeps one midnight timer however often the page returns", () => {
    const time = fakeTime("2026-10-09T23:00:00Z")
    const { page, show } = fakePage()
    const store = createNow({
      zone: "UTC",
      clock: time.clock,
      timers: time.timers,
      visibility: page,
    })
    store.start()

    show("visible")
    show("visible")
    time.advance("2026-10-10T00:00:01Z")

    expect(time.pending.size).toBe(1)
    expect(store.now.value.toISOString()).toBe("2026-10-10T00:00:00.000Z")
  })

  it("clears the timer and removes the listener when stopped", () => {
    const time = fakeTime("2026-10-09T23:00:00Z")
    const { page, listeners, show } = fakePage()
    const store = createNow({
      zone: "UTC",
      clock: time.clock,
      timers: time.timers,
      visibility: page,
    })
    const stop = store.start()

    stop()
    stop()
    time.advance("2026-10-10T00:00:01Z")
    show("visible")

    expect(time.pending.size).toBe(0)
    expect(listeners.size).toBe(0)
    expect(store.now.value.toISOString()).toBe("2026-10-09T23:00:00.000Z")
  })

  it("rejects a zone the runtime does not know", () => {
    expect(() => createNow({ zone: "Mars/Olympus" })).toThrow(RangeError)
  })
})
