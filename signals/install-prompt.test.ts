import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  createInstallPrompt,
  createStoredInstallPrompt,
  INSTALL_DISMISSED_KEY,
  type InstallPromptEvent,
  type InstallPromptTarget,
  isIosDevice,
  isIosInAppBrowser,
  isStandalone,
} from "./install-prompt.ts"

type Listener = (event: InstallPromptEvent) => void

/** An event target that records its listeners and fires them on demand, like `window` would. */
function fakeTarget() {
  const listeners = { beforeinstallprompt: new Set<Listener>(), appinstalled: new Set<Listener>() }
  const target: InstallPromptTarget = {
    addEventListener(type, listener) {
      listeners[type].add(listener)
    },
    removeEventListener(type, listener) {
      listeners[type].delete(listener)
    },
  }
  const fire = (type: keyof typeof listeners, event: InstallPromptEvent) =>
    listeners[type].forEach((listener) => listener(event))
  return { target, listeners, fire }
}

/** A `beforeinstallprompt` event whose dialog answers `outcome`, and what was done with it. */
function fakeEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const calls = { preventDefault: 0, prompt: 0 }
  const event: InstallPromptEvent = {
    preventDefault: () => {
      calls.preventDefault++
    },
    prompt: () => {
      calls.prompt++
      return Promise.resolve()
    },
    userChoice: Promise.resolve({ outcome }),
  }
  return { event, calls }
}

const CHROME = { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36" }
const IPHONE = {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/604.1",
}
const IPAD_AS_MAC = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15",
  maxTouchPoints: 5,
}
const notStandalone = () => ({ matches: false })

const IOS_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
/** A bare WKWebView, as an app that opens links in its own view reports itself: no `Safari/`. */
const WEB_VIEW = { userAgent: `${IOS_AGENT} (KHTML, like Gecko) Mobile/15E148` }
const INSTAGRAM = {
  userAgent: `${IOS_AGENT} (KHTML, like Gecko) Mobile/15E148 Instagram 309.0.0.40.113 (iPhone14,5)`,
}
const FACEBOOK = {
  userAgent: `${IOS_AGENT} (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.33.116]`,
}
/** The Google app, which keeps a `Safari/` token and still has no Add to Home Screen. */
const GOOGLE_APP = {
  userAgent: `${IOS_AGENT} (KHTML, like Gecko) GSA/300.0.598994205 Mobile/15E148 Safari/604.1`,
}
const IOS_BROWSERS = {
  CriOS: `${IOS_AGENT} (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1`,
  FxiOS: `${IOS_AGENT} (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15`,
  EdgiOS:
    `${IOS_AGENT} (KHTML, like Gecko) EdgiOS/130.0.2849.80 Version/17.0 Mobile/15E148 Safari/604.1`,
}
const MAC_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"

/** The mode a fresh store picks for `navigator`, outside an installed app. */
const modeFor = (navigator: { userAgent: string; maxTouchPoints?: number } | null) =>
  createInstallPrompt({ target: null, navigator, matchMedia: notStandalone }).mode.value

describe("in-app browsers on iOS", () => {
  it("keeps Safari on an iPhone on the Share steps", () => {
    expect(modeFor(IPHONE)).toBe("ios")
    expect(isIosInAppBrowser(IPHONE)).toBe(false)
  })

  it("keeps Chrome, Firefox and Edge on an iPhone on the Share steps", () => {
    for (const userAgent of Object.values(IOS_BROWSERS)) {
      expect(modeFor({ userAgent })).toBe("ios")
      expect(isIosInAppBrowser({ userAgent })).toBe(false)
    }
  })

  it("takes a bare web view with no Safari token for an in-app browser", () => {
    expect(modeFor(WEB_VIEW)).toBe("ios-in-app")
    expect(isIosInAppBrowser(WEB_VIEW)).toBe(true)
  })

  it("knows Instagram, Facebook and the Google app by name, even beside a Safari token", () => {
    for (const navigator of [INSTAGRAM, FACEBOOK, GOOGLE_APP]) {
      expect(modeFor(navigator)).toBe("ios-in-app")
      expect(isIosInAppBrowser(navigator)).toBe(true)
    }
  })

  it("takes a web view on an iPad that calls itself a Mac for an in-app browser", () => {
    const ipadWebView = { userAgent: `${MAC_AGENT} (KHTML, like Gecko)`, maxTouchPoints: 5 }
    expect(modeFor(ipadWebView)).toBe("ios-in-app")
    expect(isIosInAppBrowser(ipadWebView)).toBe(true)
  })

  it("does not take a desktop Mac with no Safari token for an in-app browser", () => {
    const desktopMac = { userAgent: `${MAC_AGENT} (KHTML, like Gecko)`, maxTouchPoints: 0 }
    expect(modeFor(desktopMac)).toBe("unavailable")
    expect(isIosInAppBrowser(desktopMac)).toBe(false)
  })

  it("does not take a desktop Chrome for an in-app browser", () => {
    expect(modeFor(CHROME)).toBe("unavailable")
    expect(isIosInAppBrowser(CHROME)).toBe(false)
  })

  it("does not take a missing navigator for an in-app browser", () => {
    expect(modeFor(null)).toBe("unavailable")
    expect(isIosInAppBrowser(null)).toBe(false)
  })

  it("offers nothing in an in-app browser when the app already runs standalone", () => {
    const store = createInstallPrompt({
      target: null,
      navigator: { ...WEB_VIEW, standalone: true },
      matchMedia: notStandalone,
    })
    expect(store.mode.value).toBe("installed")
  })

  it("shows the in-app offer until it is dismissed, and not when dismissed before", () => {
    const store = createInstallPrompt({
      target: null,
      navigator: WEB_VIEW,
      matchMedia: notStandalone,
    })
    expect(store.visible.value).toBe(true)
    store.dismiss()
    expect(store.visible.value).toBe(false)

    const before = createInstallPrompt({
      target: null,
      navigator: WEB_VIEW,
      matchMedia: notStandalone,
      dismissed: { read: () => true, write: () => {} },
    })
    expect(before.mode.value).toBe("ios-in-app")
    expect(before.visible.value).toBe(false)
  })
})

describe("createInstallPrompt", () => {
  it("offers the browser's dialog once beforeinstallprompt fires", () => {
    const { target, fire } = fakeTarget()
    const store = createInstallPrompt({ target, navigator: CHROME, matchMedia: notStandalone })
    store.watch()
    expect(store.mode.value).toBe("unavailable")
    expect(store.visible.value).toBe(false)

    const { event, calls } = fakeEvent()
    fire("beforeinstallprompt", event)

    expect(store.mode.value).toBe("prompt")
    expect(store.visible.value).toBe(true)
    expect(calls.preventDefault).toBe(1)
  })

  it("opens the dialog on install and reports the person's answer", async () => {
    const { target, fire } = fakeTarget()
    const store = createInstallPrompt({ target, navigator: CHROME, matchMedia: notStandalone })
    store.watch()
    const { event, calls } = fakeEvent("accepted")
    fire("beforeinstallprompt", event)

    expect(await store.install()).toBe("accepted")
    expect(calls.prompt).toBe(1)
    expect(store.mode.value).toBe("installed")
    expect(store.visible.value).toBe(false)
  })

  it("uses the event once: a declined dialog leaves nothing to offer", async () => {
    const { target, fire } = fakeTarget()
    const store = createInstallPrompt({ target, navigator: CHROME, matchMedia: notStandalone })
    store.watch()
    const { event, calls } = fakeEvent("dismissed")
    fire("beforeinstallprompt", event)

    expect(await store.install()).toBe("dismissed")
    expect(store.mode.value).toBe("unavailable")
    expect(await store.install()).toBe("unavailable")
    expect(calls.prompt).toBe(1)
  })

  it("ends the offer when the install dialog fails to open", async () => {
    const { target, fire } = fakeTarget()
    const store = createInstallPrompt({ target, navigator: CHROME, matchMedia: notStandalone })
    store.watch()
    const { event } = fakeEvent()
    fire("beforeinstallprompt", {
      ...event,
      prompt: () => Promise.reject(new Error("NotAllowedError")),
    })

    await expect(store.install()).rejects.toThrow("NotAllowedError")
    expect(store.mode.value).toBe("unavailable")
    expect(store.visible.value).toBe(false)
  })

  it("shows the iOS steps on an iPhone, where no event ever fires", () => {
    const store = createInstallPrompt({
      target: null,
      navigator: IPHONE,
      matchMedia: notStandalone,
    })

    expect(store.mode.value).toBe("ios")
    expect(store.visible.value).toBe(true)
  })

  it("offers nothing when the app already runs standalone", () => {
    const { target, fire } = fakeTarget()
    const store = createInstallPrompt({
      target,
      navigator: IPHONE,
      matchMedia: (query) => ({ matches: query === "(display-mode: standalone)" }),
    })
    store.watch()
    fire("beforeinstallprompt", fakeEvent().event)

    expect(store.mode.value).toBe("installed")
    expect(store.visible.value).toBe(false)
  })

  it("turns installed when appinstalled fires", () => {
    const { target, fire } = fakeTarget()
    const store = createInstallPrompt({ target, navigator: CHROME, matchMedia: notStandalone })
    store.watch()
    fire("beforeinstallprompt", fakeEvent().event)
    fire("appinstalled", fakeEvent().event)

    expect(store.mode.value).toBe("installed")
  })

  it("hides the offer once dismissed and stores the flag through the port", () => {
    const writes: boolean[] = []
    const store = createInstallPrompt({
      target: null,
      navigator: IPHONE,
      matchMedia: notStandalone,
      dismissed: { read: () => false, write: (value) => void writes.push(value) },
    })

    store.dismiss()

    expect(store.visible.value).toBe(false)
    expect(writes).toEqual([true])
  })

  it("reads the stored flag on first use, not when it is created", () => {
    let reads = 0
    const store = createInstallPrompt({
      target: null,
      navigator: IPHONE,
      matchMedia: notStandalone,
      dismissed: { read: () => (reads++, true), write: () => {} },
    })

    expect(reads).toBe(0)
    expect(store.visible.value).toBe(false)
    expect(store.dismissed.value).toBe(true)
    expect(reads).toBe(1)
  })

  it("starts hidden when the port says the offer was dismissed before", () => {
    const store = createInstallPrompt({
      target: null,
      navigator: IPHONE,
      matchMedia: notStandalone,
      dismissed: { read: () => true, write: () => {} },
    })

    expect(store.mode.value).toBe("ios")
    expect(store.visible.value).toBe(false)
  })

  it("shows the offer again when the port fails to store the dismissal", async () => {
    const store = createInstallPrompt({
      target: null,
      navigator: IPHONE,
      matchMedia: notStandalone,
      dismissed: { read: () => false, write: () => Promise.reject(new Error("quota")) },
    })

    await expect(store.dismiss()).rejects.toThrow("quota")
    expect(store.visible.value).toBe(true)
  })

  it("stops following the events once stopped", () => {
    const { target, listeners, fire } = fakeTarget()
    const store = createInstallPrompt({ target, navigator: CHROME, matchMedia: notStandalone })
    const stop = store.watch()

    stop()
    fire("beforeinstallprompt", fakeEvent().event)

    expect(store.mode.value).toBe("unavailable")
    expect(listeners.beforeinstallprompt.size + listeners.appinstalled.size).toBe(0)
  })
})

/** A storage held in memory, and one whose every call throws, as a blocked browser storage does. */
function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}
const blocked = (): never => {
  throw new Error("SecurityError")
}
const IOS = { target: null, navigator: IPHONE, matchMedia: notStandalone }

describe("createStoredInstallPrompt", () => {
  it("keeps a dismissal as 1 under install-prompt-dismissed, so a reload stays hidden", () => {
    const storage = fakeStorage()
    const store = createStoredInstallPrompt({ ...IOS, storage })
    expect(store.visible.value).toBe(true)

    store.dismiss()

    expect(store.visible.value).toBe(false)
    expect(INSTALL_DISMISSED_KEY).toBe("install-prompt-dismissed")
    expect([...storage.items]).toEqual([["install-prompt-dismissed", "1"]])
    expect(createStoredInstallPrompt({ ...IOS, storage }).visible.value).toBe(false)
  })

  it("remembers a person who dismissed before this function existed", () => {
    const storage = fakeStorage({ "install-prompt-dismissed": "1" })

    expect(createStoredInstallPrompt({ ...IOS, storage }).dismissed.value).toBe(true)
  })

  it("does not take another stored text for a dismissal", () => {
    for (const text of ["0", "true", "not json"]) {
      const storage = fakeStorage({ "install-prompt-dismissed": text })

      expect(createStoredInstallPrompt({ ...IOS, storage }).visible.value).toBe(true)
    }
  })

  it("keeps the flag under the caller's key", () => {
    const storage = fakeStorage({ "install-prompt-dismissed": "1" })
    const store = createStoredInstallPrompt({ ...IOS, storage, key: "acme:install" })
    expect(store.visible.value).toBe(true)

    store.dismiss()

    expect(storage.items.get("acme:install")).toBe("1")
  })

  it("shows the offer and hides it for this page when storage throws on read and write", () => {
    const storage = { getItem: blocked, setItem: blocked, removeItem: blocked }
    const store = createStoredInstallPrompt({ ...IOS, storage })
    expect(store.visible.value).toBe(true)

    expect(store.dismiss()).toBeUndefined()

    expect(store.visible.value).toBe(false)
  })

  it("shows the offer and hides it for this page when reading localStorage itself throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: blocked })
    try {
      const store = createStoredInstallPrompt(IOS)
      expect(store.visible.value).toBe(true)

      store.dismiss()

      expect(store.visible.value).toBe(false)
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })

  it("reads no storage when it is created, as a module-level store on a server would be", () => {
    const storage = fakeStorage({ [INSTALL_DISMISSED_KEY]: "1" })
    let reads = 0
    const store = createStoredInstallPrompt({
      ...IOS,
      storage: { ...storage, getItem: (key) => (reads++, storage.getItem(key)) },
    })

    expect(reads).toBe(0)
    expect(store.visible.value).toBe(false)
    expect(reads).toBe(1)
  })

  it("uses localStorage when no storage is given", () => {
    const storage = fakeStorage()
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => storage })
    try {
      createStoredInstallPrompt(IOS).dismiss()

      expect(storage.items.get("install-prompt-dismissed")).toBe("1")
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })

  it("keeps the flag in memory when storage is null", () => {
    const store = createStoredInstallPrompt({ ...IOS, storage: null })

    store.dismiss()

    expect(store.visible.value).toBe(false)
    expect(createStoredInstallPrompt({ ...IOS, storage: null }).visible.value).toBe(true)
  })

  it("passes the ports on, so the browser's dialog is still offered", () => {
    const { target, fire } = fakeTarget()
    const store = createStoredInstallPrompt({
      target,
      navigator: CHROME,
      matchMedia: notStandalone,
      storage: null,
    })
    store.watch()

    fire("beforeinstallprompt", fakeEvent().event)

    expect(store.mode.value).toBe("prompt")
  })
})

describe("isIosDevice", () => {
  it("knows an iPhone and an iPad that calls itself a Mac", () => {
    expect(isIosDevice(IPHONE)).toBe(true)
    expect(isIosDevice(IPAD_AS_MAC)).toBe(true)
  })

  it("does not take a desktop Mac or Chrome for iOS", () => {
    expect(isIosDevice({ userAgent: IPAD_AS_MAC.userAgent, maxTouchPoints: 0 })).toBe(false)
    expect(isIosDevice(CHROME)).toBe(false)
    expect(isIosDevice(null)).toBe(false)
  })
})

describe("isStandalone", () => {
  it("believes iOS's own flag or the display mode", () => {
    expect(isStandalone({ standalone: true }, null)).toBe(true)
    expect(isStandalone({}, () => ({ matches: true }))).toBe(true)
    expect(isStandalone({}, notStandalone)).toBe(false)
    expect(isStandalone(null, null)).toBe(false)
  })

  it("counts a minimal-ui app as installed, but not a full-screen browser tab", () => {
    const only = (mode: string) => (query: string) => ({
      matches: query === `(display-mode: ${mode})`,
    })
    expect(isStandalone({}, only("minimal-ui"))).toBe(true)
    expect(isStandalone({}, only("fullscreen"))).toBe(false)
  })
})
