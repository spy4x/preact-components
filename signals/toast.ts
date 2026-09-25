import { type ReadonlySignal, signal } from "@preact/signals"
import type { ToastMessage, ToastVariant } from "./types.ts"

/**
 * `@spy4x/preact-signals/toast` — the store behind `Toastr`.
 *
 * Ported from a source application's module-level singleton. It is a factory here so a test can
 * inject its id
 * source, and so the store is exactly one thing: the list of toasts that are on screen, plus the
 * `remove` that takes one off it.
 *
 * **The store runs no timers.** Auto-dismiss belongs to whatever renders the toast, because that is
 * the side that knows whether a pointer is resting on one. `Toastr` in `@spy4x/preact-ui` runs
 * a timer per toast, pauses it while the stack is hovered or holds focus, and calls `remove` when
 * the time is up. A store that also scheduled its own removal would take the toast away mid-read,
 * whatever the component had paused — that was #175, and the two timers racing was #174's other
 * half.
 *
 * An application that renders toasts some other way therefore schedules its own removals. Two
 * lines, and it owns the pausing rule instead of inheriting one:
 *
 * ```ts
 * const id = toast.info({ body: "Saved", duration: 4000 })
 * setTimeout(() => toast.remove(id), 4000)
 * ```
 */

/**
 * A toast as the store holds it.
 *
 * Assignable to `ToastItem` in `@spy4x/preact-ui` as it stands — same `duration`, same `type`,
 * same `id` — which is what lets `Toastr toasts={store.list.value}` be the wiring both READMEs
 * show.
 */
export interface ToastEntry {
  id: string
  title: string
  body: string
  type: ToastVariant
  /**
   * Auto-dismiss delay in milliseconds, as the caller asked for it. `0` keeps the toast until
   * somebody dismisses it.
   *
   * Absent when the caller named none: the store has no default of its own to put here, so the
   * renderer's default applies — five seconds under `Toastr`. One default, on the side that runs
   * the timer.
   */
  duration?: number
}

/** A toast store. `list` is what `Toastr` renders; the four shorthands are what callers use. */
export interface ToastStore {
  /** Newest last. */
  list: ReadonlySignal<ToastEntry[]>
  /** Push a toast. Returns its id, generated when the message carries none.
   *
   * Reusing an id replaces that toast in place. **It does not restart the toast's countdown**,
   * which is a change: this store used to cancel the old timer and schedule a fresh one, so a
   * re-push bought the toast its whole delay again. It has no timer to restart now. Under `Toastr`
   * the replaced toast keeps its remaining time unless the re-push changes `duration`, which
   * refills the budget in full — the component's rule from #172, and the one way to extend a toast
   * on screen.
   */
  add(message: ToastMessage): string
  /** Take one toast off the list. This is the port `Toastr`'s `onDismiss` calls. */
  remove(id: string): void
  /** Empty the list. */
  clear(): void
  info(message: ToastMessage): string
  success(message: ToastMessage): string
  error(message: ToastMessage): string
  warning(message: ToastMessage): string
}

/** Injected collaborators, all optional. */
export interface ToastOptions {
  /** Id source. Defaults to a random base-36 string. */
  nextId?: () => string
}

function defaultNextId(): string {
  return Math.random().toString(36).substring(7)
}

/**
 * Create a toast store.
 *
 * @example
 * ```ts
 * export const toast = createToastStore()
 * // pass `toast` to buildModelStore as its ToastPort
 * // render it with
 * // <Toastr toasts={toast.list.value} onDismiss={(id) => toast.remove(String(id))} />
 * ```
 */
export function createToastStore(options: ToastOptions = {}): ToastStore {
  const nextId = options.nextId ?? defaultNextId

  const list = signal<ToastEntry[]>([])

  function remove(id: string): void {
    // Immutable: a new array is what makes the change observable to `Toastr`.
    list.value = list.value.filter((entry) => entry.id !== id)
  }

  function clear(): void {
    list.value = []
  }

  function add(message: ToastMessage): string {
    const id = message.id ?? nextId()
    const type = message.type ?? "info"
    const entry: ToastEntry = {
      id,
      title: message.title ?? type.charAt(0).toUpperCase() + type.slice(1),
      body: message.body,
      type,
      // `duration` is the name both sides use; `timeout` is the old one, kept working for a
      // release. `??` rather than `||`, so an explicit `0` — keep this toast until it is
      // dismissed — is carried through instead of being read as "nothing was asked for".
      duration: message.duration ?? message.timeout,
    }

    // A reused id replaces its toast where it stands. Appending instead would leave two entries that
    // `remove(id)` cannot tell apart, so dismissing one would dismiss both.
    const existing = list.value.findIndex((current) => current.id === id)
    list.value = existing === -1
      ? [...list.value, entry]
      : list.value.map((current, index) => index === existing ? entry : current)

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
  }
}
