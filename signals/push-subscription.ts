import { type ReadonlySignal, signal } from "@preact/signals"
import { useEffect, useMemo, useRef } from "preact/hooks"
import {
  type InstallPromptMatchMedia,
  type InstallPromptNavigator,
  isIosDevice,
  isStandalone,
} from "./install-prompt.ts"

/**
 * `@spy4x/preact-signals/push-subscription` — whether this device gets push notifications, and
 * turning them on and off, on signals.
 *
 * A device is notified when three things agree: the browser allows notifications for the site, the
 * browser holds a push subscription, and the server has stored that subscription. This store keeps
 * them in step. Turning on asks for permission (only then, so the browser's prompt never opens on
 * page load), subscribes with the server's public key and hands the subscription to the caller's
 * `save`; when `save` fails it unsubscribes again. Turning off calls the caller's `remove`, then
 * unsubscribes. It reads the permission again whenever the page becomes visible, because a person
 * can change it in the browser's settings while the page is in the background.
 *
 * The service worker, `Notification`, the navigator, `matchMedia` and the page arrive as ports, so
 * a test needs no browser and no push service. `PushSettings` in `@spy4x/preact-system` draws what
 * this store reports.
 */

/** A push subscription as `PushSubscription.toJSON()` gives it: what the server stores. */
export interface PushSubscriptionData {
  /** The push service's address for this device. It identifies the subscription. */
  endpoint?: string
  /** When the push service drops the subscription, in milliseconds since 1970, if it says. */
  expirationTime?: number | null
  /** The `p256dh` and `auth` keys the server encrypts each message with, base64url. */
  keys?: Record<string, string>
}

/** The slice of `PushSubscription` this store uses. */
export interface PushSubscriptionLike {
  readonly endpoint: string
  toJSON(): PushSubscriptionData
  unsubscribe(): Promise<boolean>
}

/** The slice of `PushManager` this store uses. */
export interface PushManagerLike {
  getSubscription(): Promise<PushSubscriptionLike | null>
  subscribe(options: {
    userVisibleOnly: boolean
    applicationServerKey: Uint8Array<ArrayBuffer>
  }): Promise<PushSubscriptionLike>
}

/** The slice of `ServiceWorkerRegistration` this store uses. An old browser has no `pushManager`. */
export interface PushRegistrationLike {
  readonly pushManager?: PushManagerLike
}

/** Service-worker port. `navigator.serviceWorker` satisfies it. */
export interface PushServiceWorker {
  /** The page's registration, or `undefined` when the app registered no service worker. */
  getRegistration(): Promise<PushRegistrationLike | undefined>
  /** Settles once a service worker is active, which a subscription needs. */
  readonly ready: Promise<PushRegistrationLike>
}

/** Permission port. The global `Notification` satisfies it. */
export interface PushNotificationPort {
  /** `"default"` (not asked yet, or dismissed), `"granted"` or `"denied"`. */
  readonly permission: string
  /** Opens the browser's permission prompt and settles with the answer. */
  requestPermission(): Promise<string>
}

/** Page-visibility port. `document` satisfies it. */
export interface PushVisibility {
  readonly visibilityState: string
  addEventListener(type: "visibilitychange", listener: () => void): void
  removeEventListener(type: "visibilitychange", listener: () => void): void
}

/**
 * What the store reports about this device.
 *
 * - `checking`: not read yet, or the server's key is still loading.
 * - `unsupported`: the browser has no push notifications.
 * - `needs-install`: an iPhone or iPad, where they work only in the app added to the home screen.
 * - `unavailable`: the server has no public key, so it cannot send any.
 * - `blocked`: the person, or a policy, denied notifications for this site in the browser.
 * - `off`: possible, and not subscribed on this device.
 * - `on`: allowed and subscribed on this device.
 */
export type PushStatus =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "unavailable"
  | "blocked"
  | "off"
  | "on"

/** What the person asked for: turn on, turn off, or send a test notification. */
export type PushAction = "enable" | "disable" | "test"

/** What {@link createPushSubscription} needs. Only the key and the two server calls are required. */
export interface PushSubscriptionOptions {
  /**
   * The server's VAPID public key, base64url, as `applicationServerKey` wants it. `undefined` means
   * it is still loading (`checking`); `null` or an empty string means the server has none
   * (`unavailable`).
   */
  publicKey: string | null | undefined
  /**
   * Store the subscription on the server for the signed-in person. A rejection, or a throw, undoes
   * the browser's subscription, so the two never disagree.
   */
  save(subscription: PushSubscriptionData): void | Promise<unknown>
  /**
   * Delete the subscription with this endpoint from the server. It runs before the browser
   * unsubscribes; a rejection leaves both in place. Deleting one that is already gone must succeed,
   * because a retry after a failed unsubscribe calls it again.
   */
  remove(endpoint: string): void | Promise<unknown>
  /** Ask the server to send this person a test notification. Left out, there is no test. */
  sendTest?: () => void | Promise<unknown>
  /** Told about every failure the store catches, with the action it happened in. For logging. */
  onError?: (error: unknown, action: PushAction | "refresh") => void
  /** Defaults to `navigator.serviceWorker` when it exists; `null` means the browser has none. */
  serviceWorker?: PushServiceWorker | null
  /** Defaults to the global `Notification` when it exists; `null` means the browser has none. */
  notification?: PushNotificationPort | null
  /** Tells an iPhone or iPad apart. Defaults to `globalThis.navigator` when it exists. */
  navigator?: InstallPromptNavigator | null
  /** Tells an installed app apart. Defaults to `globalThis.matchMedia` when it exists. */
  matchMedia?: InstallPromptMatchMedia | null
  /**
   * Whose `visibilitychange` re-reads the permission. Defaults to `globalThis.document` when it
   * exists; `null` listens nowhere.
   */
  visibility?: PushVisibility | null
}

/** The push state of this device, and the actions that change it. No action ever rejects. */
export interface PushSubscriptionStore {
  /** See {@link PushStatus}. `checking` until the first {@link PushSubscriptionStore.refresh}. */
  status: ReadonlySignal<PushStatus>
  /** The action running now, or `null`. A second action is ignored while one runs. */
  busy: ReadonlySignal<PushAction | null>
  /** The action that failed last, or `null`. Cleared when the next action starts. */
  failed: ReadonlySignal<PushAction | null>
  /** `true` once a test notification was sent. Cleared when the next action starts. */
  sent: ReadonlySignal<boolean>
  /** Read the permission and the browser's subscription again. It never opens a prompt. */
  refresh(): Promise<void>
  /**
   * Turn notifications on for this device: ask for permission when the browser has not asked yet,
   * subscribe, and `save`. A dismissed prompt leaves `off` and is not a failure; a denied one gives
   * `blocked`. Call it from a click: browsers show the prompt only after a gesture.
   */
  enable(): Promise<void>
  /** Turn notifications off for this device: `remove` from the server, then unsubscribe. */
  disable(): Promise<void>
  /** Run `sendTest`, and set {@link PushSubscriptionStore.sent} when it succeeds. */
  test(): Promise<void>
  /**
   * {@link PushSubscriptionStore.refresh} now, and again whenever the page becomes visible.
   *
   * @returns The function that removes the listener.
   */
  start(): () => void
}

/**
 * Decode base64url, with or without padding, to bytes. `atob` runs in every browser and in Deno,
 * Node and Bun; `Uint8Array.fromBase64` does not yet.
 *
 * @throws When the text is not base64url.
 */
function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** A port the caller gave, or the browser's own; `null` when neither exists. */
function port<T>(given: T | null | undefined, fallback: () => T | undefined): T | null {
  return given === undefined ? fallback() ?? null : given
}

/**
 * Create the push store of this device. It touches no browser API until `refresh`, `start` or an
 * action runs, so it can be created on a server.
 *
 * @param options The options, or a function that returns them. A function is read again on every
 * call, so a key that arrives later, or a new `save`, is picked up; {@link usePushSubscription}
 * passes one.
 *
 * @example
 * ```ts
 * export const push = createPushSubscription({
 *   publicKey: config.pushPublicKey ?? null,
 *   save: (subscription) => api.post("/push/subscriptions", subscription),
 *   remove: (endpoint) => api.delete("/push/subscriptions", { endpoint }),
 * })
 * // in the settings view
 * useEffect(() => push.start(), [])
 * ```
 */
export function createPushSubscription(
  options: PushSubscriptionOptions | (() => PushSubscriptionOptions),
): PushSubscriptionStore {
  const read = typeof options === "function" ? options : () => options
  const status = signal<PushStatus>("checking")
  const busy = signal<PushAction | null>(null)
  const failed = signal<PushAction | null>(null)
  const sent = signal(false)
  /** Counts refreshes, so one that ends after a newer one started changes nothing. */
  let reads = 0

  const serviceWorker = (): PushServiceWorker | null =>
    port(
      read().serviceWorker,
      () =>
        (globalThis as { navigator?: { serviceWorker?: PushServiceWorker } }).navigator
          ?.serviceWorker,
    )
  const notification = (): PushNotificationPort | null =>
    port(
      read().notification,
      () => (globalThis as { Notification?: PushNotificationPort }).Notification,
    )

  /** The status that needs no subscription lookup, or `null` when the browser must be asked. */
  function settled(): PushStatus | null {
    const current = read()
    const permission = notification()
    if (!serviceWorker() || !permission) {
      const navigator = port(current.navigator, () => globalThis.navigator)
      const matchMedia = port(
        current.matchMedia,
        () => (globalThis as { matchMedia?: InstallPromptMatchMedia }).matchMedia?.bind(globalThis),
      )
      // Safari on iPhone and iPad has no push in a browser tab, only in the home-screen app.
      return isIosDevice(navigator) && !isStandalone(navigator, matchMedia)
        ? "needs-install"
        : "unsupported"
    }
    if (current.publicKey === undefined) return "checking"
    if (!current.publicKey) return "unavailable"
    if (permission.permission === "denied") return "blocked"
    return null
  }

  async function lookUp(): Promise<PushStatus> {
    const known = settled()
    if (known) return known
    const registration = await serviceWorker()?.getRegistration()
    if (registration && !registration.pushManager) return "unsupported"
    const subscription = await registration?.pushManager?.getSubscription()
    // A subscription the browser kept after the permission went back to "ask" delivers nothing.
    return subscription && notification()?.permission === "granted" ? "on" : "off"
  }

  async function refresh(): Promise<void> {
    const mine = ++reads
    let next: PushStatus
    try {
      next = await lookUp()
    } catch (error) {
      // A page that may not use service workers at all, such as one served without HTTPS.
      read().onError?.(error, "refresh")
      next = "unsupported"
    }
    // An action sets the status itself when it ends; a newer refresh has fresher facts.
    if (mine === reads && busy.value === null) status.value = next
  }

  /** Run one action: one at a time, never rejecting, with `busy` and `failed` kept for it. */
  async function run(action: PushAction, work: () => Promise<void>): Promise<void> {
    if (busy.value !== null) return
    busy.value = action
    failed.value = null
    sent.value = false
    let failure: { error: unknown } | null = null
    try {
      await work()
    } catch (error) {
      failure = { error }
    }
    busy.value = null
    if (!failure) return
    failed.value = action
    read().onError?.(failure.error, action)
    // Whatever went wrong, show what the browser holds now.
    await refresh()
  }

  function enable(): Promise<void> {
    return run("enable", async () => {
      const current = read()
      const permission = notification()
      const worker = serviceWorker()
      if (!permission || !worker || !current.publicKey) {
        throw new Error("createPushSubscription: push notifications are not available here")
      }
      const answer = permission.permission === "default"
        ? await permission.requestPermission()
        : permission.permission
      if (answer !== "granted") {
        // "denied" is blocked; anything else is a prompt the person closed, so nothing changed.
        status.value = answer === "denied" ? "blocked" : "off"
        return
      }
      // `ready` never settles in an app that registered no service worker, so ask first.
      if (!await worker.getRegistration()) {
        throw new Error("createPushSubscription: the app has registered no service worker")
      }
      const manager = (await worker.ready).pushManager
      if (!manager) throw new Error("createPushSubscription: this browser has no push manager")
      const subscription = await manager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(current.publicKey),
      })
      try {
        await current.save(subscription.toJSON())
      } catch (error) {
        // The server does not know this device, so the browser must not think it is subscribed.
        await subscription.unsubscribe().catch(() => false)
        throw error
      }
      status.value = "on"
    })
  }

  function disable(): Promise<void> {
    return run("disable", async () => {
      const registration = await serviceWorker()?.getRegistration()
      const subscription = await registration?.pushManager?.getSubscription()
      if (subscription) {
        await read().remove(subscription.endpoint)
        if (!await subscription.unsubscribe()) {
          throw new Error("createPushSubscription: the browser kept the subscription")
        }
      }
      status.value = settled() ?? "off"
    })
  }

  function test(): Promise<void> {
    return run("test", async () => {
      const send = read().sendTest
      if (!send) throw new Error("createPushSubscription: no sendTest was given")
      await send()
      sent.value = true
    })
  }

  function start(): () => void {
    const visibility = port(
      read().visibility,
      () => (globalThis as { document?: PushVisibility }).document,
    )
    const onVisibility = (): void => {
      if (visibility?.visibilityState === "visible") void refresh()
    }
    void refresh()
    visibility?.addEventListener("visibilitychange", onVisibility)
    return () => visibility?.removeEventListener("visibilitychange", onVisibility)
  }

  return { status, busy, failed, sent, refresh, enable, disable, test, start }
}

/** What {@link usePushSubscription} returns: the props `PushSettings` takes, as plain values. */
export interface PushSettingsState {
  /** See {@link PushStatus}. */
  status: PushStatus
  /** The action running now, or `null`. */
  busy: PushAction | null
  /** The action that failed last, or `null`. */
  failed: PushAction | null
  /** `true` once a test notification was sent. */
  sent: boolean
  /** Turn notifications on for this device. */
  onEnable: () => void
  /** Turn notifications off for this device. */
  onDisable: () => void
  /** Send a test notification. Present only when `sendTest` was given. */
  onTest?: () => void
}

/**
 * The push state of this device for one component, ready to spread into `PushSettings` from
 * `@spy4x/preact-system`. It reads the browser after the first render and whenever the page becomes
 * visible again, and the listener goes when the component unmounts.
 *
 * The store is made once; the options are read again on every action, so a `publicKey` that
 * arrives later moves the status from `checking` on the render that brings it.
 *
 * @example
 * ```tsx
 * function NotificationSettings({ publicKey }: { publicKey: string | null | undefined }) {
 *   const push = usePushSubscription({
 *     publicKey,
 *     save: (subscription) => api.post("/push/subscriptions", subscription),
 *     remove: (endpoint) => api.delete("/push/subscriptions", { endpoint }),
 *     sendTest: () => api.post("/push/test"),
 *   })
 *   return <PushSettings {...push} />
 * }
 * ```
 */
export function usePushSubscription(options: PushSubscriptionOptions): PushSettingsState {
  const latest = useRef(options)
  latest.current = options
  const store = useMemo(() => createPushSubscription(() => latest.current), [])
  // Starting again re-reads the browser with the key this render brought.
  useEffect(() => store.start(), [store, options.publicKey])
  return {
    status: store.status.value,
    busy: store.busy.value,
    failed: store.failed.value,
    sent: store.sent.value,
    onEnable: store.enable,
    onDisable: store.disable,
    onTest: options.sendTest ? store.test : undefined,
  }
}
