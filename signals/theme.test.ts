import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createThemeStore, type ThemeMediaQuery, type ThemeStorage, ThemeValue } from "./theme.ts"

/** An in-memory stand-in for `localStorage`. */
function fakeStorage(
  initial: Record<string, string> = {},
): ThemeStorage & { entries: Map<string, string> } {
  const entries = new Map(Object.entries(initial))
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
  }
}

/** A controllable stand-in for the OS media query. */
function fakeMedia(matches: boolean) {
  const listeners: Array<(event: { matches: boolean }) => void> = []
  const query: ThemeMediaQuery = {
    matches,
    addEventListener: (_type, listener) => void listeners.push(listener),
    removeEventListener: (_type, listener) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    },
  }
  return {
    source: () => query,
    listeners,
    listenerCount: () => listeners.length,
    emit(next: boolean) {
      ;(query as { matches: boolean }).matches = next
      for (const listener of [...listeners]) listener({ matches: next })
    },
  }
}

describe("createThemeStore preference", () => {
  it("starts on system when nothing is stored", () => {
    const store = createThemeStore({ storage: fakeStorage(), media: null })
    expect(store.preference.value).toBe(ThemeValue.SYSTEM)
    expect(store.actual.value).toBe(ThemeValue.LIGHT)
  })

  it("reads a stored preference", () => {
    const store = createThemeStore({ storage: fakeStorage({ theme: "dark" }), media: null })
    expect(store.preference.value).toBe(ThemeValue.DARK)
    expect(store.actual.value).toBe(ThemeValue.DARK)
  })

  it("ignores a stored value it does not understand", () => {
    const store = createThemeStore({ storage: fakeStorage({ theme: "solarized" }), media: null })
    expect(store.preference.value).toBe(ThemeValue.SYSTEM)
  })

  it("persists a preference when it is set", () => {
    const storage = fakeStorage()
    const store = createThemeStore({ storage, media: null })

    store.set(ThemeValue.DARK)

    expect(store.preference.value).toBe(ThemeValue.DARK)
    expect(storage.entries.get("theme")).toBe("dark")
  })

  it("honours a custom storage key", () => {
    const storage = fakeStorage({ "ui-theme": "dark" })
    const store = createThemeStore({ storage, storageKey: "ui-theme", media: null })
    expect(store.preference.value).toBe(ThemeValue.DARK)
    store.set(ThemeValue.LIGHT)
    expect(storage.entries.get("ui-theme")).toBe("light")
  })

  it("works with no ports at all", () => {
    const store = createThemeStore()
    expect([ThemeValue.LIGHT, ThemeValue.DARK, ThemeValue.SYSTEM]).toContain(store.preference.value)
  })
})

describe("createThemeStore resolution", () => {
  it("reads the OS once at creation", () => {
    const media = fakeMedia(true)
    const store = createThemeStore({ storage: fakeStorage(), media: media.source })
    expect(store.system.value).toBe(ThemeValue.DARK)
    expect(store.actual.value).toBe(ThemeValue.DARK)
  })

  it("follows the OS while the preference is system, once attached", () => {
    const media = fakeMedia(true)
    const store = createThemeStore({
      storage: fakeStorage(),
      media: media.source,
      apply: () => {},
    })
    store.attach()
    expect(store.actual.value).toBe(ThemeValue.DARK)

    media.emit(false)
    expect(store.system.value).toBe(ThemeValue.LIGHT)
    expect(store.actual.value).toBe(ThemeValue.LIGHT)
  })

  it("ignores the OS once the user has chosen", () => {
    const media = fakeMedia(false)
    const store = createThemeStore({
      storage: fakeStorage(),
      media: media.source,
      apply: () => {},
    })
    store.attach()
    store.set(ThemeValue.DARK)
    media.emit(false)
    media.emit(true)
    expect(store.system.value).toBe(ThemeValue.DARK)
    expect(store.actual.value).toBe(ThemeValue.DARK)
  })

  it("asks for the dark scheme by default", () => {
    const queries: string[] = []
    createThemeStore({
      storage: null,
      media: (query) => {
        queries.push(query)
        return { matches: false }
      },
    })
    expect(queries).toEqual(["(prefers-color-scheme: dark)"])
  })
})

describe("createThemeStore toggle", () => {
  it("flips light to dark and back", () => {
    const store = createThemeStore({ storage: fakeStorage(), media: null })
    store.set(ThemeValue.LIGHT)
    store.toggle()
    expect(store.preference.value).toBe(ThemeValue.DARK)
    store.toggle()
    expect(store.preference.value).toBe(ThemeValue.LIGHT)
  })

  it("leaves system by choosing the opposite of the OS", () => {
    const darkHost = createThemeStore({ storage: fakeStorage(), media: fakeMedia(true).source })
    darkHost.toggle()
    expect(darkHost.preference.value).toBe(ThemeValue.LIGHT)

    const lightHost = createThemeStore({ storage: fakeStorage(), media: fakeMedia(false).source })
    lightHost.toggle()
    expect(lightHost.preference.value).toBe(ThemeValue.DARK)
  })
})

describe("createThemeStore attach", () => {
  it("applies the resolved theme immediately and on every change", () => {
    const applied: string[] = []
    const store = createThemeStore({
      storage: fakeStorage(),
      media: null,
      apply: (theme) => void applied.push(theme),
    })

    store.attach()
    expect(applied).toEqual([ThemeValue.LIGHT])

    store.set(ThemeValue.DARK)
    expect(applied).toEqual([ThemeValue.LIGHT, ThemeValue.DARK])
  })

  it("re-applies when the OS preference changes", () => {
    const applied: string[] = []
    const media = fakeMedia(false)
    const store = createThemeStore({
      storage: fakeStorage(),
      media: media.source,
      apply: (theme) => void applied.push(theme),
    })

    store.attach()
    media.emit(true)

    expect(applied).toEqual([ThemeValue.LIGHT, ThemeValue.DARK])
  })

  it("stops applying and listening after dispose", () => {
    const applied: string[] = []
    const media = fakeMedia(false)
    const store = createThemeStore({
      storage: fakeStorage(),
      media: media.source,
      apply: (theme) => void applied.push(theme),
    })

    store.attach()
    store.dispose()
    store.set(ThemeValue.DARK)
    media.emit(true)

    expect(applied).toEqual([ThemeValue.LIGHT])
    expect(media.listenerCount()).toBe(0)
  })

  it("returns its own disposer", () => {
    const applied: string[] = []
    const store = createThemeStore({
      storage: fakeStorage(),
      media: null,
      apply: (theme) => void applied.push(theme),
    })
    const detach = store.attach()
    detach()
    store.set(ThemeValue.DARK)
    expect(applied).toEqual([ThemeValue.LIGHT])
  })

  it("is safe to attach twice", () => {
    const applied: string[] = []
    const media = fakeMedia(false)
    const store = createThemeStore({
      storage: fakeStorage(),
      media: media.source,
      apply: (theme) => void applied.push(theme),
    })
    store.attach()
    store.attach()
    media.emit(true)
    expect(applied).toEqual([ThemeValue.LIGHT, ThemeValue.LIGHT, ThemeValue.DARK])
    expect(media.listenerCount()).toBe(1)
  })
})
