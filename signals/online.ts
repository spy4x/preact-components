import { type ReadonlySignal, signal } from "@preact/signals"

/**
 * `@spy4x/preact-signals/online` — whether the browser says it has a network, on a signal.
 *
 * The source app kept a module-level signal and a free `watchConnection` function next to its own
 * request state. Here the signal lives in a store the caller creates, and the window and the
 * navigator arrive as ports, so a test needs neither a browser nor a reset between cases.
 */

/** Event port. `window` satisfies it. */
export interface OnlineTarget {
  addEventListener(type: "online" | "offline", listener: () => void): void
  removeEventListener(type: "online" | "offline", listener: () => void): void
}

/** Network-state port. `navigator` satisfies it; `onLine` is optional because Deno has none. */
export interface OnlineNavigator {
  readonly onLine?: boolean
}

/** Everything the store needs from the outside. All optional; defaults are the browser ones. */
export interface OnlinePorts {
  /** Where `online` and `offline` events arrive. Defaults to `globalThis.window` when it exists. */
  target?: OnlineTarget | null
  /** What `navigator.onLine` says. Defaults to `globalThis.navigator` when it exists. */
  navigator?: OnlineNavigator | null
}

/** The browser's network state, and the wiring that keeps it current. */
export interface OnlineStatus {
  /**
   * `true` while the browser reports a network. Also `true` when the runtime has no
   * `navigator.onLine` to ask, such as during server rendering.
   */
  online: ReadonlySignal<boolean>
  /**
   * Read `navigator.onLine` again and follow the `online` and `offline` events from then on.
   *
   * Each call adds its own pair of listeners, so two callers can watch at once and stopping one
   * leaves the other following.
   *
   * @returns The function that removes this call's listeners. Calling it twice is harmless.
   */
  watch(): () => void
}

/** `navigator.onLine`, or `true` when this runtime has nothing to ask. */
function readOnline(navigator: OnlineNavigator | null): boolean {
  return navigator?.onLine ?? true
}

/**
 * Create an online status store. It reads `navigator.onLine` once for its first value and listens
 * to nothing until {@link OnlineStatus.watch} runs.
 *
 * @example
 * ```ts
 * export const connection = createOnlineStatus()
 * // in the client entry point:
 * connection.watch()
 * ```
 */
export function createOnlineStatus(ports: OnlinePorts = {}): OnlineStatus {
  const navigator = ports.navigator === undefined ? globalThis.navigator ?? null : ports.navigator
  const online = signal(readOnline(navigator))

  function watch(): () => void {
    // Deno 2 has no `window`, so a server render resolves to no target and only re-reads.
    const target = ports.target === undefined
      ? (globalThis as { window?: OnlineTarget }).window ?? null
      : ports.target
    const up = (): void => {
      online.value = true
    }
    const down = (): void => {
      online.value = false
    }
    online.value = readOnline(navigator)
    target?.addEventListener("online", up)
    target?.addEventListener("offline", down)
    return () => {
      target?.removeEventListener("online", up)
      target?.removeEventListener("offline", down)
    }
  }

  return { online, watch }
}
