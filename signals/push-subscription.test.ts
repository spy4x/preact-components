import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  createPushSubscription,
  type PushAction,
  type PushSubscriptionData,
  type PushSubscriptionLike,
  type PushSubscriptionOptions,
} from "./push-subscription.ts"

/** Base64url of the bytes 1, 2, 3, 250, 251, 252: it uses both `-` and `_`, and no padding. */
const PUBLIC_KEY = "AQID-vv8"
const PUBLIC_KEY_BYTES = [1, 2, 3, 250, 251, 252]
/** Another server key: the bytes 9, 9, 9. */
const OLD_KEY_BYTES = [9, 9, 9]
const ENDPOINT = "https://push.example/device-1"
/** The browser's second subscription: a new one gets a new address. */
const ENDPOINT_2 = "https://push.example/device-2"

const DESKTOP = { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0 Safari/537.36" }
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1" }

/**
 * A browser the test sets up and inspects: the permission, what its prompt will answer, the one
 * subscription it can hold, and every call made to it, in order.
 */
function fakeBrowser(
  start: {
    permission?: string
    answer?: string
    subscribed?: boolean
    registered?: boolean
    /** The key the subscription it starts with was made with; `null` for a browser that hides it. */
    key?: number[] | null
  } = {},
) {
  const calls: string[] = []
  const state = {
    permission: start.permission ?? "default",
    answer: start.answer ?? "granted",
    registered: start.registered ?? true,
    subscription: null as PushSubscriptionLike | null,
    keys: [] as number[][],
    /** What `unsubscribe()` does: drop it, keep it and answer `false`, or reject. */
    unsubscribeResult: true as boolean | "throw",
    /** Set to make the next new subscription fail, as a push service that is down would. */
    subscribeError: null as Error | null,
    made: 0,
  }
  const subscription = (key: number[] | null): PushSubscriptionLike => {
    const endpoint = `https://push.example/device-${++state.made}`
    return {
      endpoint,
      options: { applicationServerKey: key && new Uint8Array(key).buffer },
      toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
      unsubscribe: () => {
        calls.push("unsubscribe")
        if (state.unsubscribeResult === "throw") {
          return Promise.reject(new Error("unsubscribe broke"))
        }
        if (state.unsubscribeResult) state.subscription = null
        return Promise.resolve(state.unsubscribeResult)
      },
    }
  }
  if (start.subscribed) {
    state.subscription = subscription(start.key === undefined ? PUBLIC_KEY_BYTES : start.key)
  }
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(state.subscription),
      // As a browser: the same subscription again for the same key, a refusal for another key.
      subscribe: (options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
        calls.push(`subscribe userVisibleOnly=${options.userVisibleOnly}`)
        const key = [...options.applicationServerKey]
        state.keys.push(key)
        const held = state.subscription
        if (held) {
          const used = held.options?.applicationServerKey
          if (!used || String([...new Uint8Array(used)]) === String(key)) {
            return Promise.resolve(held)
          }
          return Promise.reject(new DOMException("another key", "InvalidStateError"))
        }
        if (state.subscribeError) return Promise.reject(state.subscribeError)
        state.subscription = subscription(key)
        return Promise.resolve(state.subscription)
      },
    },
  }
  const listeners = new Set<() => void>()
  const page = {
    visibilityState: "visible",
    addEventListener: (_type: "visibilitychange", listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: "visibilitychange", listener: () => void) =>
      listeners.delete(listener),
  }
  return {
    state,
    calls,
    listeners,
    /** Flip the page's visibility, firing `visibilitychange` as `document` would. */
    show: (visibility: "visible" | "hidden") => {
      page.visibilityState = visibility
      listeners.forEach((listener) => listener())
    },
    ports: {
      serviceWorker: {
        getRegistration: () => Promise.resolve(state.registered ? registration : undefined),
        // Never settles when nothing is registered, as in a browser.
        ready: state.registered ? Promise.resolve(registration) : new Promise<never>(() => {}),
      },
      notification: {
        get permission() {
          return state.permission
        },
        requestPermission: () => {
          calls.push("prompt")
          state.permission = state.answer
          return Promise.resolve(state.answer)
        },
      },
      navigator: DESKTOP,
      matchMedia: () => ({ matches: false }),
      visibility: page,
    },
  }
}

/** A server the test can make refuse, and everything it was asked to do. */
function fakeServer(calls: string[]) {
  const server = {
    stored: [] as PushSubscriptionData[],
    failSave: false,
    failRemove: false,
    /** Runs inside `remove`, for a test that changes the browser while the server works. */
    onRemove: () => {},
    errors: [] as Array<[string, PushAction | "refresh"]>,
    /** An upsert, as the store asks of the caller: one entry per endpoint. */
    save: (subscription: PushSubscriptionData) => {
      calls.push("save")
      if (server.failSave) return Promise.reject(new Error("save refused"))
      server.stored = [
        ...server.stored.filter((entry) => entry.endpoint !== subscription.endpoint),
        subscription,
      ]
      return Promise.resolve()
    },
    remove: (endpoint: string) => {
      calls.push(`remove ${endpoint}`)
      server.onRemove()
      if (server.failRemove) return Promise.reject(new Error("remove refused"))
      server.stored = server.stored.filter((entry) => entry.endpoint !== endpoint)
      return Promise.resolve()
    },
    onError: (error: unknown, action: PushAction | "refresh") => {
      server.errors.push([(error as Error).message, action])
    },
  }
  return server
}

/** A store on a fake browser and a fake server. */
function setup(
  start: Parameters<typeof fakeBrowser>[0] = {},
  overrides: Partial<PushSubscriptionOptions> = {},
) {
  const browser = fakeBrowser(start)
  const server = fakeServer(browser.calls)
  const store = createPushSubscription({
    publicKey: PUBLIC_KEY,
    save: server.save,
    remove: server.remove,
    onError: server.onError,
    ...browser.ports,
    ...overrides,
  })
  return { browser, server, store }
}

/** Lets the promises a `visibilitychange` listener started settle. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe("createPushSubscription: reading the device", () => {
  it("reports checking and listens to nothing until it is asked to read", () => {
    const { store, browser } = setup()

    expect(store.status.value).toBe("checking")
    expect(browser.calls).toEqual([])
    expect(browser.listeners.size).toBe(0)
  })

  it("reports off when allowed to ask and not subscribed, without opening the prompt", async () => {
    const { store, browser } = setup()

    await store.refresh()

    expect(store.status.value).toBe("off")
    expect(browser.calls).toEqual([])
  })

  it("reports on, and saves the subscription again, when the browser holds one the server lost", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    expect(server.stored).toEqual([])

    await store.refresh()

    expect(store.status.value).toBe("on")
    expect(browser.calls).toEqual(["save"])
    expect(server.stored).toEqual([{ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } }])
  })

  it("saves the browser's subscription once per page load, not on every reading", async () => {
    const { store, browser } = setup({ permission: "granted", subscribed: true })

    await store.refresh()
    await store.refresh()

    expect(browser.calls).toEqual(["save"])
  })

  it("replaces a subscription made with another server key when the page loads", async () => {
    const { store, browser, server } = setup({
      permission: "granted",
      subscribed: true,
      key: OLD_KEY_BYTES,
    })
    server.stored = [{ endpoint: ENDPOINT }]

    await store.refresh()

    expect(browser.calls).toEqual([
      "unsubscribe",
      `remove ${ENDPOINT}`,
      "subscribe userVisibleOnly=true",
      "save",
    ])
    expect(browser.state.keys).toEqual([PUBLIC_KEY_BYTES])
    expect(server.stored.map((entry) => entry.endpoint)).toEqual([ENDPOINT_2])
    expect(store.status.value).toBe("on")
  })

  it("keeps, and saves, a subscription whose key the browser does not tell", async () => {
    const { store, browser } = setup({ permission: "granted", subscribed: true, key: null })

    await store.refresh()

    expect(browser.calls).toEqual(["save"])
    expect(store.status.value).toBe("on")
  })

  it("tells onError when the save on page load fails, and tries again when the page is shown", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    server.failSave = true
    const stop = store.start()
    await settle()
    expect(store.status.value).toBe("on")
    expect(store.failed.value).toBe(null)
    expect(server.errors).toEqual([["save refused", "refresh"]])

    server.failSave = false
    browser.show("visible")
    await settle()

    expect(browser.calls).toEqual(["save", "save"])
    expect(server.stored).toHaveLength(1)
    stop()
  })

  it("reports off when replacing an old-key subscription fails after the old one was dropped", async () => {
    const { store, browser, server } = setup({
      permission: "granted",
      subscribed: true,
      key: OLD_KEY_BYTES,
    })
    browser.state.subscribeError = new Error("push service down")

    await store.refresh()

    expect(store.status.value).toBe("off")
    expect(server.errors).toEqual([["push service down", "refresh"]])
    expect(server.stored).toEqual([])
  })

  it("reports off for a subscription left over without the permission", async () => {
    const { store } = setup({ permission: "default", subscribed: true })

    await store.refresh()

    expect(store.status.value).toBe("off")
  })

  it("reports blocked when the browser denies notifications for the site", async () => {
    const { store } = setup({ permission: "denied" })

    await store.refresh()

    expect(store.status.value).toBe("blocked")
  })

  it("reports unsupported without a service worker, without Notification, or without a push manager", async () => {
    const noWorker = setup({}, { serviceWorker: null })
    const noNotification = setup({}, { notification: null })
    const noManager = setup({}, {
      serviceWorker: { getRegistration: () => Promise.resolve({}), ready: Promise.resolve({}) },
    })

    await Promise.all([
      noWorker.store.refresh(),
      noNotification.store.refresh(),
      noManager.store.refresh(),
    ])

    expect(noWorker.store.status.value).toBe("unsupported")
    expect(noNotification.store.status.value).toBe("unsupported")
    // Decided from the missing port, not from an error caught on the way.
    expect(noNotification.server.errors).toEqual([])
    expect(noManager.store.status.value).toBe("unsupported")
  })

  it("reports needs-install on an iPhone in a browser tab, and unsupported once installed there", async () => {
    const tab = setup({}, { notification: null, navigator: IPHONE })
    const installed = setup({}, {
      notification: null,
      navigator: IPHONE,
      matchMedia: () => ({ matches: true }),
    })

    await Promise.all([tab.store.refresh(), installed.store.refresh()])

    expect(tab.store.status.value).toBe("needs-install")
    expect(installed.store.status.value).toBe("unsupported")
  })

  it("reports unavailable when the server has no key, and checking while the key loads", async () => {
    const none = setup({}, { publicKey: null })
    const empty = setup({}, { publicKey: "" })
    const loading = setup({}, { publicKey: undefined })

    await Promise.all([none.store.refresh(), empty.store.refresh(), loading.store.refresh()])

    expect(none.store.status.value).toBe("unavailable")
    expect(empty.store.status.value).toBe("unavailable")
    expect(loading.store.status.value).toBe("checking")
  })

  it("reads options given as a function again, so a key that arrives later counts", async () => {
    const browser = fakeBrowser()
    const server: { publicKey?: string } = {}
    const store = createPushSubscription(() => ({
      publicKey: server.publicKey,
      save: () => {},
      remove: () => {},
      ...browser.ports,
    }))

    await store.refresh()
    expect(store.status.value).toBe("checking")
    server.publicKey = PUBLIC_KEY
    await store.refresh()

    expect(store.status.value).toBe("off")
  })

  it("reports unsupported and tells onError when the browser refuses the lookup", async () => {
    const { store, server } = setup({}, {
      serviceWorker: {
        getRegistration: () => Promise.reject(new Error("insecure page")),
        ready: new Promise<never>(() => {}),
      },
    })

    await store.refresh()

    expect(store.status.value).toBe("unsupported")
    expect(server.errors).toEqual([["insecure page", "refresh"]])
  })
})

describe("createPushSubscription: turning on", () => {
  it("asks permission, subscribes with the decoded key, saves the subscription, and reports on", async () => {
    const { store, browser, server } = setup()
    await store.refresh()

    await store.enable()

    expect(browser.calls).toEqual(["prompt", "subscribe userVisibleOnly=true", "save"])
    expect(browser.state.keys).toEqual([PUBLIC_KEY_BYTES])
    expect(server.stored).toEqual([{ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } }])
    expect(store.status.value).toBe("on")
    expect(store.busy.value).toBe(null)
    expect(store.failed.value).toBe(null)
  })

  it("does not ask again when permission is already granted", async () => {
    const { store, browser } = setup({ permission: "granted" })

    await store.enable()

    expect(browser.calls).toEqual(["subscribe userVisibleOnly=true", "save"])
    expect(store.status.value).toBe("on")
  })

  it("reports blocked, with no subscription and no failure, when the person denies the prompt", async () => {
    const { store, browser } = setup({ answer: "denied" })
    await store.refresh()

    await store.enable()

    expect(browser.calls).toEqual(["prompt"])
    expect(store.status.value).toBe("blocked")
    expect(store.failed.value).toBe(null)
  })

  it("stays off, with no subscription and no failure, when the person closes the prompt", async () => {
    const { store, browser } = setup({ answer: "default" })
    await store.refresh()

    await store.enable()

    expect(browser.calls).toEqual(["prompt"])
    expect(store.status.value).toBe("off")
    expect(store.failed.value).toBe(null)
  })

  it("asks the server to forget it and unsubscribes again when save fails, reports the failure, and stays off", async () => {
    const { store, browser, server } = setup()
    server.failSave = true

    await store.enable()

    expect(browser.calls).toEqual([
      "prompt",
      "subscribe userVisibleOnly=true",
      "save",
      `remove ${ENDPOINT}`,
      "unsubscribe",
    ])
    expect(browser.state.subscription).toBe(null)
    expect(store.status.value).toBe("off")
    expect(store.failed.value).toBe("enable")
    expect(server.errors).toEqual([["save refused", "enable"]])
  })

  for (const kept of [false, "throw"] as const) {
    const how = kept === "throw" ? "unsubscribe rejects" : "the browser keeps the subscription"
    it(`reports off, never on, when save fails and ${how}, and the next press succeeds`, async () => {
      const { store, browser, server } = setup()
      server.failSave = true
      browser.state.unsubscribeResult = kept

      await store.enable()

      expect(browser.state.subscription).not.toBe(null)
      expect(store.status.value).toBe("off")
      expect(store.failed.value).toBe("enable")
      expect(server.errors).toEqual([
        [
          kept === "throw"
            ? "unsubscribe broke"
            : "createPushSubscription: the browser kept the subscription",
          "refresh",
        ],
        ["save refused", "enable"],
      ])
      // Coming back to the page does not turn it on behind the person's back either.
      await store.refresh()
      expect(store.status.value).toBe("off")
      expect(server.stored).toEqual([])

      server.failSave = false
      await store.enable()

      expect(store.status.value).toBe("on")
      expect(store.failed.value).toBe(null)
      expect(server.stored.map((entry) => entry.endpoint)).toEqual([ENDPOINT])
    })
  }

  it("replaces a subscription left over under another key when the browser refuses a second one", async () => {
    const { store, browser, server } = setup({ subscribed: true, key: OLD_KEY_BYTES })
    server.stored = [{ endpoint: ENDPOINT }]
    await store.refresh()
    expect(store.status.value).toBe("off")

    await store.enable()

    expect(browser.calls).toEqual([
      "prompt",
      "subscribe userVisibleOnly=true",
      "unsubscribe",
      `remove ${ENDPOINT}`,
      "subscribe userVisibleOnly=true",
      "save",
    ])
    expect(server.stored.map((entry) => entry.endpoint)).toEqual([ENDPOINT_2])
    expect(store.status.value).toBe("on")
    expect(store.failed.value).toBe(null)
  })

  it("reports off with the failure when the left-over subscription cannot be dropped, never on", async () => {
    const { store, browser } = setup({ subscribed: true, key: OLD_KEY_BYTES })
    browser.state.unsubscribeResult = false

    await store.enable()

    expect(store.status.value).toBe("off")
    expect(store.failed.value).toBe("enable")
    expect(browser.calls).not.toContain("save")
  })

  it("fails without opening the prompt when the server has no key", async () => {
    const { store, browser } = setup({}, { publicKey: null })

    await store.enable()

    expect(browser.calls).toEqual([])
    expect(store.failed.value).toBe("enable")
    expect(store.status.value).toBe("unavailable")
  })

  it("a reading that ends while turning on is still saving changes neither the status nor the server", async () => {
    const browser = fakeBrowser({ permission: "granted" })
    let saves = 0
    let saved = () => {}
    const store = createPushSubscription({
      publicKey: PUBLIC_KEY,
      save: () => {
        saves++
        return new Promise<void>((resolve) => (saved = resolve))
      },
      remove: () => {},
      ...browser.ports,
    })
    await store.refresh()

    const turningOn = store.enable()
    await settle()
    await store.refresh()
    expect(store.status.value).toBe("off")
    expect(saves).toBe(1)
    saved()
    await turningOn

    expect(store.status.value).toBe("on")
  })

  it("a reading that started before turning on does not overwrite its result", async () => {
    const browser = fakeBrowser({ permission: "granted" })
    const registration = await browser.ports.serviceWorker.getRegistration()
    let release = () => {}
    let lookups = 0
    const store = createPushSubscription({
      publicKey: PUBLIC_KEY,
      save: () => {},
      remove: () => {},
      ...browser.ports,
      serviceWorker: {
        ready: browser.ports.serviceWorker.ready,
        // The first lookup, the reading's, waits until the test lets it through.
        getRegistration: () =>
          lookups++ === 0
            ? new Promise((resolve) => (release = () => resolve(registration)))
            : Promise.resolve(registration),
      },
    })

    const older = store.refresh()
    await store.enable()
    expect(store.status.value).toBe("on")
    release()
    await older

    expect(store.status.value).toBe("on")
  })

  it("waits for the save of the page load before it acts", async () => {
    const browser = fakeBrowser({ permission: "granted", subscribed: true })
    const calls: string[] = []
    let saved = () => {}
    const store = createPushSubscription({
      publicKey: PUBLIC_KEY,
      save: () => {
        calls.push("save")
        return new Promise<void>((resolve) => (saved = resolve))
      },
      remove: () => {
        calls.push("remove")
      },
      ...browser.ports,
    })
    const reading = store.refresh()
    await settle()

    const turningOff = store.disable()
    await settle()
    expect(calls).toEqual(["save"])
    saved()
    await Promise.all([reading, turningOff])

    expect(calls).toEqual(["save", "remove"])
    expect(store.status.value).toBe("off")
  })

  it("fails instead of waiting for ever when the app registered no service worker", async () => {
    const { store, server } = setup({ permission: "granted", registered: false })

    await store.enable()

    expect(store.failed.value).toBe("enable")
    expect(server.errors.map(([, action]) => action)).toEqual(["enable"])
    expect(store.status.value).toBe("off")
  })

  it("fails, without subscribing, on a key that is not base64url", async () => {
    const { store, browser } = setup({ permission: "granted" }, { publicKey: "not base64url!" })

    await store.enable()

    expect(browser.calls).toEqual([])
    expect(store.failed.value).toBe("enable")
  })

  it("is busy with the action while it runs, and ignores a second action until it ends", async () => {
    const { store, browser } = setup({ permission: "granted", subscribed: true })

    const first = store.disable()
    expect(store.busy.value).toBe("disable")
    await store.enable()
    await first

    expect(browser.calls).toEqual([`remove ${ENDPOINT}`, "unsubscribe"])
    expect(store.status.value).toBe("off")
    expect(store.busy.value).toBe(null)
  })
})

describe("createPushSubscription: turning off", () => {
  it("removes the subscription from the server by its endpoint, then unsubscribes, and reports off", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    server.stored = [{ endpoint: ENDPOINT }]

    await store.disable()

    expect(browser.calls).toEqual([`remove ${ENDPOINT}`, "unsubscribe"])
    expect(server.stored).toEqual([])
    expect(browser.state.subscription).toBe(null)
    expect(store.status.value).toBe("off")
  })

  it("keeps the browser's subscription and stays on when the server refuses the removal", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    await store.refresh()
    server.failRemove = true

    await store.disable()

    expect(browser.calls).toEqual(["save", `remove ${ENDPOINT}`])
    expect(browser.state.subscription).not.toBe(null)
    expect(store.status.value).toBe("on")
    expect(store.failed.value).toBe("disable")
  })

  it("reports a failure, stays on, and saves it again when the browser keeps the subscription", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    await store.refresh()
    browser.state.unsubscribeResult = false

    await store.disable()

    expect(store.status.value).toBe("on")
    expect(store.failed.value).toBe("disable")
    expect(browser.calls).toEqual(["save", `remove ${ENDPOINT}`, "unsubscribe", "save"])
    expect(server.stored.map((entry) => entry.endpoint)).toEqual([ENDPOINT])
  })

  it("reports blocked, not off, when notifications were blocked while turning off", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    await store.refresh()
    server.onRemove = () => (browser.state.permission = "denied")

    await store.disable()

    expect(store.failed.value).toBe(null)
    expect(store.status.value).toBe("blocked")
  })

  it("clears the last failure when the next action starts", async () => {
    const { store, server } = setup({ permission: "granted", subscribed: true })
    server.failRemove = true
    await store.disable()
    expect(store.failed.value).toBe("disable")
    server.failRemove = false

    await store.disable()

    expect(store.failed.value).toBe(null)
    expect(store.status.value).toBe("off")
  })
})

describe("createPushSubscription: the test notification", () => {
  it("runs sendTest and reports sent, until the next action starts", async () => {
    let tests = 0
    const { store } = setup({ permission: "granted", subscribed: true }, {
      sendTest: () => {
        tests++
      },
    })

    await store.test()
    expect(tests).toBe(1)
    expect(store.sent.value).toBe(true)
    await store.disable()

    expect(store.sent.value).toBe(false)
  })

  it("reports the test as failed when sendTest rejects", async () => {
    const { store } = setup({ permission: "granted", subscribed: true }, {
      sendTest: () => Promise.reject(new Error("no route")),
    })
    await store.refresh()

    await store.test()

    expect(store.failed.value).toBe("test")
    expect(store.sent.value).toBe(false)
    expect(store.status.value).toBe("on")
  })
})

describe("createPushSubscription: coming back to the page", () => {
  it("reports blocked, and asks the server to forget the device, when the permission was revoked while the page was hidden", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    const stop = store.start()
    await settle()
    expect(store.status.value).toBe("on")

    browser.show("hidden")
    browser.state.permission = "denied"
    browser.state.subscription = null
    await settle()
    expect(store.status.value).toBe("on")
    browser.show("visible")
    await settle()

    expect(store.status.value).toBe("blocked")
    expect(browser.calls).toEqual(["save", `remove ${ENDPOINT}`])
    expect(server.stored).toEqual([])
    // Once is enough.
    browser.show("visible")
    await settle()
    expect(browser.calls).toHaveLength(2)
    stop()
  })

  it("reports off again when the block was lifted while the page was hidden", async () => {
    const { store, browser } = setup({ permission: "denied" })
    const stop = store.start()
    await settle()
    expect(store.status.value).toBe("blocked")

    browser.state.permission = "default"
    browser.show("visible")
    await settle()

    expect(store.status.value).toBe("off")
    stop()
  })

  it("stops listening when the function start returned is called", async () => {
    const { store, browser } = setup({ permission: "granted", subscribed: true })
    const stop = store.start()
    await settle()
    expect(browser.listeners.size).toBe(1)

    stop()
    browser.state.permission = "denied"
    browser.show("visible")
    await settle()

    expect(browser.listeners.size).toBe(0)
    expect(store.status.value).toBe("on")
  })

  it("keeps the newer reading when an older one ends after it", async () => {
    const browser = fakeBrowser({ permission: "granted", subscribed: true })
    const pending: Array<() => void> = []
    const registration = await browser.ports.serviceWorker.getRegistration()
    const store = createPushSubscription({
      publicKey: PUBLIC_KEY,
      save: () => {},
      remove: () => {},
      ...browser.ports,
      serviceWorker: {
        ready: browser.ports.serviceWorker.ready,
        // Each lookup waits until the test lets it through.
        getRegistration: () => new Promise((resolve) => pending.push(() => resolve(registration))),
      },
    })

    const older = store.refresh()
    browser.state.permission = "denied"
    const newer = store.refresh()
    await newer
    expect(store.status.value).toBe("blocked")
    pending.forEach((release) => release())
    await older

    expect(store.status.value).toBe("blocked")
  })
})
