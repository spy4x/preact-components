import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  type ContainerLike,
  DEFAULT_UPDATE_MESSAGE,
  type RegistrationLike,
  reloadOnControllerChange,
  serviceWorkerContainer,
  type ServiceWorkerHost,
  skipWaiting,
  startUpdates,
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

/** One `register` call, as {@link recordingContainer} saw it. */
interface RegisterCall {
  scriptUrl: string
  options?: { scope?: string }
}

/**
 * A container that records every `register` call and then answers with `result`.
 *
 * This is the double that makes the registration itself assertable: an `Error` result stands for a
 * script the browser could not fetch, and the recorded calls are what a wrong script URL shows up
 * in.
 */
function recordingContainer(
  result: FakeRegistration | Error,
  controller: unknown = null,
): ContainerLike & { calls: RegisterCall[] } {
  const calls: RegisterCall[] = []
  return {
    controller,
    calls,
    register(scriptUrl: string, options?: { scope?: string }) {
      calls.push({ scriptUrl, options })
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

/** Let the microtasks `startUpdates` queues run. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("serviceWorkerContainer", () => {
  it("returns the container of a host that has one", () => {
    const container = fakeContainer(new FakeRegistration())

    expect(serviceWorkerContainer({ serviceWorker: container })).toBe(container)
  })

  it("returns undefined for a host without service workers", () => {
    expect(serviceWorkerContainer({})).toBeUndefined()
  })

  it("reads the container from navigator, which is where a browser keeps it", () => {
    // The bug this replaces: the default host was `globalThis`, and `globalThis.serviceWorker`
    // exists only inside a worker's own scope — never in a page. The two lines below stand in for
    // a browser: `navigator` carries a container and the global object does not, so this passes
    // only if the lookup goes through `navigator`.
    const container = fakeContainer(new FakeRegistration())
    const host = globalThis.navigator as unknown as ServiceWorkerHost
    host.serviceWorker = container

    try {
      expect((globalThis as ServiceWorkerHost).serviceWorker).toBeUndefined()
      expect(serviceWorkerContainer()).toBe(container)
    } finally {
      delete host.serviceWorker
    }
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
    expect(DEFAULT_UPDATE_MESSAGE).toEqual({ action: "skipWaiting" })
  })

  it("posts the message the caller named instead of the default", () => {
    // A worker speaking another dialect is accommodated by the caller, not by this package.
    const registration = new FakeRegistration()
    const waiting = new FakeWorker("installed")
    registration.waiting = waiting

    expect(skipWaiting(registration, { type: "SKIP_WAITING" })).toBe(true)
    expect(waiting.messages).toEqual([{ type: "SKIP_WAITING" }])
  })

  it("reports false when no worker is waiting", () => {
    expect(skipWaiting(new FakeRegistration())).toBe(false)
    expect(skipWaiting(null)).toBe(false)
    expect(skipWaiting(undefined)).toBe(false)
  })
})

describe("startUpdates", () => {
  it("registers the script it was given, at the scope it was given", async () => {
    const container = recordingContainer(new FakeRegistration())

    startUpdates(container, { scriptUrl: "/app-worker.js", scope: "/app/" })
    await settle()

    expect(container.calls).toEqual([{ scriptUrl: "/app-worker.js", options: { scope: "/app/" } }])
  })

  it("registers /sw.js, with no options, when the caller names neither", async () => {
    const container = recordingContainer(new FakeRegistration())

    startUpdates(container)
    await settle()

    expect(container.calls).toEqual([{ scriptUrl: "/sw.js", options: undefined }])
  })

  it("reports an update when the registration already has a waiting worker", async () => {
    const registration = new FakeRegistration()
    registration.waiting = new FakeWorker("installed")
    const container = recordingContainer(registration)
    let updates = 0
    let registered: RegistrationLike | undefined

    startUpdates(container, {
      onRegistered: (value) => registered = value,
      onUpdate: () => updates++,
    })
    await settle()

    expect(registered).toBe(registration)
    expect(updates).toBe(1)
  })

  it("stays silent through a first install, where nothing controls the page yet", async () => {
    const registration = new FakeRegistration()
    const installing = new FakeWorker("installing")
    registration.installing = installing
    // No controller: this page is not being served by a worker, so it is the first install.
    const container = recordingContainer(registration, null)
    let updates = 0

    startUpdates(container, { onUpdate: () => updates++ })
    await settle()
    registration.emit("updatefound")
    installing.state = "installed"
    installing.emit("statechange")

    expect(updates).toBe(0)
  })

  it("reports a registration that the browser refused", async () => {
    const container = recordingContainer(new Error("the script could not be fetched"))
    const errors: unknown[] = []

    startUpdates(container, { scriptUrl: "/missing.js", onError: (error) => errors.push(error) })
    await settle()

    expect(errors.map(String)).toEqual(["Error: the script could not be fetched"])
  })

  it("abandons a registration that resolves after it was stopped", async () => {
    const registration = new FakeRegistration()
    registration.waiting = new FakeWorker("installed")
    const container = recordingContainer(registration)
    let updates = 0

    const stop = startUpdates(container, { onUpdate: () => updates++ })
    stop()
    await settle()

    expect(updates).toBe(0)
    expect(registration.listenerCount).toBe(0)
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

  it("registers nothing when it is rendered on a server", () => {
    // Server rendering runs no effect, which is exactly what makes the component safe to mount in
    // a layout: the container it was handed is never touched, so nothing is registered and no
    // listener outlives the render.
    const container = recordingContainer(new FakeRegistration())

    expect(render(<SWUpdater container={container} message="Reload for the new version" />))
      .toBe("")
    expect(container.calls).toEqual([])
  })
})
