import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  createThemeStore,
  type ThemeBootstrapOptions,
  themeBootstrapScript,
  type ThemeMediaQuery,
  type ThemeStorage,
  ThemeValue,
} from "./theme.ts"

/** An in-memory stand-in for `localStorage` that records what it was asked for. */
function fakeStorage(
  initial: Record<string, string> = {},
): ThemeStorage & { entries: Map<string, string>; reads: string[]; writes: string[] } {
  const entries = new Map(Object.entries(initial))
  const reads: string[] = []
  const writes: string[] = []
  return {
    entries,
    reads,
    writes,
    getItem: (key: string) => {
      reads.push(key)
      return entries.get(key) ?? null
    },
    setItem: (key: string, value: string) => {
      writes.push(key)
      entries.set(key, value)
    },
  }
}

/** A storage that refuses both operations, as a browser in private mode does. */
function refusingStorage(): ThemeStorage {
  return {
    getItem: () => {
      throw new DOMException("The operation is insecure.", "SecurityError")
    },
    setItem: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    },
  }
}

/**
 * A storage that hands back one stored value and refuses every write.
 *
 * The private-mode shape that matters most: the preference a previous session wrote is still
 * readable, and nothing written now survives.
 */
function readOnlyStorage(stored: string): ThemeStorage & { reads: string[] } {
  const reads: string[] = []
  return {
    reads,
    getItem: (key: string) => {
      reads.push(key)
      return stored
    },
    setItem: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    },
  }
}

/** A controllable stand-in for the OS media query, recording every query it is asked for. */
function fakeMedia(matches: boolean) {
  const listeners: Array<(event: { matches: boolean }) => void> = []
  const queries: string[] = []
  const query: ThemeMediaQuery = {
    matches,
    addEventListener: (_type, listener) => void listeners.push(listener),
    removeEventListener: (_type, listener) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    },
  }
  return {
    source: (asked: string) => {
      queries.push(asked)
      return query
    },
    queries,
    listeners,
    listenerCount: () => listeners.length,
    emit(next: boolean) {
      ;(query as { matches: boolean }).matches = next
      for (const listener of [...listeners]) listener({ matches: next })
    },
  }
}

/**
 * Run `body` with `globalThis.localStorage` replaced by a recorder, then put the real one back.
 *
 * The default storage port is the one worth watching — on Deno `localStorage` is a real file shared
 * by every request the process serves — and a test double passed in as a port cannot prove anything
 * about it. Throws rather than skipping when the property cannot be replaced: a runtime this cannot
 * be run on is a result, not a reason to report success.
 *
 * @param body Receives the keys the stand-in was asked for, in order.
 * @returns Whatever `body` returned.
 */
function withRecordedGlobalStorage<T>(body: (reads: string[]) => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  if (!original) throw new Error("this runtime has no globalThis.localStorage to stand in for")
  if (!original.configurable) throw new Error("globalThis.localStorage cannot be replaced here")

  const reads: string[] = []
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        reads.push(key)
        return null
      },
      setItem: () => {},
    },
  })

  try {
    return body(reads)
  } finally {
    Object.defineProperty(globalThis, "localStorage", original)
  }
}

describe("createThemeStore preference", () => {
  it("starts on system when nothing is stored", () => {
    const store = createThemeStore({ storage: fakeStorage(), media: null })
    expect(store.preference.value).toBe(ThemeValue.SYSTEM)
    expect(store.actual.value).toBe(ThemeValue.LIGHT)
  })

  it("reads a stored preference when it attaches, not before", () => {
    const store = createThemeStore({
      storage: fakeStorage({ theme: "dark" }),
      media: null,
      apply: () => {},
    })
    expect(store.preference.value, "before attach").toBe(ThemeValue.SYSTEM)

    store.attach()

    expect(store.preference.value).toBe(ThemeValue.DARK)
    expect(store.actual.value).toBe(ThemeValue.DARK)
    store.dispose()
  })

  it("ignores a stored value it does not understand", () => {
    const store = createThemeStore({
      storage: fakeStorage({ theme: "solarized" }),
      media: null,
      apply: () => {},
    })
    store.attach()
    expect(store.preference.value).toBe(ThemeValue.SYSTEM)
    store.dispose()
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
    const store = createThemeStore({
      storage,
      storageKey: "ui-theme",
      media: null,
      apply: () => {},
    })
    store.attach()
    expect(store.preference.value).toBe(ThemeValue.DARK)
    expect(storage.reads).toEqual(["ui-theme"])

    store.set(ThemeValue.LIGHT)

    expect(storage.entries.get("ui-theme")).toBe("light")
    store.dispose()
  })

  it("works with no ports at all", () => {
    const store = createThemeStore()
    expect(store.preference.value).toBe(ThemeValue.SYSTEM)
  })
})

describe("createThemeStore ports", () => {
  it("reads neither the storage nor the OS while it is being created", () => {
    const storage = fakeStorage({ theme: "dark" })
    const media = fakeMedia(true)

    createThemeStore({ storage, media: media.source, apply: () => {} })

    expect(storage.reads, "storage reads").toEqual([])
    expect(storage.writes, "storage writes").toEqual([])
    expect(media.queries, "media queries").toEqual([])
  })

  it("reads both when it attaches, and asks for the dark scheme by default", () => {
    const storage = fakeStorage({ theme: "dark" })
    const media = fakeMedia(true)
    const store = createThemeStore({ storage, media: media.source, apply: () => {} })

    store.attach()

    expect(storage.reads).toEqual(["theme"])
    expect(media.queries).toEqual(["(prefers-color-scheme: dark)"])
    store.dispose()
  })

  it("does not touch the runtime's own localStorage until it attaches", () => {
    withRecordedGlobalStorage((reads) => {
      const store = createThemeStore({ media: null, apply: () => {} })
      expect(reads, "read while being created").toEqual([])

      store.attach()

      expect(reads, "read on attach").toEqual(["theme"])
      store.dispose()
    })
  })

  it("asks the media source once, however often it is attached", () => {
    const media = fakeMedia(false)
    const store = createThemeStore({ storage: null, media: media.source, apply: () => {} })

    store.attach()
    store.dispose()
    store.attach()

    expect(media.queries.length).toBe(1)
    store.dispose()
  })

  it("re-reads the OS preference on every attach", () => {
    const media = fakeMedia(false)
    const store = createThemeStore({ storage: null, media: media.source, apply: () => {} })

    store.attach()
    store.dispose()
    // The OS changed while nothing was listening, which is exactly what a detached store misses.
    media.emit(true)
    store.attach()

    expect(store.system.value).toBe(ThemeValue.DARK)
    store.dispose()
  })

  it("keeps a preference set before attach when the storage never took it", () => {
    const store = createThemeStore({ storage: refusingStorage(), media: null, apply: () => {} })

    store.set(ThemeValue.DARK)
    store.attach()

    expect(store.preference.value).toBe(ThemeValue.DARK)
    store.dispose()
  })

  it("does not reload the stored preference when it attaches again", () => {
    // The scenario the one-time load protects. The storage still holds what a previous session
    // wrote and refuses everything written now, so the light the user just chose exists only in the
    // signal: an `attach()` that read storage again would put the page back to dark behind them.
    const storage = readOnlyStorage(ThemeValue.DARK)
    const store = createThemeStore({ storage, media: null, apply: () => {} })

    store.attach()
    expect(store.preference.value, "the stored preference, on the first attach").toBe(
      ThemeValue.DARK,
    )

    store.set(ThemeValue.LIGHT)
    store.dispose()
    store.attach()

    expect(store.preference.value).toBe(ThemeValue.LIGHT)
    expect(storage.reads, "storage read once, on the first attach").toEqual(["theme"])
    store.dispose()
  })

  it("does not let a storage that refuses a write reach the caller", () => {
    const store = createThemeStore({ storage: refusingStorage(), media: null, apply: () => {} })

    expect(() => store.set(ThemeValue.DARK)).not.toThrow()
    expect(store.preference.value).toBe(ThemeValue.DARK)
  })

  it("does not let a storage that refuses a read reach the caller", () => {
    const store = createThemeStore({ storage: refusingStorage(), media: null, apply: () => {} })

    expect(() => store.attach()).not.toThrow()
    expect(store.preference.value).toBe(ThemeValue.SYSTEM)
    store.dispose()
  })
})

describe("createThemeStore resolution", () => {
  it("holds light until it attaches, whatever the OS asks for", () => {
    const media = fakeMedia(true)
    const store = createThemeStore({ storage: fakeStorage(), media: media.source, apply: () => {} })
    expect(store.system.value, "before attach").toBe(ThemeValue.LIGHT)

    store.attach()

    expect(store.system.value).toBe(ThemeValue.DARK)
    expect(store.actual.value).toBe(ThemeValue.DARK)
    store.dispose()
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

  it("watches the query it was given instead of the default one", () => {
    const queries: string[] = []
    const store = createThemeStore({
      storage: null,
      systemQuery: "(prefers-contrast: more)",
      media: (query) => {
        queries.push(query)
        return { matches: false }
      },
      apply: () => {},
    })

    store.attach()

    expect(queries).toEqual(["(prefers-contrast: more)"])
    store.dispose()
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
    const darkHost = createThemeStore({
      storage: fakeStorage(),
      media: fakeMedia(true).source,
      apply: () => {},
    })
    darkHost.attach()
    darkHost.toggle()
    expect(darkHost.preference.value).toBe(ThemeValue.LIGHT)
    darkHost.dispose()

    const lightHost = createThemeStore({
      storage: fakeStorage(),
      media: fakeMedia(false).source,
      apply: () => {},
    })
    lightHost.attach()
    lightHost.toggle()
    expect(lightHost.preference.value).toBe(ThemeValue.DARK)
    lightHost.dispose()
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

describe("createThemeStore defaultPreference", () => {
  it("uses the default preference when nothing is stored", () => {
    const store = createThemeStore({
      storage: fakeStorage(),
      media: fakeMedia(false).source,
      apply: () => {},
      defaultPreference: ThemeValue.DARK,
    })
    store.attach()
    expect(store.preference.value).toBe(ThemeValue.DARK)
    expect(store.actual.value).toBe(ThemeValue.DARK)
    store.dispose()
  })

  it("lets a stored preference win over the default", () => {
    const store = createThemeStore({
      storage: fakeStorage({ theme: ThemeValue.LIGHT }),
      media: fakeMedia(true).source,
      apply: () => {},
      defaultPreference: ThemeValue.DARK,
    })
    store.attach()
    expect(store.preference.value).toBe(ThemeValue.LIGHT)
    store.dispose()
  })

  it("ignores a default preference it does not understand", () => {
    const store = createThemeStore({
      storage: fakeStorage(),
      media: fakeMedia(true).source,
      apply: () => {},
      defaultPreference: "sepia" as ThemeValue,
    })
    store.attach()
    expect(store.preference.value).toBe(ThemeValue.SYSTEM)
    store.dispose()
  })
})

/** What one run of the bootstrap script did to the page. */
interface BootstrapRun {
  dark: boolean
  keysRead: string[]
  queriesAsked: string[]
  writes: number
}

/**
 * Run the real bootstrap script against in-memory stand-ins for `localStorage`, `matchMedia` and
 * `document`, and report what it painted and what it asked for.
 */
function runBootstrap(
  options: ThemeBootstrapOptions | undefined,
  stored: Record<string, string> | "refuse",
  systemDark: boolean,
): BootstrapRun {
  const storage = stored === "refuse" ? refusingStorage() : fakeStorage(stored)
  const keysRead: string[] = []
  const queriesAsked: string[] = []
  let writes = 0
  const classes = new Set<string>()
  const document = {
    documentElement: {
      classList: {
        toggle: (name: string, on: boolean) => void (on ? classes.add(name) : classes.delete(name)),
      },
    },
  }
  const localStorage = {
    getItem: (key: string) => {
      keysRead.push(key)
      return storage.getItem(key)
    },
    setItem: () => void writes++,
  }
  const matchMedia = (query: string) => {
    queriesAsked.push(query)
    return { matches: systemDark }
  }
  new Function("localStorage", "matchMedia", "document", themeBootstrapScript(options))(
    localStorage,
    matchMedia,
    document,
  )
  return { dark: classes.has("dark"), keysRead, queriesAsked, writes }
}

describe("themeBootstrapScript", () => {
  it("paints a stored dark preference dark on a light system", () => {
    expect(runBootstrap(undefined, { theme: "dark" }, false).dark).toBe(true)
  })

  it("paints a stored light preference light on a dark system", () => {
    expect(runBootstrap(undefined, { theme: "light" }, true).dark).toBe(false)
  })

  it("follows the system for a stored system preference", () => {
    expect(runBootstrap(undefined, { theme: "system" }, true).dark).toBe(true)
    expect(runBootstrap(undefined, { theme: "system" }, false).dark).toBe(false)
  })

  it("falls back to the default preference when nothing is stored", () => {
    expect(runBootstrap({ defaultPreference: ThemeValue.DARK }, {}, false).dark).toBe(true)
    expect(runBootstrap({ defaultPreference: ThemeValue.LIGHT }, {}, true).dark).toBe(false)
    expect(runBootstrap(undefined, {}, true).dark).toBe(true)
  })

  it("falls back to the default preference for a stored value it does not understand", () => {
    expect(runBootstrap({ defaultPreference: ThemeValue.DARK }, { theme: "auto" }, false).dark)
      .toBe(true)
  })

  it("falls back to the default preference when storage refuses the read", () => {
    expect(runBootstrap({ defaultPreference: ThemeValue.DARK }, "refuse", false).dark).toBe(true)
  })

  it("reads the store's storage key and media query by default", () => {
    const run = runBootstrap(undefined, {}, false)
    expect(run.keysRead).toEqual(["theme"])
    expect(run.queriesAsked).toEqual(["(prefers-color-scheme: dark)"])
  })

  it("reads a custom storage key and media query", () => {
    const run = runBootstrap(
      { storageKey: "app-theme", systemQuery: "(prefers-contrast: more)" },
      { theme: "dark", "app-theme": "system" },
      false,
    )
    expect(run).toEqual({
      dark: false,
      keysRead: ["app-theme"],
      queriesAsked: ["(prefers-contrast: more)"],
      writes: 0,
    })
  })

  it("never writes storage", () => {
    expect(runBootstrap(undefined, { theme: "dark" }, false).writes).toBe(0)
  })

  it("agrees with an attached store on every stored value and system setting", () => {
    for (const stored of [null, "light", "dark", "system", "auto"]) {
      for (const systemDark of [false, true]) {
        for (const defaultPreference of Object.values(ThemeValue)) {
          const saved: Record<string, string> = stored === null ? {} : { theme: stored }
          const store = createThemeStore({
            storage: fakeStorage(saved),
            media: fakeMedia(systemDark).source,
            apply: () => {},
            defaultPreference,
          })
          store.attach()
          const painted = runBootstrap({ defaultPreference }, saved, systemDark).dark
          expect({ stored, systemDark, defaultPreference, dark: painted }).toEqual({
            stored,
            systemDark,
            defaultPreference,
            dark: store.actual.value === ThemeValue.DARK,
          })
          store.dispose()
        }
      }
    }
  })

  it("writes options as literals that cannot close the script element or run code", () => {
    const script = themeBootstrapScript({
      storageKey: `"+alert(1)+"</script><script>alert(2)//`,
      defaultPreference: `"+alert(3)+"` as ThemeValue,
    })
    expect(script).not.toContain("</script")
    expect(script).not.toContain("alert(3)")
    const run = runBootstrap({ storageKey: `"+globalThis.pwned=1+"` }, {}, true)
    expect(run.keysRead).toEqual([`"+globalThis.pwned=1+"`])
    expect((globalThis as { pwned?: number }).pwned).toBeUndefined()
  })
})
