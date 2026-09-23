import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { FakeTime } from "@std/testing/time"
import { createToastStore } from "./toast.ts"

/**
 * Run a body with every timer in the process under this test's control.
 *
 * The store is supposed to schedule nothing at all now that `Toastr` owns the dismiss timers, and
 * "nothing happens" is only worth asserting against a clock that has really moved. `FakeTime`
 * replaces `setTimeout` globally, so a `setTimeout` the store took out behind the test's back is
 * one this clock would fire — there is no injected port left for it to hide behind.
 *
 * @param body What to run; it is handed the clock to advance.
 */
function withFakeClock(body: (clock: FakeTime) => void): void {
  const clock = new FakeTime()
  try {
    body(clock)
  } finally {
    clock.restore()
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
      { id: "toast-1", title: "Info", body: "saved", type: "info", duration: undefined },
    ])
  })

  it("names no dismiss delay of its own when the message names none", () => {
    // The one default lives in `Toastr`, which is the side that runs the timer. A number invented
    // here would be a second default for the component to disagree with, which is how a 20 000ms
    // delay came to be cut down to five seconds.
    const store = createToastStore({ nextId: counterIds() })
    store.add({ body: "saved" })
    expect(store.list.value[0].duration).toBeUndefined()
    expect(Object.hasOwn(store.list.value[0], "duration")).toBe(true)
  })

  it("takes the title and duration from the message", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ title: "Heads up", body: "saved", type: "warning", duration: 100 })
    expect(store.list.value[0].title).toBe("Heads up")
    expect(store.list.value[0].duration).toBe(100)
    expect(store.list.value[0].type).toBe("warning")
  })

  it("carries a long delay through unchanged, rather than capping it", () => {
    // #174 in one line: this number is what `Toastr` has to read back. Under the old spelling the
    // component found nothing here and ran its own five seconds instead.
    const store = createToastStore({ nextId: counterIds() })
    store.add({ body: "read me", duration: 20_000 })
    expect(store.list.value[0].duration).toBe(20_000)
  })

  it("keeps an explicit id", () => {
    const store = createToastStore({ nextId: counterIds() })
    expect(store.add({ id: "fixed", body: "saved" })).toBe("fixed")
    expect(store.list.value[0].id).toBe("fixed")
  })

  it("replaces the toast in place when an id is reused", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ id: "fixed", body: "one" })
    store.add({ body: "between" })
    store.add({ id: "fixed", body: "two" })

    expect(store.list.value.map((entry) => entry.body)).toEqual(["two", "between"])
  })

  it("leaves no stale timer behind when an id is reused", () => {
    // Under the old store this needed a cancel: the replaced toast's own timeout would still fire
    // and its `remove(id)` would take the replacement down with it. There is no timer to cancel
    // now, and that is what this asserts — the clock runs far past any delay and nothing happens.
    withFakeClock((clock) => {
      const store = createToastStore({ nextId: counterIds() })
      store.add({ id: "fixed", body: "one", duration: 100 })
      store.add({ id: "fixed", body: "two", duration: 100 })

      clock.tick(60_000)

      expect(store.list.value.map((entry) => entry.body)).toEqual(["two"])
    })
  })

  it("does not leave the replaced toast addressable", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ id: "fixed", body: "one" })
    store.add({ id: "fixed", body: "two" })

    store.remove("fixed")

    expect(store.list.value).toEqual([])
  })

  it("appends immutably", () => {
    const store = createToastStore({ nextId: counterIds() })
    const before = store.list.value
    store.add({ body: "one" })
    store.add({ body: "two" })
    expect(before).toEqual([])
    expect(store.list.value.map((entry) => entry.body)).toEqual(["one", "two"])
  })
})

describe("createToastStore and the old timeout field", () => {
  it("still accepts the name it used to have", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ body: "saved", timeout: 100 })
    expect(store.list.value[0].duration).toBe(100)
  })

  it("lets duration win when a caller gives both", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ body: "saved", duration: 100, timeout: 9000 })
    expect(store.list.value[0].duration).toBe(100)
  })

  it("carries a zero through either spelling", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.add({ id: "a", body: "sticky", duration: 0 })
    store.add({ id: "b", body: "also sticky", timeout: 0 })
    expect(store.list.value.map((entry) => entry.duration)).toEqual([0, 0])
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

describe("createToastStore schedules nothing", () => {
  it("keeps a toast that named a delay until somebody removes it", () => {
    // The store used to take this toast away after 300ms of its own accord, whatever the component
    // rendering it had paused. Now the delay is data the renderer reads, and only `remove` removes.
    withFakeClock((clock) => {
      const store = createToastStore({ nextId: counterIds() })
      const id = store.add({ body: "saved", duration: 300 })

      clock.tick(60_000)
      expect(store.list.value).toHaveLength(1)

      store.remove(id)
      expect(store.list.value).toEqual([])
    })
  })

  it("keeps a toast with no delay well past the five seconds the component would give it", () => {
    withFakeClock((clock) => {
      const store = createToastStore({ nextId: counterIds() })
      store.add({ body: "saved" })

      clock.tick(30_000)

      expect(store.list.value).toHaveLength(1)
    })
  })

  it("keeps a toast asked to stay until it is dismissed", () => {
    // The worst case of the two defects, and the reason it is written against `0`: the store
    // documents `0` as "keep this until somebody dismisses it", and the pair used to lose it after
    // five seconds — the component's default, running because the store's field never reached it.
    withFakeClock((clock) => {
      const store = createToastStore({ nextId: counterIds() })
      store.add({ body: "sticky", duration: 0 })

      clock.tick(30_000)

      expect(store.list.value).toHaveLength(1)
      expect(store.list.value[0].duration).toBe(0)
    })
  })

  it("has nothing left running after the list is emptied", () => {
    withFakeClock((clock) => {
      const store = createToastStore({ nextId: counterIds() })
      store.add({ body: "one", duration: 100 })
      store.add({ body: "two", duration: 100 })

      store.clear()
      clock.tick(60_000)

      expect(store.list.value).toEqual([])
    })
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
