import { type ReadonlySignal, signal } from "@preact/signals"
import type { ToastMessage, ToastVariant } from "./types.ts"

/**
 * `@preact-components/signals/toast` — the store behind `Toastr`.
 *
 * Ported from financy's module-level singleton. It is a factory here so a test can inject its clock
 * and id source, and so timers are owned: a dismissed toast cancels its own timeout instead of
 * leaving a stray timer to fire against a removed id.
 */

/** A toast as the store holds it: every field filled in. */
export interface ToastEntry {
  id: string
  title: string
  body: string
  type: ToastVariant
  /** Auto-dismiss delay in milliseconds. `0` keeps the toast until it is dismissed by hand. */
  timeout: number
}

/** A toast store. `list` is what `Toastr` renders; the four shorthands are what callers use. */
export interface ToastStore {
  /** Newest last. */
  list: ReadonlySignal<ToastEntry[]>
  /** Push a toast. Returns its id, generated when the message carries none.
   *
   * Reusing an id replaces that toast in place and cancels the timer it was carrying.
   */
  add(message: ToastMessage): string
  /** Dismiss one toast and cancel its timer. */
  remove(id: string): void
  /** Dismiss everything and cancel every timer. */
  clear(): void
  info(message: ToastMessage): string
  success(message: ToastMessage): string
  error(message: ToastMessage): string
  warning(message: ToastMessage): string
  /** Cancel every pending timer. The store stays usable. */
  dispose(): void
}

/** Injected collaborators, all optional. */
export interface ToastOptions {
  /** Auto-dismiss delay in milliseconds when a message names none. Defaults to `5000`. */
  defaultTimeout?: number
  /** Id source. Defaults to a random base-36 string. */
  nextId?: () => string
  /**
   * Timer port. Returns the cancel function.
   * Defaults to `setTimeout`/`clearTimeout`.
   */
  schedule?: (run: () => void, delay: number) => () => void
}

const DEFAULT_TIMEOUT = 5000

function defaultNextId(): string {
  return Math.random().toString(36).substring(7)
}

function defaultSchedule(run: () => void, delay: number): () => void {
  const timer = setTimeout(run, delay)
  return () => clearTimeout(timer)
}

/**
 * Create a toast store.
 *
 * @example
 * ```ts
 * export const toast = createToastStore()
 * // pass `toast` to buildModelStore as its ToastPort
 * ```
 */
export function createToastStore(options: ToastOptions = {}): ToastStore {
  const defaultTimeout = options.defaultTimeout ?? DEFAULT_TIMEOUT
  const nextId = options.nextId ?? defaultNextId
  const schedule = options.schedule ?? defaultSchedule

  const list = signal<ToastEntry[]>([])
  const timers = new Map<string, () => void>()

  const cancel = (id: string): void => {
    timers.get(id)?.()
    timers.delete(id)
  }

  function remove(id: string): void {
    cancel(id)
    // Immutable: a new array is what makes the change observable to `Toastr`.
    list.value = list.value.filter((entry) => entry.id !== id)
  }

  function clear(): void {
    for (const cancelTimer of timers.values()) cancelTimer()
    timers.clear()
    list.value = []
  }

  function add(message: ToastMessage): string {
    const id = message.id ?? nextId()
    const type = message.type ?? "info"
    const timeout = message.timeout ?? defaultTimeout
    const entry: ToastEntry = {
      id,
      title: message.title ?? type.charAt(0).toUpperCase() + type.slice(1),
      body: message.body,
      type,
      timeout,
    }

    // A reused id replaces its toast where it stands. Appending instead would leave two entries that
    // `remove(id)` cannot tell apart, so dismissing one would dismiss both.
    const existing = list.value.findIndex((current) => current.id === id)
    list.value = existing === -1
      ? [...list.value, entry]
      : list.value.map((current, index) => index === existing ? entry : current)

    // The replaced toast's timer would otherwise fire against the new entry and take it down early.
    cancel(id)
    if (timeout > 0) {
      timers.set(id, schedule(() => remove(id), timeout))
    }
    return id
  }

  return {
    list,
    add,
    remove,
    clear,
    info: (message: ToastMessage) => add({ ...message, type: "info" }),
    success: (message: ToastMessage) => add({ ...message, type: "success" }),
    error: (message: ToastMessage) => add({ ...message, type: "error" }),
    warning: (message: ToastMessage) => add({ ...message, type: "warning" }),
    dispose: clear,
  }
}
