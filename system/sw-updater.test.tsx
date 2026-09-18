import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  type ContainerLike,
  type RegistrationLike,
  reloadOnControllerChange,
  serviceWorkerContainer,
  skipWaiting,
  SWUpdater,
  watchForUpdate,
  type WorkerLike,
} from "./sw-updater.tsx"

/** A worker that records listeners so a test can drive its state machine by hand. */
class FakeWorker implements WorkerLike {
  state: string
  messages: unknown[] = []
  private listeners = new Map<string, Set<() => void>>()

  constructor(state = "installing") {
    this.state = state
  }

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  get listenerCount(): number {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0)
  }

  emit(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }
}

/** A registration that records listeners, with `installing`/`waiting` swapped by the test. */
class FakeRegistration implements RegistrationLike {
  installing: WorkerLike | null = null
  waiting: WorkerLike | null = null
  private listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  get listenerCount(): number {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0)
  }

  emit(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }
}

/** Minimal container double: register resolves with the registration the test handed over. */
function fakeContainer(registration: FakeRegistration, controller: unknown = {}): ContainerLike {
  return {
    controller,
    register: () => Promise.resolve(registration),
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

describe("serviceWorkerContainer", () => {
  it("returns the container of a host that has one", () => {
    const container = fakeContainer(new FakeRegistration())

    expect(serviceWorkerContainer({ serviceWorker: container })).toBe(container)
  })

  it("returns undefined for a host without service workers", () => {
    expect(serviceWorkerContainer({})).toBeUndefined()
  })

  it("returns undefined when the default host has no service worker", () => {
    // Deno has a `navigator` but no `serviceWorker` — the same shape as a server render.
    expect(serviceWorkerContainer()).toBeUndefined()
  })
})

describe("watchForUpdate", () => {
  it("reports a worker that is already waiting at registration time", () => {
    const registration = new FakeRegistration()
    registration.waiting = new FakeWorker("installed")
    let updates = 0

    watchForUpdate(registration, { hasController: () => true, onUpdate: () => updates++ })

    expect(updates).toBe(1)
  })

  it("reports a worker that finishes installing while the page is open", () => {
    const registration = new FakeRegistration()
    const installing = new FakeWorker("installing")
    registration.installing = installing
    let updates = 0
    watchForUpdate(registration, { hasController: () => true, onUpdate: () => updates++ })

    registration.emit("updatefound")
    installing.state = "installed"
    installing.emit("statechange")

    expect(updates).toBe(1)
  })

  it("stays silent while the new worker is still installing", () => {
    const registration = new FakeRegistration()
    const installing = new FakeWorker("installing")
    registration.installing = installing
    let updates = 0
    watchForUpdate(registration, { hasController: () => true, onUpdate: () => updates++ })

    registration.emit("updatefound")
    installing.emit("statechange")

    expect(updates).toBe(0)
  })

  it("stays silent on a first install, where nothing controls the page yet", () => {
    const registration = new FakeRegistration()
    const installing = new FakeWorker("installing")
    registration.installing = installing
    let updates = 0
    watchForUpdate(registration, { hasController: () => false, onUpdate: () => updates++ })

    registration.emit("updatefound")
    installing.state = "installed"
    installing.emit("statechange")

    expect(updates).toBe(0)
  })

  it("does nothing when updatefound fires without an installing worker", () => {
    const registration = new FakeRegistration()
    let updates = 0
    watchForUpdate(registration, { hasController: () => true, onUpdate: () => updates++ })

    registration.emit("updatefound")

    expect(updates).toBe(0)
  })

  it("detaches every listener it added", () => {
    const registration = new FakeRegistration()
    const installing = new FakeWorker("installing")
    registration.installing = installing
    let updates = 0
    const stop = watchForUpdate(registration, {
      hasController: () => true,
      onUpdate: () => updates++,
    })

    registration.emit("updatefound")
    stop()
    registration.emit("updatefound")
    installing.state = "installed"
    installing.emit("statechange")

    expect(updates).toBe(0)
    expect(registration.listenerCount).toBe(0)
    expect(installing.listenerCount).toBe(0)
  })
})

describe("skipWaiting", () => {
  it("posts the skipWaiting action to the waiting worker", () => {
    const registration = new FakeRegistration()
    const waiting = new FakeWorker("installed")
    registration.waiting = waiting

    expect(skipWaiting(registration)).toBe(true)
    expect(waiting.messages).toEqual([{ action: "skipWaiting" }])
  })

  it("reports false when no worker is waiting", () => {
    expect(skipWaiting(new FakeRegistration())).toBe(false)
    expect(skipWaiting(null)).toBe(false)
    expect(skipWaiting(undefined)).toBe(false)
  })
})

describe("reloadOnControllerChange", () => {
  it("reloads once the new worker takes control", () => {
    const listeners = new Map<string, () => void>()
    const container: ContainerLike = {
      controller: null,
      register: () => Promise.resolve(new FakeRegistration()),
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: (type) => listeners.delete(type),
    }
    let reloads = 0
    const stop = reloadOnControllerChange(container, () => reloads++)

    listeners.get("controllerchange")?.()
    expect(reloads).toBe(1)

    stop()
    expect(listeners.has("controllerchange")).toBe(false)
  })
})

describe("SWUpdater", () => {
  it("renders nothing before an update exists", () => {
    expect(render(<SWUpdater />)).toBe("")
  })

  it("renders nothing when the environment enforces no effect at all", () => {
    // Server rendering never runs an effect, so the bar can be mounted in a layout safely.
    expect(render(<SWUpdater message="Reload for the new version" />)).toBe("")
  })
})
