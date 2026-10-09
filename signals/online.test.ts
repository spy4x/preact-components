import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createOnlineStatus, type OnlineTarget } from "./online.ts"

/** An event target that records its listeners and fires them on demand, like `window` would. */
function fakeTarget() {
  const listeners = { online: new Set<() => void>(), offline: new Set<() => void>() }
  const target: OnlineTarget = {
    addEventListener(type, listener) {
      listeners[type].add(listener)
    },
    removeEventListener(type, listener) {
      listeners[type].delete(listener)
    },
  }
  const fire = (type: "online" | "offline") => listeners[type].forEach((listener) => listener())
  return { target, listeners, fire }
}

describe("createOnlineStatus", () => {
  it("starts from what the navigator reports", () => {
    const status = createOnlineStatus({ target: null, navigator: { onLine: false } })

    expect(status.online.value).toBe(false)
  })

  it("reports online when there is no navigator to ask", () => {
    expect(createOnlineStatus({ target: null, navigator: null }).online.value).toBe(true)
    expect(createOnlineStatus({ target: null, navigator: {} }).online.value).toBe(true)
  })

  it("re-reads the navigator when watching starts", () => {
    const navigator = { onLine: true }
    const status = createOnlineStatus({ target: fakeTarget().target, navigator })

    navigator.onLine = false
    status.watch()

    expect(status.online.value).toBe(false)
  })

  it("follows the offline and online events while watching", () => {
    const { target, fire } = fakeTarget()
    const status = createOnlineStatus({ target, navigator: { onLine: true } })
    status.watch()

    fire("offline")
    expect(status.online.value).toBe(false)

    fire("online")
    expect(status.online.value).toBe(true)
  })

  it("stops following the events once stopped", () => {
    const { target, listeners, fire } = fakeTarget()
    const status = createOnlineStatus({ target, navigator: { onLine: true } })
    const stop = status.watch()

    stop()
    fire("offline")

    expect(status.online.value).toBe(true)
    expect(listeners.online.size + listeners.offline.size).toBe(0)
  })

  it("keeps a second watcher following when the first one stops", () => {
    const { target, listeners, fire } = fakeTarget()
    const status = createOnlineStatus({ target, navigator: { onLine: true } })
    const stopFirst = status.watch()
    status.watch()

    stopFirst()
    fire("offline")

    expect(status.online.value).toBe(false)
    expect(listeners.online.size).toBe(1)
    expect(listeners.offline.size).toBe(1)
  })
})
