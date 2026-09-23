/**
 * `SWUpdater` — service-worker registration and the "new version available" bar.
 *
 * The component is a thin shell over five pure, injectable pieces ({@link serviceWorkerContainer},
 * {@link startUpdates}, {@link watchForUpdate}, {@link skipWaiting},
 * {@link reloadOnControllerChange}), which is what keeps the update story testable: every listener
 * is exercised against a fake registration instead of a browser, and {@link startUpdates} — the
 * whole body of the component's effect — can be driven with a fake container, so the registration
 * call itself is observable without one.
 *
 * The bar renders only once a worker is *waiting*, so a first install — where no worker controls
 * the page yet — never tells the visitor to reload. Nothing reloads until the visitor presses
 * Reload, and then only in the tab where they pressed it.
 *
 * The live region around that bar is a different matter: it is in the page from the first render,
 * empty, so the message arrives as a *change* to a region rather than as a region that arrives
 * carrying a message. See {@link SWUpdater} for why that distinction is the whole component.
 *
 * Every string the bar shows has an English default and a prop that overrides it.
 */

import { cn } from "@preact-components/cn"
import type { JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"

/** The slice of `ServiceWorker` this package uses. */
export interface WorkerLike {
  state: string
  postMessage(message: unknown): void
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

/** The slice of `ServiceWorkerRegistration` this package uses. */
export interface RegistrationLike {
  installing: WorkerLike | null
  waiting: WorkerLike | null
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

/** The slice of `ServiceWorkerContainer` this package uses. */
export interface ContainerLike {
  controller: unknown
  register(scriptUrl: string, options?: { scope?: string }): Promise<RegistrationLike>
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

/** Anything that may carry a service-worker container: `navigator`, a test double. */
export interface ServiceWorkerHost {
  serviceWorker?: ContainerLike
}

/**
 * The service-worker container of a host, or `undefined` when there is none.
 *
 * The default host is `globalThis.navigator`, because that is where a browser keeps the container:
 * a page has no `globalThis.serviceWorker`, only a worker's own scope does. Reading it off
 * `globalThis` is the bug this function shipped with, and no test could see it — Deno and a server
 * render have no container either way, so the component quietly did nothing in every browser.
 * Going through `globalThis.navigator` keeps the lookup a property read rather than a `typeof
 * navigator` dance, so a server render still gets `undefined` instead of a `ReferenceError`.
 *
 * @param host Where to look; defaults to `globalThis.navigator`.
 * @returns The container, or `undefined` off a browser.
 */
export function serviceWorkerContainer(
  host: ServiceWorkerHost | undefined = globalThis.navigator as unknown as ServiceWorkerHost,
): ContainerLike | undefined {
  return host?.serviceWorker
}

/** Tuning for {@link watchForUpdate}. */
export interface UpdateWatcher {
  /**
   * Whether a worker already controls the page.
   *
   * A registration that finishes installing with no controller is the *first* install, where
   * reloading would gain the visitor nothing.
   */
  hasController: () => boolean
  /** Called once as soon as an update is known to be waiting. */
  onUpdate: () => void
}

/**
 * Watch a registration for an update and report it once.
 *
 * Covers both races: a worker already `waiting` at registration time (the tab was closed and
 * reopened after a deploy) and one that becomes `installed` while the page is open. The returned
 * function detaches every listener it added, including the per-worker `statechange`, so an
 * unmounting island leaves no handler behind.
 */
export function watchForUpdate(
  registration: RegistrationLike,
  { hasController, onUpdate }: UpdateWatcher,
): () => void {
  let disposed = false
  let installingListener: WorkerLike | undefined

  const notify = () => {
    if (disposed) return
    onUpdate()
  }

  if (registration.waiting) notify()

  const onStateChange = () => {
    if (installingListener && installingListener.state === "installed" && hasController()) {
      notify()
    }
  }

  const onUpdateFound = () => {
    if (disposed) return
    const installing = registration.installing
    if (!installing) return
    installingListener = installing
    installing.addEventListener("statechange", onStateChange)
  }

  registration.addEventListener("updatefound", onUpdateFound)

  return () => {
    disposed = true
    registration.removeEventListener("updatefound", onUpdateFound)
    installingListener?.removeEventListener("statechange", onStateChange)
    installingListener = undefined
  }
}

/**
 * What a waiting worker is told to take over with, when the caller names nothing else.
 *
 * This is a **contract with the service worker**, not an implementation detail. The worker has to
 * recognise the message and call `self.skipWaiting()`; one that speaks a different dialect —
 * `{ type: "SKIP_WAITING" }` is the other common one — ignores it, never takes over, and the
 * Reload button does nothing the visitor can see. Such a worker is accommodated through
 * `SWUpdater`'s `updateMessage` prop rather than by editing this package.
 *
 * ```js
 * // The worker's half of the contract:
 * self.addEventListener("message", (event) => {
 *   if (event.data?.action === "skipWaiting") self.skipWaiting()
 * })
 * ```
 */
export const DEFAULT_UPDATE_MESSAGE: unknown = { action: "skipWaiting" }

/**
 * Tell the waiting worker to take over.
 *
 * @param registration Registration whose waiting worker should take over.
 * @param message What to post; see {@link DEFAULT_UPDATE_MESSAGE} for the contract it carries.
 * @returns Whether a message was actually posted — `false` means there was no waiting worker, and
 * the caller should not promise the visitor a hand-over.
 */
export function skipWaiting(
  registration: RegistrationLike | null | undefined,
  message: unknown = DEFAULT_UPDATE_MESSAGE,
): boolean {
  if (!registration?.waiting) return false
  registration.waiting.postMessage(message)
  return true
}

/**
 * Reload once a new worker takes control of the page.
 *
 * `controllerchange` is the only signal that the new code is actually serving; reloading before
 * it is what produces the classic "reload to get the update, then reload again" double tap.
 *
 * **Arm this when the visitor asks for the reload, never when the page registers.** The event
 * fires in every tab the new worker takes over, so a listener armed at registration time reloads
 * tabs whose visitor pressed nothing — including the one with a half-filled form.
 */
export function reloadOnControllerChange(container: ContainerLike, reload: () => void): () => void {
  const listener = () => reload()
  container.addEventListener("controllerchange", listener)
  return () => container.removeEventListener("controllerchange", listener)
}

/** Everything {@link startUpdates} needs beyond the container itself. */
export interface UpdateStart {
  /** Service-worker script URL. Defaults to `"/sw.js"`. */
  scriptUrl?: string
  /** Registration scope. Omitted entirely when absent, matching `register()`'s own default. */
  scope?: string
  /** Called with the registration as soon as it resolves. */
  onRegistered?: (registration: RegistrationLike) => void
  /** Called once as soon as an update is waiting. */
  onUpdate?: () => void
  /** Called when registration fails. */
  onError?: (error: unknown) => void
}

/**
 * Register the service worker and watch that registration for an update.
 *
 * This is the whole body of {@link SWUpdater}'s effect, lifted out of the component on purpose.
 * Every test in this repository renders to an HTML string and therefore runs no effect, so a
 * registration call left inside the component is a call only a browser can execute — which is how
 * the component came to look for its container in the wrong place with no test noticing. Given a
 * fake container this is an ordinary function, and the script it registers is an ordinary
 * assertion.
 *
 * @param container Service-worker container to register with.
 * @param options Script URL, scope, and the three ports.
 * @returns A function that detaches every listener and abandons a registration still in flight.
 */
export function startUpdates(
  container: ContainerLike,
  { scriptUrl = "/sw.js", scope, onRegistered, onUpdate, onError }: UpdateStart = {},
): () => void {
  let stopWatching: (() => void) | undefined
  let cancelled = false

  container.register(scriptUrl, scope ? { scope } : undefined)
    .then((registration) => {
      // Stopped while `register` was in flight: drop the registration on the floor instead of
      // arming listeners the caller can no longer disarm.
      if (cancelled) return
      onRegistered?.(registration)
      stopWatching = watchForUpdate(registration, {
        hasController: () => Boolean(container.controller),
        onUpdate: () => onUpdate?.(),
      })
    })
    .catch((error: unknown) => onError?.(error))

  return () => {
    cancelled = true
    stopWatching?.()
    stopWatching = undefined
  }
}

export interface SWUpdaterProps {
  /** Service-worker script URL. Defaults to `"/sw.js"`. */
  scriptUrl?: string
  /** Registration scope. Omitted entirely when absent, matching `register()`'s own default. */
  scope?: string
  /**
   * Service-worker container port. Defaults to the browser's, `globalThis.navigator.serviceWorker`.
   *
   * Supplying one is how a test drives the component without a browser, and how a host that owns
   * its own registration hands over the container it already has.
   */
  container?: ContainerLike
  /** Bar copy. Defaults to `"New version available"`. */
  message?: string
  /** Reload button copy. Defaults to `"Reload"`. */
  reloadLabel?: string
  /** Dismiss button copy. Defaults to `"Dismiss"`. */
  dismissLabel?: string
  /**
   * What to post to the waiting worker when the visitor presses Reload.
   *
   * Defaults to {@link DEFAULT_UPDATE_MESSAGE}, and it is a contract with the service worker: one
   * that does not recognise the message never calls `self.skipWaiting()`, never takes over, and
   * leaves the Reload button doing nothing a visitor can see.
   */
  updateMessage?: unknown
  /** Reload port. Defaults to `globalThis.location.reload()`. */
  reload?: () => void
  /** Called the moment an update is detected, before the bar renders. */
  onUpdate?: () => void
  /** Called when the visitor dismisses the bar. */
  onDismiss?: () => void
  /** Registration failure port. Ignored when absent. */
  onError?: (error: unknown) => void
  /** Utilities for the bar container. */
  class?: string
}

const barClass =
  "fixed top-0 right-0 left-0 z-50 flex items-center gap-3 bg-orange-600 px-4 py-3 text-white shadow-lg sm:top-4 sm:right-4 sm:left-auto sm:w-auto sm:rounded-lg"
const reloadButtonClass =
  "ml-auto cursor-pointer rounded bg-white px-3 py-1 text-sm font-semibold text-gray-900 transition-colors hover:bg-orange-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden sm:ml-0"
const dismissButtonClass =
  "cursor-pointer rounded px-2 py-1 text-sm font-medium text-white/90 transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden"

/**
 * Register the service worker and offer a reload when a new version is waiting.
 *
 * **The live region is in the document at all times, including before anything has happened**,
 * which is a change from the version that returned `null` until an update existed. That empty
 * region is what makes the message announceable: assistive technology announces a *change* to a
 * region it is already watching, and commonly says nothing at all about a region that arrives with
 * its text already inside it. A `role="status"` added to a bar that only appears with its own
 * message would therefore have announced nothing, which is precisely the defect this replaces.
 *
 * What is always there is only the region: no class, no padding, no border, no minimum height, so
 * an empty one paints nothing and is zero pixels tall. It is an ordinary in-flow element, which is
 * not quite the same as free — a `flex` or `grid` parent charges a full 16px for a child with no
 * height, whether it spaces its children with `gap-4` or with a `space-y-4` margin, because neither
 * a gap nor a margin between flex or grid items collapses. Block flow costs nothing either way.
 * `system/README.md` has the measurements and says where a host should mount it. The `class` prop
 * goes to the bar rather than to the region, so no caller can give the region a box. The visible
 * bar, the
 * Reload button and the Dismiss control appear inside it when — and only when — a worker is
 * waiting. `aria-atomic` is set explicitly although `role="status"` already implies it, so a reader
 * announces the whole sentence and its two controls rather than the one text node that changed.
 *
 * Two things happen only on the visitor's word. The reload listener is armed by the Reload button
 * rather than by the effect, because `controllerchange` fires in every tab the new worker takes
 * over and arming it at registration time reloads tabs nobody touched. And the bar can be
 * dismissed, because it covers the top of the page and a visitor who is not ready to reload has to
 * be able to put it away.
 *
 * A dismissal puts *that* update away rather than the component: the next update to be reported
 * clears it, so the message leaves the region and later arrives in it again as a fresh change.
 * Without that, a visitor who dismissed one version was never told about any version after it.
 */
export function SWUpdater(
  {
    scriptUrl,
    scope,
    container,
    message = "New version available",
    reloadLabel = "Reload",
    dismissLabel = "Dismiss",
    updateMessage,
    reload,
    onUpdate,
    onDismiss,
    onError,
    class: className,
  }: SWUpdaterProps,
): JSX.Element {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [registration, setRegistration] = useState<RegistrationLike | null>(null)
  const containerRef = useRef<ContainerLike | undefined>(undefined)
  const stopReload = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    // Resolved inside the effect: a server render must not touch `navigator`, and the prop is what
    // lets a test or a host hand over a container of its own.
    const resolved = container ?? serviceWorkerContainer()
    if (!resolved) return
    containerRef.current = resolved

    const stop = startUpdates(resolved, {
      scriptUrl,
      scope,
      onRegistered: setRegistration,
      onUpdate: () => {
        setAvailable(true)
        // A dismissal is about one update, not about the component: clearing it here is what lets a
        // later version put the message back into the region the visitor emptied.
        setDismissed(false)
        onUpdate?.()
      },
      onError,
    })

    return () => {
      stop()
      stopReload.current?.()
      stopReload.current = undefined
      containerRef.current = undefined
    }
  }, [])

  const requestReload = () => {
    const reloadPage = reload ?? (() => globalThis.location?.reload())
    const target = containerRef.current
    // Armed here and nowhere else: this tab asked for the reload, so this tab is the one that
    // reloads when the new worker takes control.
    if (target && !stopReload.current) {
      stopReload.current = reloadOnControllerChange(target, reloadPage)
    }
    // Nothing is waiting to take over, so no `controllerchange` is ever coming — the visitor asked
    // for the new version, so fetch it now instead of leaving the button dead.
    if (!skipWaiting(registration, updateMessage)) reloadPage()
  }

  // The region is unconditional and carries no styling of its own. Everything the visitor can see
  // or press is the conditional part, inside it.
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {available && !dismissed
        ? (
          <div class={cn(barClass, className)}>
            <span class="text-sm">{message}</span>
            <button type="button" onClick={requestReload} class={reloadButtonClass}>
              {reloadLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(true)
                onDismiss?.()
              }}
              class={dismissButtonClass}
            >
              {dismissLabel}
            </button>
          </div>
        )
        : null}
    </div>
  )
}
