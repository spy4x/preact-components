import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  createInstallPrompt,
  type InstallPromptEvent,
  type InstallPromptTarget,
  isIosDevice,
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
})
