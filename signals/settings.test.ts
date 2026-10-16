import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type } from "arktype"
import {
  defineSettings,
  type SettingsDefinition,
  type SettingsSaveResult,
  type StoredSettings,
  type VersionedSettings,
} from "@spy4x/platform/universal/settings"
import {
  createSettingsStore,
  type SettingsSaveRequest,
  type SettingsTransport,
} from "./settings.ts"
import { createThemeStore, syncThemeWithSettings, type ThemeStorage, ThemeValue } from "./theme.ts"

interface Preferences {
  theme: `light` | `dark` | `system`
  clock: `auto` | `h12` | `h23`
}

const preferences = defineSettings<Preferences>(
  type({ theme: `'light' | 'dark' | 'system'`, clock: `'auto' | 'h12' | 'h23'` }),
  { defaults: { theme: `system`, clock: `auto` } },
)

/** One request the fake server holds until the test answers it. */
interface Held<T> {
  resolve(value: T): void
  reject(error: unknown): void
}

/**
 * A server that keeps one record and answers each request only when the test says so, with the
 * real `definition.save` rules (version check, schema), so the store meets the answers it will
 * meet in production, in any order the test picks.
 */
function fakeServer<T>(definition: SettingsDefinition<T>) {
  let stored: VersionedSettings<T> = definition.initial
  const saves: Array<{ request: SettingsSaveRequest } & Held<SettingsSaveResult<unknown>>> = []
  const loads: Array<Held<StoredSettings | null>> = []
  const sent: SettingsSaveRequest[] = []
  let loadsAsked = 0

  const transport: SettingsTransport = {
    load: () => {
      loadsAsked++
      return new Promise((resolve, reject) => loads.push({ resolve, reject }))
    },
    save: (request) =>
      new Promise((resolve, reject) => {
        sent.push(structuredClone(request))
        saves.push({ request, resolve, reject })
      }),
  }

  return {
    transport,
    sent,
    get record(): VersionedSettings<T> {
      return stored
    },
    /** How many saves are waiting for an answer. */
    /** How many loads were asked for. */
    get loadsAsked(): number {
      return loadsAsked
    },
    get waiting(): number {
      return saves.length
    },
    /** Answer the oldest save with what the server's rules decide. */
    async answerSave(): Promise<void> {
      await settle()
      const held = saves.shift()
      if (!held) throw new Error(`no save is waiting`)
      const result = definition.save(stored, held.request)
      if (result.ok) stored = result.settings
      held.resolve(result)
      await settle()
    },
    /** Answer the oldest save with a hand-made result. */
    async answerSaveWith(result: SettingsSaveResult<unknown>): Promise<void> {
      await settle()
      const held = saves.shift()
      if (!held) throw new Error(`no save is waiting`)
      held.resolve(result)
      await settle()
    },
    /** Fail the oldest save as a dropped connection does. */
    async failSave(): Promise<void> {
      await settle()
      const held = saves.shift()
      if (!held) throw new Error(`no save is waiting`)
      held.reject(new TypeError(`Failed to fetch`))
      await settle()
    },
    /** Answer the oldest load with the record stored now, or with `record` when given. */
    async answerLoad(record?: StoredSettings | null): Promise<void> {
      await settle()
      const held = loads.shift()
      if (!held) throw new Error(`no load is waiting`)
      held.resolve(record === undefined ? (stored.version === 0 ? null : stored) : record)
      await settle()
    },
    /** Another device saves `patch`; returns the record its socket event would carry. */
    otherDevice(patch: Partial<T>): VersionedSettings<T> {
      stored = { version: stored.version + 1, value: { ...stored.value, ...patch } }
      return stored
    },
  }
}

/** Let every queued promise callback run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

/** A store that has loaded the server's current record. */
async function loadedStore(server: ReturnType<typeof fakeServer<Preferences>>) {
  const store = createSettingsStore(preferences, server.transport)
  const loading = store.load()
  await server.answerLoad()
  await loading
  return store
}

describe(`createSettingsStore load`, () => {
  it(`holds the defaults at version 0 and requests nothing until load`, () => {
    const server = fakeServer(preferences)
    const store = createSettingsStore(preferences, server.transport)
    expect(store.record.value).toEqual({ version: 0, value: { theme: `system`, clock: `auto` } })
    expect(store.loaded.value).toBe(false)
    expect(server.loadsAsked).toBe(0)
    expect(server.sent).toEqual([])
  })

  it(`takes the server's record and marks itself loaded`, async () => {
    const server = fakeServer(preferences)
    server.otherDevice({ theme: `dark` })
    const store = await loadedStore(server)
    expect(store.record.value).toEqual({ version: 1, value: { theme: `dark`, clock: `auto` } })
    expect(store.value.value.theme).toBe(`dark`)
    expect(store.loaded.value).toBe(true)
  })

  it(`ignores a load answer older than a save that landed meanwhile`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const loading = store.load()
    const saving = store.save({ theme: `dark` })
    await server.answerSave()
    await saving
    await server.answerLoad(null)
    await loading
    expect(store.record.value).toEqual({ version: 1, value: { theme: `dark`, clock: `auto` } })
  })

  it(`ignores a load answer that arrives after a reset`, async () => {
    const server = fakeServer(preferences)
    server.otherDevice({ theme: `dark` })
    const store = createSettingsStore(preferences, server.transport)
    const loading = store.load()
    store.reset()
    await server.answerLoad()
    await loading
    expect(store.loaded.value).toBe(false)
    expect(store.record.value.version).toBe(0)
  })

  it(`rejects when the transport does, and stays not loaded`, async () => {
    const failure = new TypeError(`Failed to fetch`)
    const store = createSettingsStore(preferences, {
      load: () => Promise.reject(failure),
      save: () => Promise.reject(failure),
    })
    await expect(store.load()).rejects.toBe(failure)
    expect(store.loaded.value).toBe(false)
  })
})

describe(`createSettingsStore save`, () => {
  it(`shows a change at once and keeps the server's answer as the record`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const saving = store.save({ theme: `dark` })
    expect(store.value.value.theme).toBe(`dark`)
    expect(store.record.value.version).toBe(0)
    expect(store.saving.value).toBe(true)
    await server.answerSave()
    expect(await saving).toEqual({
      ok: true,
      settings: { version: 1, value: { theme: `dark`, clock: `auto` } },
    })
    expect(store.record.value).toEqual({ version: 1, value: { theme: `dark`, clock: `auto` } })
    expect(store.saving.value).toBe(false)
  })

  it(`sends a second change only after the first is answered, on the version it confirmed`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const first = store.save({ theme: `dark` })
    const second = store.save({ clock: `h23` })
    await settle()
    expect(server.waiting).toBe(1)
    expect(store.value.value).toEqual({ theme: `dark`, clock: `h23` })
    await server.answerSave()
    expect(server.sent).toEqual([
      { version: 0, value: { theme: `dark`, clock: `auto` } },
      { version: 1, value: { theme: `dark`, clock: `h23` } },
    ])
    await server.answerSave()
    expect((await first).ok).toBe(true)
    expect((await second).ok).toBe(true)
    expect(store.record.value).toEqual({ version: 2, value: { theme: `dark`, clock: `h23` } })
  })

  it(`rolls back to the record that won a conflict, drops waiting changes and exposes it`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const winner = server.otherDevice({ theme: `light` })
    const first = store.save({ theme: `dark` })
    const second = store.save({ clock: `h12` })
    await server.answerSave()
    expect(await first).toEqual({ ok: false, reason: `conflict`, current: winner })
    expect(await second).toMatchObject({ ok: false, reason: `conflict` })
    expect(server.sent).toHaveLength(1)
    expect(store.record.value).toEqual(winner)
    expect(store.value.value).toEqual({ theme: `light`, clock: `auto` })
    expect(store.conflict.value).toEqual(winner)
    expect(store.saving.value).toBe(false)
    store.dismissConflict()
    expect(store.conflict.value).toBe(null)
  })

  it(`clears the conflict notice on the next accepted save`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    server.otherDevice({ theme: `light` })
    const refused = store.save({ theme: `dark` })
    await server.answerSave()
    await refused
    const retried = store.save({ theme: `dark` })
    await server.answerSave()
    expect((await retried).ok).toBe(true)
    expect(store.conflict.value).toBe(null)
    expect(store.record.value).toEqual({ version: 2, value: { theme: `dark`, clock: `auto` } })
  })

  it(`refuses an invalid change without sending it or showing it`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const outcome = await store.save({ theme: `sepia` } as unknown as Partial<Preferences>)
    expect(outcome).toMatchObject({ ok: false, reason: `invalid` })
    expect(server.sent).toEqual([])
    expect(store.value.value.theme).toBe(`system`)
  })

  it(`drops only the change the server refused, keeping the next one`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const first = store.save({ theme: `dark` })
    const second = store.save({ clock: `h12` })
    await server.answerSaveWith({ ok: false, reason: `too-large`, maxBytes: 10, bytes: 40 })
    expect(await first).toEqual({ ok: false, reason: `too-large`, maxBytes: 10, bytes: 40 })
    expect(store.value.value).toEqual({ theme: `system`, clock: `h12` })
    await server.answerSave()
    expect((await second).ok).toBe(true)
    expect(store.record.value.value).toEqual({ theme: `system`, clock: `h12` })
  })

  it(`rolls back a change the transport could not deliver and keeps the record`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const saving = store.save({ theme: `dark` })
    await server.failSave()
    expect(await saving).toMatchObject({ ok: false, reason: `failed` })
    expect(store.value.value.theme).toBe(`system`)
    expect(store.record.value.version).toBe(0)
    expect(store.saving.value).toBe(false)
  })

  it(`ignores a save answer that arrives after a reset`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const saving = store.save({ theme: `dark` })
    await settle()
    store.reset()
    await server.answerSave()
    expect(await saving).toMatchObject({ ok: false, reason: `failed` })
    expect(store.record.value.version).toBe(0)
    expect(store.value.value.theme).toBe(`system`)
  })
})

describe(`createSettingsStore apply`, () => {
  it(`takes a newer record from another device and keeps waiting changes on top`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    store.save({ clock: `h23` })
    const remote = server.otherDevice({ theme: `dark` })
    expect(store.apply(structuredClone(remote))).toBe(true)
    expect(store.record.value).toEqual(remote)
    expect(store.value.value).toEqual({ theme: `dark`, clock: `h23` })
  })

  it(`ignores an echo of a record it already holds`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    const saving = store.save({ theme: `dark` })
    await server.answerSave()
    await saving
    const before = store.record.value
    expect(store.apply({ version: 1, value: { theme: `light`, clock: `auto` } })).toBe(false)
    expect(store.record.value).toBe(before)
  })

  it(`reads a remote value through the definition, dropping keys it does not know`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    store.apply({ version: 3, value: { theme: `dark`, extra: 1 } })
    expect(store.record.value).toEqual({ version: 3, value: { theme: `dark`, clock: `auto` } })
  })
})

describe(`createSettingsStore reset`, () => {
  it(`forgets the person: defaults, not loaded, no notice`, async () => {
    const server = fakeServer(preferences)
    const store = await loadedStore(server)
    server.otherDevice({ theme: `light` })
    const refused = store.save({ theme: `dark` })
    await server.answerSave()
    await refused
    store.reset()
    expect(store.record.value).toEqual(preferences.initial)
    expect(store.loaded.value).toBe(false)
    expect(store.conflict.value).toBe(null)
  })
})

/** An in-memory `localStorage` holding this device's theme copy. */
function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & {
  entries: Map<string, string>
} {
  const entries = new Map(Object.entries(initial))
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
  }
}

/** A theme store with a stored local copy, attached to nothing, and a settings store beside it. */
function connected(local: string | null) {
  const storage = memoryStorage(local === null ? {} : { theme: local })
  const theme = createThemeStore({ storage, media: null, apply: () => {} })
  theme.attach()
  const server = fakeServer(preferences)
  const settings = createSettingsStore(preferences, server.transport)
  const stop = syncThemeWithSettings(theme, settings, `theme`)
  /** Load the server's record and wait for the connection to react. */
  const signIn = async () => {
    const loading = settings.load()
    await server.answerLoad()
    await loading
    await settle()
  }
  return { storage, theme, server, settings, stop, signIn }
}

describe(`syncThemeWithSettings`, () => {
  it(`keeps the local theme and sends nothing before sign-in`, async () => {
    const { theme, server } = connected(`dark`)
    expect(theme.preference.value).toBe(ThemeValue.DARK)
    theme.set(ThemeValue.LIGHT)
    await settle()
    expect(server.sent).toEqual([])
  })

  it(`follows the theme the server has saved once signed in, and stores it locally`, async () => {
    const { theme, server, storage, signIn } = connected(`dark`)
    server.otherDevice({ theme: `light` })
    await signIn()
    expect(theme.preference.value).toBe(ThemeValue.LIGHT)
    expect(storage.entries.get(`theme`)).toBe(`light`)
    expect(server.sent).toEqual([])
  })

  it(`offers this device's theme to a record never saved`, async () => {
    const { server, settings, signIn } = connected(`dark`)
    await signIn()
    expect(server.sent).toEqual([{ version: 0, value: { theme: `dark`, clock: `auto` } }])
    await server.answerSave()
    expect(settings.record.value).toEqual({ version: 1, value: { theme: `dark`, clock: `auto` } })
  })

  it(`saves a preference set on this device after sign-in`, async () => {
    const { theme, server, signIn } = connected(null)
    server.otherDevice({ theme: `system` })
    await signIn()
    theme.set(ThemeValue.DARK)
    await settle()
    expect(server.sent).toEqual([{ version: 1, value: { theme: `dark`, clock: `auto` } }])
  })

  it(`follows a change another device made`, async () => {
    const { theme, server, settings, signIn } = connected(null)
    await signIn()
    settings.apply(server.otherDevice({ theme: `dark` }))
    await settle()
    expect(theme.preference.value).toBe(ThemeValue.DARK)
    expect(server.sent).toEqual([])
  })

  it(`rolls the theme back to the record that won a conflict`, async () => {
    const { theme, server, settings, signIn } = connected(null)
    await signIn()
    server.otherDevice({ theme: `light` })
    theme.set(ThemeValue.DARK)
    await server.answerSave()
    expect(theme.preference.value).toBe(ThemeValue.LIGHT)
    expect(settings.conflict.value?.value.theme).toBe(`light`)
    expect(server.sent).toHaveLength(1)
  })

  it(`keeps a theme set offline and sends it with the next record`, async () => {
    const { theme, server, settings, signIn } = connected(null)
    server.otherDevice({ theme: `system` })
    await signIn()
    theme.set(ThemeValue.DARK)
    await server.failSave()
    expect(theme.preference.value).toBe(ThemeValue.DARK)
    const reconnect = settings.load()
    await server.answerLoad()
    await reconnect
    await settle()
    expect(theme.preference.value).toBe(ThemeValue.DARK)
    expect(server.sent).toEqual([
      { version: 1, value: { theme: `dark`, clock: `auto` } },
      { version: 1, value: { theme: `dark`, clock: `auto` } },
    ])
  })

  it(`stops following after sign-out and after the disposer`, async () => {
    const { theme, server, settings, stop, signIn } = connected(null)
    await signIn()
    settings.reset()
    theme.set(ThemeValue.DARK)
    await settle()
    expect(server.sent).toEqual([])
    expect(theme.preference.value).toBe(ThemeValue.DARK)
    await signIn()
    await server.answerSave()
    stop()
    settings.apply(server.otherDevice({ theme: `light` }))
    await settle()
    expect(theme.preference.value).toBe(ThemeValue.DARK)
  })

  it(`keeps the last of two quick changes once both are answered, with exactly two saves`, async () => {
    const { theme, server, settings, signIn } = connected(null)
    server.otherDevice({ theme: `system` })
    await signIn()
    theme.set(ThemeValue.DARK)
    theme.set(ThemeValue.LIGHT)
    await server.answerSave()
    expect(theme.preference.value).toBe(ThemeValue.LIGHT)
    await server.answerSave()
    await settle()
    expect(theme.preference.value).toBe(ThemeValue.LIGHT)
    expect(server.sent).toHaveLength(2)
    expect(server.waiting).toBe(0)
    expect(settings.record.value.value.theme).toBe(`light`)
  })

  it(`does not flip back when the socket echo of a change arrives before its answer`, async () => {
    const { theme, server, settings, signIn } = connected(null)
    server.otherDevice({ theme: `system` })
    await signIn()
    theme.set(ThemeValue.DARK)
    theme.set(ThemeValue.LIGHT)
    await server.answerSave()
    settings.apply(server.record)
    await settle()
    expect(theme.preference.value).toBe(ThemeValue.LIGHT)
    await server.answerSave()
    await settle()
    expect(theme.preference.value).toBe(ThemeValue.LIGHT)
    expect(server.sent).toHaveLength(2)
  })

  it(`does not push one person's offline theme over the next person's after sign-out`, async () => {
    const { theme, server, settings, signIn } = connected(null)
    server.otherDevice({ theme: `system` })
    await signIn()
    theme.set(ThemeValue.DARK)
    await settle()
    settings.reset()
    await server.failSave()
    server.otherDevice({ theme: `light` })
    await signIn()
    expect(theme.preference.value).toBe(ThemeValue.LIGHT)
    expect(server.sent).toHaveLength(1)
  })
})
