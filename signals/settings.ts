import { batch, computed, type ReadonlySignal, signal } from "@preact/signals"
import type {
  SettingsDefinition,
  SettingsSaveResult,
  StoredSettings,
  VersionedSettings,
} from "@spy4x/platform/universal/settings"

/**
 * `@spy4x/preact-signals/settings` — one person's synced settings on signals, saved optimistically.
 *
 * The record lives on a server as a versioned value (`@spy4x/platform/universal/settings`). This
 * store holds the last record the server confirmed, shows unsaved changes on top of it at once, and
 * sends them one at a time. How it reaches the server is the app's choice: it hands in a `load` and
 * a `save` port, and calls {@link SettingsSignals.apply} when its socket (or anything else) delivers
 * a record another device saved.
 */

/** A save request as the server's `saveSettings` reads it: the version it is based on, the value. */
export interface SettingsSaveRequest {
  /** The version of the record this change was made on. */
  version: number
  /** The whole value to store. */
  value: unknown
}

/**
 * How the store talks to the server. Both functions reject when the server cannot be reached; a
 * refused save is a resolved {@link SettingsSaveResult}, the shape `saveSettings` returns.
 */
export interface SettingsTransport {
  /** The person's record, or `null` when nothing was saved yet. */
  load(): Promise<StoredSettings | null>
  /** Send one save request. Records in the answer are unchecked JSON; the store resolves them. */
  save(request: SettingsSaveRequest): Promise<SettingsSaveResult<unknown>>
}

/** Outcome of {@link SettingsSignals.save}. */
export type SettingsSaveOutcome<T> =
  | SettingsSaveResult<T>
  /** The transport rejected (no network), or the store was reset while the save was out. */
  | { ok: false; reason: "failed"; error: unknown }

/** A synced settings store. */
export interface SettingsSignals<T> {
  /** The last record the server confirmed. Version `0` with the defaults until one arrives. */
  readonly record: ReadonlySignal<VersionedSettings<T>>
  /** What to show: {@link record}'s value with every change still on its way applied on top. */
  readonly value: ReadonlySignal<T>
  /** Whether {@link load} has finished since the store was created or last {@link reset}. */
  readonly loaded: ReadonlySignal<boolean>
  /** Whether a change is waiting for the server's answer. */
  readonly saving: ReadonlySignal<boolean>
  /**
   * The record that won when a save was refused as a conflict: another device saved first. The
   * store has already rolled back to it; a UI shows "Updated on another device" while this is set.
   * Cleared by {@link dismissConflict}, by the next accepted save and by {@link reset}.
   */
  readonly conflict: ReadonlySignal<VersionedSettings<T> | null>
  /**
   * Read the record from the server. A record older than the one held (a save landed while the
   * read was out) is ignored. Rejects when the transport does.
   */
  load(): Promise<void>
  /**
   * Change some keys. {@link value} shows the change at once; the request goes out after the ones
   * before it have been answered, based on the version the server confirmed last.
   *
   * - Accepted: {@link record} becomes the server's answer.
   * - Conflict: {@link record} becomes the record that won, every change still waiting is dropped
   *   (it was made on a value the person no longer sees), and {@link conflict} holds that record.
   * - Invalid or too large (checked here first, then by the server): only this change is dropped.
   * - Failed (the transport rejected): this change is dropped and {@link record} stays as it was.
   */
  save(patch: Partial<T>): Promise<SettingsSaveOutcome<T>>
  /**
   * Take a record another device saved, as the app's socket delivers it. Returns whether it was
   * newer than the one held: an older or equal version (an echo of this device's own save) is
   * ignored. Changes still waiting stay on top of it.
   */
  apply(remote: StoredSettings): boolean
  /** Clear {@link conflict} once the UI has shown it. */
  dismissConflict(): void
  /**
   * Forget the person: back to the defaults, not loaded, nothing waiting. For sign-out. An answer
   * to a save or load sent before the reset is ignored.
   */
  reset(): void
}

/** One change waiting to be sent or answered. */
interface PendingChange<T> {
  patch: Partial<T>
}

/**
 * Create a synced settings store for one app's settings definition.
 *
 * Reads nothing on creation: the first request is the caller's {@link SettingsSignals.load}.
 *
 * @example
 * ```ts
 * const settings = createSettingsStore(preferences, {
 *   load: () => fetch(`/api/settings`).then((r) => r.json()),
 *   save: (request) =>
 *     fetch(`/api/settings`, { method: `PUT`, body: JSON.stringify(request) }).then((r) => r.json()),
 * })
 * socket.on(`settings`, (record) => settings.apply(record))
 * ```
 */
export function createSettingsStore<T extends object>(
  definition: SettingsDefinition<T>,
  transport: SettingsTransport,
): SettingsSignals<T> {
  const record = signal<VersionedSettings<T>>(definition.initial)
  const pending = signal<PendingChange<T>[]>([])
  const loaded = signal(false)
  const conflict = signal<VersionedSettings<T> | null>(null)
  const value = computed<T>(() =>
    pending.value.reduce<T>((shown, change) => ({ ...shown, ...change.patch }), record.value.value)
  )
  const saving = computed(() => pending.value.length > 0)

  // Bumped by a conflict and by a reset. A change queued, or an answer awaited, under an older
  // generation belongs to a state that is gone.
  let generation = 0
  // The previous save's settled promise: requests go out one at a time, each on the version the
  // answer before it confirmed.
  let queue: Promise<unknown> = Promise.resolve()
  // Counts resets alone, so a load can tell one from a conflict, which bumps `generation` too.
  let resets = 0

  const remove = (change: PendingChange<T>): void => {
    pending.value = pending.value.filter((item) => item !== change)
  }

  const send = async (
    change: PendingChange<T>,
    queuedIn: number,
  ): Promise<SettingsSaveOutcome<T>> => {
    if (queuedIn !== generation) {
      return { ok: false, reason: "conflict", current: record.peek() }
    }
    const base = record.peek()
    let answer: SettingsSaveResult<unknown>
    try {
      answer = await transport.save({
        version: base.version,
        value: { ...base.value, ...change.patch },
      })
    } catch (error) {
      if (queuedIn === generation) remove(change)
      return { ok: false, reason: "failed", error }
    }
    if (queuedIn !== generation) {
      return { ok: false, reason: "failed", error: new Error(`The settings store was reset.`) }
    }
    if (answer.ok) {
      const settings = definition.resolve(answer.settings)
      batch(() => {
        remove(change)
        if (settings.version > record.peek().version) record.value = settings
        conflict.value = null
      })
      return { ok: true, settings }
    }
    if (answer.reason === "conflict") {
      const current = definition.resolve(answer.current)
      generation++
      batch(() => {
        pending.value = []
        record.value = current
        conflict.value = current
      })
      return { ok: false, reason: "conflict", current }
    }
    remove(change)
    return answer
  }

  const save = (patch: Partial<T>): Promise<SettingsSaveOutcome<T>> => {
    const checked = definition.parse({ ...value.peek(), ...patch })
    if (!checked.ok) return Promise.resolve(checked)
    const change: PendingChange<T> = { patch }
    pending.value = [...pending.value, change]
    const queuedIn = generation
    const result = queue.then(() => send(change, queuedIn))
    queue = result.then(() => {}, () => {})
    return result
  }

  const load = async (): Promise<void> => {
    const startedAfter = resets
    const stored = await transport.load()
    // A reset while the read was out means the answer belongs to a person who has signed out.
    if (resets !== startedAfter) return
    const resolved = definition.resolve(stored)
    batch(() => {
      if (resolved.version >= record.peek().version) record.value = resolved
      loaded.value = true
    })
  }

  const apply = (remote: StoredSettings): boolean => {
    const resolved = definition.resolve(remote)
    if (resolved.version <= record.peek().version) return false
    record.value = resolved
    return true
  }

  const reset = (): void => {
    generation++
    resets++
    batch(() => {
      pending.value = []
      record.value = definition.initial
      loaded.value = false
      conflict.value = null
    })
  }

  return {
    record,
    value,
    loaded,
    saving,
    conflict,
    load,
    save,
    apply,
    dismissConflict: () => {
      conflict.value = null
    },
    reset,
  }
}
