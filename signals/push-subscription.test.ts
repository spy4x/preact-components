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
const ENDPOINT = "https://push.example/device-1"

const DESKTOP = { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0 Safari/537.36" }
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1" }

/**
 * A browser the test sets up and inspects: the permission, what its prompt will answer, the one
 * subscription it can hold, and every call made to it, in order.
 */
function fakeBrowser(
  start: { permission?: string; answer?: string; subscribed?: boolean; registered?: boolean } = {},
) {
  const calls: string[] = []
  const state = {
    permission: start.permission ?? "default",
    answer: start.answer ?? "granted",
    registered: start.registered ?? true,
    subscription: null as PushSubscriptionLike | null,
    keys: [] as number[][],
    unsubscribeResult: true,
  }
  const subscription = (): PushSubscriptionLike => ({
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: () => {
      calls.push("unsubscribe")
      if (state.unsubscribeResult) state.subscription = null
      return Promise.resolve(state.unsubscribeResult)
    },
  })
  if (start.subscribed) state.subscription = subscription()
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(state.subscription),
      subscribe: (options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
        calls.push(`subscribe userVisibleOnly=${options.userVisibleOnly}`)
        state.keys.push([...options.applicationServerKey])
        state.subscription = subscription()
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
    fail: false,
    errors: [] as Array<[string, PushAction | "refresh"]>,
    save: (subscription: PushSubscriptionData) => {
      calls.push("save")
      if (server.fail) return Promise.reject(new Error("save refused"))
      server.stored.push(subscription)
      return Promise.resolve()
    },
    remove: (endpoint: string) => {
      calls.push(`remove ${endpoint}`)
      if (server.fail) return Promise.reject(new Error("remove refused"))
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
  it("reports checking and touches nothing until it is asked to read", () => {
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

  it("reports on when permission is granted and the browser holds a subscription", async () => {
    const { store } = setup({ permission: "granted", subscribed: true })

    await store.refresh()

    expect(store.status.value).toBe("on")
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

  it("unsubscribes again when save fails, reports the failure, and stays off", async () => {
    const { store, browser, server } = setup()
    server.fail = true

    await store.enable()

    expect(browser.calls).toEqual([
      "prompt",
      "subscribe userVisibleOnly=true",
      "save",
      "unsubscribe",
    ])
    expect(browser.state.subscription).toBe(null)
    expect(store.status.value).toBe("off")
    expect(store.failed.value).toBe("enable")
    expect(server.errors).toEqual([["save refused", "enable"]])
  })

  it("saves the subscription again when the browser already holds one", async () => {
    const { store, browser, server } = setup({ permission: "granted", subscribed: true })
    await store.refresh()
    expect(store.status.value).toBe("on")

    await store.enable()

    expect(browser.calls).toEqual(["subscribe userVisibleOnly=true", "save"])
    expect(server.stored).toHaveLength(1)
    expect(store.status.value).toBe("on")
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

  it("is busy with enable while it runs, and ignores a second action until it ends", async () => {
    const { store, browser } = setup()

    const first = store.enable()
    expect(store.busy.value).toBe("enable")
    await store.disable()
    await first

    expect(browser.calls).toEqual(["prompt", "subscribe userVisibleOnly=true", "save"])
    expect(store.status.value).toBe("on")
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
    server.fail = true

    await store.disable()

    expect(browser.calls).toEqual([`remove ${ENDPOINT}`])
    expect(browser.state.subscription).not.toBe(null)
    expect(store.status.value).toBe("on")
    expect(store.failed.value).toBe("disable")
  })

  it("reports a failure and stays on when the browser keeps the subscription", async () => {
    const { store, browser } = setup({ permission: "granted", subscribed: true })
    browser.state.unsubscribeResult = false

    await store.disable()

    expect(store.status.value).toBe("on")
    expect(store.failed.value).toBe("disable")
  })

  it("clears the last failure when the next action starts", async () => {
    const { store, server } = setup({ permission: "granted", subscribed: true })
    server.fail = true
    await store.disable()
    expect(store.failed.value).toBe("disable")
    server.fail = false

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
  it("reports blocked when the permission was revoked while the page was hidden", async () => {
    const { store, browser } = setup({ permission: "granted", subscribed: true })
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
