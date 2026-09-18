import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createToastStore } from "./toast.ts"

/** A timer port that never fires on its own, so a test decides when a delay elapses. */
function fakeTimers() {
  const timers: Array<{ run: () => void; delay: number; cancelled: boolean }> = []
  return {
    timers,
    schedule: (run: () => void, delay: number) => {
      const timer = { run, delay, cancelled: false }
      timers.push(timer)
      return () => {
        timer.cancelled = true
      }
    },
    fire(index = 0) {
      timers[index].run()
    },
  }
}

function counterIds() {
  let next = 0
  return () => `toast-${++next}`
}

describe("createToastStore add", () => {
  it("fills in the defaults", () => {
    const store = createToastStore({ nextId: counterIds() })
    const id = store.add({ body: "saved" })
    expect(id).toBe("toast-1")
    expect(store.list.value).toEqual([
      { id: "toast-1", title: "Info", body: "saved", type: "info", timeout: 5000 },
    ])
  })

  it("takes the title and timeout from the message", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ title: "Heads up", body: "saved", type: "warning", timeout: 100 })
    expect(store.list.value[0].title).toBe("Heads up")
    expect(store.list.value[0].timeout).toBe(100)
    expect(store.list.value[0].type).toBe("warning")
  })

  it("keeps an explicit id", () => {
    const store = createToastStore({ nextId: counterIds() })
    expect(store.add({ id: "fixed", body: "saved" })).toBe("fixed")
  })

  it("appends immutably", () => {
    const store = createToastStore({ nextId: counterIds() })
    const before = store.list.value
    store.add({ body: "one" })
    store.add({ body: "two" })
    expect(before).toEqual([])
    expect(store.list.value.map((entry) => entry.body)).toEqual(["one", "two"])
  })

  it("honours a custom default timeout", () => {
    const store = createToastStore({ nextId: counterIds(), defaultTimeout: 250 })
    store.add({ body: "saved" })
    expect(store.list.value[0].timeout).toBe(250)
  })
})

describe("createToastStore variants", () => {
  it("sets the type and a matching default title", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.info({ body: "a" })
    store.success({ body: "b" })
    store.error({ body: "c" })
    store.warning({ body: "d" })
    expect(store.list.value.map((entry) => [entry.type, entry.title])).toEqual([
      ["info", "Info"],
      ["success", "Success"],
      ["error", "Error"],
      ["warning", "Warning"],
    ])
  })
})

describe("createToastStore timeouts", () => {
  it("schedules the auto-dismiss", () => {
    const timers = fakeTimers()
    const store = createToastStore({ nextId: counterIds(), schedule: timers.schedule })
    store.add({ body: "saved", timeout: 300 })

    expect(timers.timers).toHaveLength(1)
    expect(timers.timers[0].delay).toBe(300)

    timers.fire()
    expect(store.list.value).toEqual([])
  })

  it("does not schedule when the timeout is zero", () => {
    const timers = fakeTimers()
    const store = createToastStore({ nextId: counterIds(), schedule: timers.schedule })
    store.add({ body: "sticky", timeout: 0 })
    expect(timers.timers).toHaveLength(0)
    expect(store.list.value).toHaveLength(1)
  })

  it("cancels the timer when a toast is dismissed by hand", () => {
    const timers = fakeTimers()
    const store = createToastStore({ nextId: counterIds(), schedule: timers.schedule })
    const id = store.add({ body: "saved" })

    store.remove(id)

    expect(timers.timers[0].cancelled).toBe(true)
    expect(store.list.value).toEqual([])
  })

  it("cancels every timer on clear", () => {
    const timers = fakeTimers()
    const store = createToastStore({ nextId: counterIds(), schedule: timers.schedule })
    store.add({ body: "one" })
    store.add({ body: "two" })

    store.clear()

    expect(timers.timers.every((timer) => timer.cancelled)).toBe(true)
    expect(store.list.value).toEqual([])
  })

  it("cancels every timer on dispose", () => {
    const timers = fakeTimers()
    const store = createToastStore({ nextId: counterIds(), schedule: timers.schedule })
    store.add({ body: "one" })
    store.dispose()
    expect(timers.timers[0].cancelled).toBe(true)
  })
})

describe("createToastStore removal", () => {
  it("removes only the named toast", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ body: "one" })
    const id = store.add({ body: "two" })
    store.add({ body: "three" })

    store.remove(id)

    expect(store.list.value.map((entry) => entry.body)).toEqual(["one", "three"])
  })

  it("ignores an id that is not there", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ body: "one" })
    store.remove("nope")
    expect(store.list.value).toHaveLength(1)
  })
})

describe("createToastStore as a toast port", () => {
  it("satisfies the port buildModelStore notifies through", () => {
    const store = createToastStore({ nextId: counterIds() })
    const port = { success: store.success, error: store.error }
    port.success({ body: "zone was created" })
    port.error({ title: "Failed", body: "boom" })
    expect(store.list.value.map((entry) => entry.type)).toEqual(["success", "error"])
  })
})
