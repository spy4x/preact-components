import { computed, effect, type ReadonlySignal, type Signal, signal } from "@preact/signals"

/**
 * `@spy4x/preact-signals/theme` — light/dark/system preference on signals.
 *
 * The source store was a module-level singleton that read `localStorage` and touched `document` at
 * import time, which is why it could not be shared, reset, or tested. Here nothing is read until
 * {@link ThemeStore.attach} runs — or until {@link ThemeStore.set} writes, which is a caller asking
 * for it — and every outside world — storage, the OS media query, the document — arrives as a port.
 */

/** What the user chose in the UI. */
export enum ThemeValue {
  LIGHT = "light",
  DARK = "dark",
  SYSTEM = "system",
}

/** A resolved theme: what is actually painted. */
export type Theme = ThemeValue.LIGHT | ThemeValue.DARK

/** A stored preference: a resolved theme, or `"system"`. */
export type ThemePreference = Theme | ThemeValue.SYSTEM

/** Persistence port. `localStorage` satisfies it. */
export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * Media-query port. `window.matchMedia` satisfies it.
 *
 * Both listeners are optional so a truncated test double needs nothing more than `matches`.
 */
export interface ThemeMediaQuery {
  readonly matches: boolean
  addEventListener?(type: "change", listener: (event: { matches: boolean }) => void): void
  removeEventListener?(type: "change", listener: (event: { matches: boolean }) => void): void
}

/** Media-query source port. `window.matchMedia` satisfies it. */
export type ThemeMediaSource = (query: string) => ThemeMediaQuery

/** Everything the store needs from the outside. All optional; defaults are the browser ones. */
export interface ThemePorts {
  /** Where the preference is kept. Defaults to `globalThis.localStorage` when it exists. */
  storage?: ThemeStorage | null
  /** OS preference source. Defaults to `globalThis.matchMedia` when it exists. */
  media?: ThemeMediaSource | null
  /** Storage key. Defaults to `"theme"`. */
  storageKey?: string
  /** Media query watched for OS changes. Defaults to the dark-scheme query. */
  systemQuery?: string
  /** Applies a resolved theme. Defaults to toggling the `dark` class on `documentElement`. */
  apply?: (theme: Theme) => void
  /**
   * The preference used when storage holds none this version understands. Defaults to `"system"`.
   *
   * An app whose owner picks the default palette passes it here and to
   * {@link themeBootstrapScript}, so the first paint and the attached store agree.
   */
  defaultPreference?: ThemePreference
}

/** A theme store: preference in, resolved theme out, plus the DOM wiring. */
export interface ThemeStore {
  /**
   * The user's choice. Writable so a settings form can bind to it.
   *
   * The default preference (`"system"` unless {@link ThemePorts.defaultPreference} says otherwise)
   * until {@link ThemeStore.attach} has read the stored one, because nothing is read out of storage
   * before then.
   */
  preference: Signal<ThemePreference>
  /** What the OS asks for: light until {@link ThemeStore.attach} has asked the media source. */
  system: ReadonlySignal<Theme>
  /** The theme to paint: the preference, or the OS one when the preference is `"system"`. */
  actual: ReadonlySignal<Theme>
  /** Store a preference and persist it. A storage that refuses the write is ignored. */
  set(preference: ThemePreference): void
  /** Flip light↔dark. From `"system"`, flips away from whatever the OS currently asks for. */
  toggle(): void
  /**
   * Read the stored preference and the OS one, start applying the theme and watch for OS changes.
   *
   * This is where the outside world is first read. The stored preference is loaded once, on the
   * first attach, so a re-attach cannot undo a {@link ThemeStore.set} whose write to storage
   * failed; the OS query is re-read every time, because it may have changed while detached.
   *
   * @returns A disposer; {@link ThemeStore.dispose} is the same thing.
   */
  attach(): () => void
  /** Run the disposer from `attach`. Idempotent. */
  dispose(): void
}

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const DEFAULT_STORAGE_KEY = "theme"

/** Whether a string read back from storage is a preference this version understands. */
function isThemePreference(value: unknown): value is ThemePreference {
  return value === ThemeValue.LIGHT || value === ThemeValue.DARK || value === ThemeValue.SYSTEM
}

/** Toggle the `dark` class on the document root, when there is a document. */
function applyToDocument(theme: Theme): void {
  const root = globalThis.document?.documentElement
  if (!root) return
  root.classList.toggle("dark", theme === ThemeValue.DARK)
}

/** `localStorage` when this runtime has one. Some runtimes throw on the property, not on use. */
function defaultStorage(): ThemeStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** `matchMedia` bound to the global object, when this runtime has one. */
function defaultMedia(query: string): ThemeMediaQuery | null {
  const matchMedia = globalThis.matchMedia
  return typeof matchMedia === "function" ? matchMedia.call(globalThis, query) : null
}

/**
 * Create a theme store. Reads nothing: the first read of the outside world is `attach()`.
 *
 * A module-level `createThemeStore()` is the normal way to hold one, and it runs on the server too.
 * Deno's `localStorage` is a real file shared by the whole process, so a preference read or written
 * during server rendering would be one visitor's choice applied to every request — which is why the
 * storage port, like the media query, is resolved on first use and not here.
 *
 * @example
 * ```ts
 * export const theme = createThemeStore()
 * // in the client entry point:
 * theme.attach()
 * ```
 */
export function createThemeStore(ports: ThemePorts = {}): ThemeStore {
  const storageKey = ports.storageKey ?? DEFAULT_STORAGE_KEY
  const systemQuery = ports.systemQuery ?? DARK_SCHEME_QUERY
  const apply = ports.apply ?? applyToDocument
  const defaultPreference = isThemePreference(ports.defaultPreference)
    ? ports.defaultPreference
    : ThemeValue.SYSTEM

  const preference = signal<ThemePreference>(defaultPreference)
  const system = signal<Theme>(ThemeValue.LIGHT)
  const actual = computed<Theme>(() =>
    preference.value === ThemeValue.SYSTEM ? system.value : preference.value
  )

  // `undefined` means "not resolved yet"; `null` is a resolved absence, which is what an explicit
  // `storage: null` and a runtime with no `localStorage` both come to.
  let storage: ThemeStorage | null | undefined
  let query: ThemeMediaQuery | null | undefined

  /** The storage port, resolved on the first read or write and remembered. */
  function storagePort(): ThemeStorage | null {
    if (storage === undefined) {
      storage = ports.storage === undefined ? defaultStorage() : ports.storage
    }
    return storage
  }

  /** The media query, resolved on the first attach and remembered, so listeners pair up. */
  function mediaQuery(): ThemeMediaQuery | null {
    if (query === undefined) {
      const source = ports.media === undefined ? defaultMedia : ports.media
      query = source?.(systemQuery) ?? null
    }
    return query
  }

  /** The stored preference, or `null` when there is none this version understands. */
  function readStored(): ThemePreference | null {
    try {
      const stored = storagePort()?.getItem(storageKey) ?? null
      // A value written by an older or unrelated version is ignored rather than trusted.
      return isThemePreference(stored) ? stored : null
    } catch {
      // A browser that refuses storage reads has no preference to offer, which is not an error.
      return null
    }
  }

  const set = (next: ThemePreference): void => {
    preference.value = next
    try {
      storagePort()?.setItem(storageKey, next)
    } catch {
      // A browser in private mode throws here. The theme still changes for this page; losing it on
      // reload beats throwing out of the click handler that set it.
    }
  }

  const toggle = (): void => {
    const current = preference.value
    if (current === ThemeValue.LIGHT) {
      set(ThemeValue.DARK)
    } else if (current === ThemeValue.DARK) {
      set(ThemeValue.LIGHT)
    } else {
      set(system.value === ThemeValue.LIGHT ? ThemeValue.DARK : ThemeValue.LIGHT)
    }
  }

  let detach: (() => void) | null = null
  let loaded = false

  const onSystemChange = (event: { matches: boolean }): void => {
    system.value = event.matches ? ThemeValue.DARK : ThemeValue.LIGHT
  }

  function attach(): () => void {
    dispose()
    if (!loaded) {
      loaded = true
      const stored = readStored()
      if (stored) preference.value = stored
    }
    const watched = mediaQuery()
    system.value = watched?.matches ? ThemeValue.DARK : ThemeValue.LIGHT
    watched?.addEventListener?.("change", onSystemChange)
    const stopEffect = effect(() => apply(actual.value))
    detach = () => {
      watched?.removeEventListener?.("change", onSystemChange)
      stopEffect()
      detach = null
    }
    return dispose
  }

  function dispose(): void {
    detach?.()
    detach = null
  }

  return { preference, system, actual, set, toggle, attach, dispose }
}

/** Options for {@link themeBootstrapScript}. Each default matches {@link createThemeStore}'s. */
export interface ThemeBootstrapOptions {
  /** Storage key the preference is read from. Defaults to `"theme"`. */
  storageKey?: string
  /** Media query that says the OS asks for dark. Defaults to the dark-scheme query. */
  systemQuery?: string
  /** The preference used when nothing understood is stored. Defaults to `"system"`. */
  defaultPreference?: ThemePreference
  /**
   * Keep following the OS after the first paint, for a page that never attaches a store. When
   * `true`, the script also listens for changes to `systemQuery` and repaints while the stored
   * preference (read again on every change) resolves to `"system"`. Defaults to `false`.
   */
  followSystem?: boolean
}

/** A value as a JavaScript literal that is also safe inside an inline `<script>` element. */
function scriptLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

/**
 * The source of an inline `<head>` script that paints the stored theme before the first paint.
 *
 * A theme store attaches only once the client bundle runs, so a page rendered dark for a reader who
 * chose dark would flash light until then. Render this string in a `<script>` element in `<head>`
 * (not a module, not deferred): it reads the same storage key as {@link createThemeStore}, accepts
 * the same values, resolves `"system"` through the same media query and toggles the same `dark`
 * class on `documentElement`. It never writes storage and never throws: a browser that refuses
 * storage reads gets the default preference.
 *
 * The options are written into the script as string literals, escaped so that none of them can end
 * the script element or run code; a `defaultPreference` this version does not know becomes
 * `"system"`, and only `followSystem: true` itself turns the listener on.
 *
 * A page that attaches a store needs nothing more: the store follows the OS from then on. A page
 * that never runs a store (a server-rendered embed without islands) passes `followSystem: true`,
 * so a reader on `"system"` still sees the theme change when the OS switches. The listener reads
 * storage again on every change, so a light or dark choice stored meanwhile is never overridden.
 *
 * @example
 * ```tsx
 * <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} />
 * ```
 */
export function themeBootstrapScript(options: ThemeBootstrapOptions = {}): string {
  const key = scriptLiteral(options.storageKey ?? DEFAULT_STORAGE_KEY)
  const query = scriptLiteral(options.systemQuery ?? DARK_SCHEME_QUERY)
  const fallback = scriptLiteral(
    isThemePreference(options.defaultPreference) ? options.defaultPreference : ThemeValue.SYSTEM,
  )
  const paint = `(function(){try{var s=null;try{s=localStorage.getItem(${key})}catch(e){}` +
    `var p=s==="light"||s==="dark"||s==="system"?s:${fallback};` +
    `var d=p==="dark"||(p==="system"&&typeof matchMedia==="function"&&matchMedia(${query}).matches);` +
    `document.documentElement.classList.toggle("dark",!!d)}catch(e){}})()`
  if (options.followSystem !== true) return paint
  // Older Safari has only `addListener` on a media query list.
  return paint +
    `;(function(){try{var m=matchMedia(${query});` +
    `var f=function(){try{var s=null;try{s=localStorage.getItem(${key})}catch(e){}` +
    `var p=s==="light"||s==="dark"||s==="system"?s:${fallback};` +
    `if(p==="system")document.documentElement.classList.toggle("dark",!!m.matches)}catch(e){}};` +
    `if(m.addEventListener)m.addEventListener("change",f);else if(m.addListener)m.addListener(f)` +
    `}catch(e){}})()`
}
