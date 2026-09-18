/**
 * `SWUpdater` — service-worker registration and the "new version available" bar.
 *
 * The component is a thin shell over three pure, injectable pieces ({@link serviceWorkerContainer},
 * {@link watchForUpdate}, {@link skipWaiting}, {@link reloadOnControllerChange}), which is what
 * keeps the PWA-update story testable: every listener in the source version is exercised here
 * against a fake registration instead of a browser.
 *
 * The bar renders only once a worker is *waiting*, so a first install — where no worker controls
 * the page yet — never tells the visitor to reload.
 */

import { cn } from "@preact-components/signals/cn"
import { useEffect, useState } from "preact/hooks"

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

/** Anything that may carry a service-worker container: `globalThis`, `navigator`, a test double. */
export interface ServiceWorkerHost {
  serviceWorker?: ContainerLike
}

/**
 * The service-worker container of a host, or `undefined` when there is none.
 *
 * Callers pass `globalThis` (the default) so the lookup is a property read, never a
 * `typeof navigator` dance: server rendering and Deno both simply get `undefined`.
 */
export function serviceWorkerContainer(
  host: ServiceWorkerHost | undefined = globalThis as ServiceWorkerHost,
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
 * Tell the waiting worker to take over.
 *
 * Returns whether a message was actually posted — `false` means there was no waiting worker, and
 * the caller should not promise the visitor a reload.
 */
export function skipWaiting(registration: RegistrationLike | null | undefined): boolean {
  if (!registration?.waiting) return false
  registration.waiting.postMessage({ action: "skipWaiting" })
  return true
}

/**
 * Reload once a new worker takes control of the page.
 *
 * `controllerchange` is the only signal that the new code is actually serving; reloading before
 * it is what produces the classic "reload to get the update, then reload again" double tap.
 */
export function reloadOnControllerChange(container: ContainerLike, reload: () => void): () => void {
  const listener = () => reload()
  container.addEventListener("controllerchange", listener)
  return () => container.removeEventListener("controllerchange", listener)
}

export interface SWUpdaterProps {
  /** Service-worker script URL. Defaults to `"/sw.js"`. */
  scriptUrl?: string
  /** Registration scope. Omitted entirely when absent, matching `register()`'s own default. */
  scope?: string
  /** Bar copy. Defaults to `"New version available"`. */
  message?: string
  /** Reload button copy. Defaults to `"Reload"`. */
  reloadLabel?: string
  /** Reload port. Defaults to `globalThis.location.reload()`. */
  reload?: () => void
  /** Called the moment an update is detected, before the bar renders. */
  onUpdate?: () => void
  /** Registration failure port. Ignored when absent. */
  onError?: (error: unknown) => void
  /** Utilities for the bar container. */
  class?: string
}

const barClass =
  "fixed top-0 right-0 left-0 z-50 flex items-center gap-3 bg-orange-600 px-4 py-3 text-white shadow-lg sm:top-4 sm:right-4 sm:left-auto sm:w-auto sm:rounded-lg"
const reloadButtonClass =
  "ml-auto cursor-pointer rounded bg-white px-3 py-1 text-sm font-semibold text-gray-900 transition-colors hover:bg-orange-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden sm:ml-0"

/**
 * Register the service worker and offer a reload when a new version is waiting.
 *
 * Renders nothing until an update exists, which makes it safe to mount in a layout for every
 * visitor: no service worker (SSR, a browser without support, a test) simply means an empty
 * component.
 */
export function SWUpdater(
  {
    scriptUrl = "/sw.js",
    scope,
    message = "New version available",
    reloadLabel = "Reload",
    reload,
    onUpdate,
    onError,
    class: className,
  }: SWUpdaterProps,
) {
  const [available, setAvailable] = useState(false)
  const [registration, setRegistration] = useState<RegistrationLike | null>(null)

  useEffect(() => {
    const container = serviceWorkerContainer()
    if (!container) return

    const reloadPage = reload ?? (() => globalThis.location?.reload())
    const stopReload = reloadOnControllerChange(container, reloadPage)
    let stopWatching: (() => void) | undefined
    let cancelled = false

    container.register(scriptUrl, scope ? { scope } : undefined)
      .then((registered) => {
        // The effect was cleaned up while `register` was in flight: drop the registration on
        // the floor instead of arming listeners the unmounted component can never disarm.
        if (cancelled) return
        setRegistration(registered)
        stopWatching = watchForUpdate(registered, {
          hasController: () => Boolean(container.controller),
          onUpdate: () => {
            setAvailable(true)
            onUpdate?.()
          },
        })
      })
      .catch((error: unknown) => onError?.(error))

    return () => {
      cancelled = true
      stopWatching?.()
      stopReload()
    }
  }, [])

  if (!available) return null

  return (
    <div role="status" aria-live="polite" class={cn(barClass, className)}>
      <span class="text-sm">{message}</span>
      <button
        type="button"
        onClick={() => skipWaiting(registration)}
        class={reloadButtonClass}
      >
        {reloadLabel}
      </button>
    </div>
  )
}
