import { computed, type ReadonlySignal, signal } from "@preact/signals"
import { createSignedInHint } from "@spy4x/platform/browser/signed-in-hint"
import type { KeyValueStore } from "@spy4x/platform/universal/key-value-store"
import type { OnboardingDismissedPort } from "./onboarding.ts"

/**
 * `@spy4x/preact-signals/install-prompt` — whether and how the app can be installed, on signals.
 *
 * Chromium browsers fire `beforeinstallprompt` when an app may be installed, and the page keeps
 * that event to call `prompt()` later, from a button. Safari on iPhone and iPad fires nothing: the
 * person installs through Share, then Add to Home Screen, so the page can only explain that. An app
 * that already runs installed (standalone) offers neither. This store tells the three apart and
 * keeps one stored "dismissed" flag, so a person who said "not now" is not asked again.
 *
 * The window, the navigator, `matchMedia` and the flag's storage arrive as ports, so a test needs
 * no browser. {@link createStoredInstallPrompt} is the same store with the flag kept in the
 * browser's storage, for an app that wants one call.
 */

/** The slice of the `beforeinstallprompt` event this store uses. */
export interface InstallPromptEvent {
  /** Stops the browser's own mini info bar, so the page decides when to ask. */
  preventDefault(): void
  /** Shows the browser's install dialog. Allowed once per event, from a user gesture. */
  prompt(): Promise<unknown>
  /** Settles with the person's answer to the dialog. */
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** Event port. `window` satisfies it. */
export interface InstallPromptTarget {
  addEventListener(
    type: "beforeinstallprompt" | "appinstalled",
    listener: (event: InstallPromptEvent) => void,
  ): void
  removeEventListener(
    type: "beforeinstallprompt" | "appinstalled",
    listener: (event: InstallPromptEvent) => void,
  ): void
}

/** The slice of `navigator` this store reads. Every field is optional, so Deno's fits. */
export interface InstallPromptNavigator {
  readonly userAgent?: string
  /** iPadOS reports a desktop Mac user agent; touch points are what give it away. */
  readonly maxTouchPoints?: number
  /** Safari on iOS sets it to `true` when the page runs from the home screen. */
  readonly standalone?: boolean
}

/** `matchMedia` port. `globalThis.matchMedia` satisfies it. */
export type InstallPromptMatchMedia = (query: string) => { readonly matches: boolean }

/** Everything the store needs from the outside. All optional; defaults are the browser ones. */
export interface InstallPromptPorts {
  /** Where the two events arrive. Defaults to `globalThis.window` when it exists. */
  target?: InstallPromptTarget | null
  /** Defaults to `globalThis.navigator` when it exists. */
  navigator?: InstallPromptNavigator | null
  /** Defaults to `globalThis.matchMedia` when it exists. */
  matchMedia?: InstallPromptMatchMedia | null
  /**
   * Where the "dismissed" flag lives, the same port `createOnboardingState` takes. Left out, the
   * flag lives in memory and a reload asks again.
   */
  dismissed?: OnboardingDismissedPort
}

/**
 * How the app can be installed here.
 *
 * - `prompt`: the browser offered an install dialog; {@link InstallPromptStore.install} opens it.
 * - `ios`: iPhone or iPad, which has no dialog; show the Share, then Add to Home Screen steps.
 * - `installed`: the app runs standalone, or was just installed.
 * - `unavailable`: nothing to offer, such as a desktop browser that has not fired the event yet.
 */
export type InstallPromptMode = "prompt" | "ios" | "installed" | "unavailable"

/** What the install dialog came to. `unavailable` means there was no dialog to open. */
export type InstallOutcome = "accepted" | "dismissed" | "unavailable"

/** The install state, and the wiring that keeps it current. */
export interface InstallPromptStore {
  /** See {@link InstallPromptMode}. */
  mode: ReadonlySignal<InstallPromptMode>
  /** The stored flag: `true` once the person said "not now". */
  dismissed: ReadonlySignal<boolean>
  /** `true` when there is something to offer (`prompt` or `ios`) and it was not dismissed. */
  visible: ReadonlySignal<boolean>
  /**
   * Open the browser's install dialog and wait for the answer. The event can be used once, so the
   * mode leaves `prompt` either way: `installed` on acceptance, `unavailable` otherwise, including
   * when `prompt()` rejects, which this rethrows.
   */
  install(): Promise<InstallOutcome>
  /** Store the flag, so the offer stays hidden. Returns the port's promise when it has one. */
  dismiss(): void | Promise<void>
  /**
   * Follow `beforeinstallprompt` and `appinstalled` from now on.
   *
   * @param target Where this call listens, overriding {@link InstallPromptPorts.target}; `null`
   * listens nowhere.
   * @returns The function that removes this call's listeners.
   */
  watch(target?: InstallPromptTarget | null): () => void
}

/**
 * Whether this is an iPhone, iPod or iPad, where no browser fires `beforeinstallprompt`.
 *
 * Every browser on iOS is WebKit, and since iOS 16.4 each can add a page to the home screen from its
 * Share menu, so this checks the device, not the browser. iPadOS asks for desktop pages and calls
 * itself a Mac; a Mac with touch points is an iPad.
 *
 * In-app browsers on iOS, such as the web views inside Instagram or Gmail, also count as iOS here,
 * though they have no Add to Home Screen. Their user agents differ per app, so this does not try to
 * tell them apart; the steps then name a menu the person cannot find, and "Not now" hides them.
 */
export function isIosDevice(navigator: InstallPromptNavigator | null | undefined): boolean {
  const agent = navigator?.userAgent ?? ""
  if (/iPhone|iPad|iPod/.test(agent)) return true
  return agent.includes("Macintosh") && (navigator?.maxTouchPoints ?? 0) > 1
}

/**
 * Whether the page runs as an installed app: the display mode is `standalone` or `minimal-ui`, or
 * iOS's own flag says so. `fullscreen` is left out on purpose, because a browser tab in full-screen
 * mode matches it too.
 */
export function isStandalone(
  navigator: InstallPromptNavigator | null | undefined,
  matchMedia: InstallPromptMatchMedia | null | undefined,
): boolean {
  if (navigator?.standalone === true) return true
  return ["(display-mode: standalone)", "(display-mode: minimal-ui)"].some((query) =>
    Boolean(matchMedia?.(query).matches)
  )
}

/** The flag's storage when the caller gives none: memory only. */
function memoryFlag(): OnboardingDismissedPort {
  let value = false
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
  }
}

/**
 * Create an install prompt store. It reads the standalone state and the device once, and listens to
 * nothing until {@link InstallPromptStore.watch} runs.
 *
 * @example
 * ```ts
 * export const install = createInstallPrompt({
 *   dismissed: {
 *     read: () => localStorage.getItem("install-dismissed") === "1",
 *     write: (value) => localStorage.setItem("install-dismissed", value ? "1" : "0"),
 *   },
 * })
 * // in the client entry point, as early as possible: the event can fire before the app renders.
 * install.watch()
 * ```
 */
export function createInstallPrompt(ports: InstallPromptPorts = {}): InstallPromptStore {
  const navigator = ports.navigator === undefined ? globalThis.navigator ?? null : ports.navigator
  const matchMedia = ports.matchMedia === undefined
    ? (globalThis as { matchMedia?: InstallPromptMatchMedia }).matchMedia?.bind(globalThis) ?? null
    : ports.matchMedia
  const port = ports.dismissed ?? memoryFlag()

  const initial: InstallPromptMode = isStandalone(navigator, matchMedia)
    ? "installed"
    : isIosDevice(navigator)
    ? "ios"
    : "unavailable"
  const mode = signal<InstallPromptMode>(initial)
  // The port is read on first use, not here, so a store created at module level on a server reads
  // no storage until something asks for the flag.
  let stored: boolean | undefined
  const changed = signal<boolean | undefined>(undefined)
  const dismissed = computed(() => changed.value ?? (stored ??= port.read()))
  let deferred: InstallPromptEvent | null = null

  function watch(override?: InstallPromptTarget | null): () => void {
    const target = override !== undefined
      ? override
      : ports.target !== undefined
      ? ports.target
      : (globalThis as { window?: InstallPromptTarget }).window ?? null
    const offered = (event: InstallPromptEvent): void => {
      event.preventDefault()
      if (mode.value === "installed") return
      deferred = event
      mode.value = "prompt"
    }
    const installed = (): void => {
      deferred = null
      mode.value = "installed"
    }
    target?.addEventListener("beforeinstallprompt", offered)
    target?.addEventListener("appinstalled", installed)
    return () => {
      target?.removeEventListener("beforeinstallprompt", offered)
      target?.removeEventListener("appinstalled", installed)
    }
  }

  async function install(): Promise<InstallOutcome> {
    const event = deferred
    if (!event) return "unavailable"
    deferred = null
    let outcome: "accepted" | "dismissed" = "dismissed"
    try {
      await event.prompt()
      outcome = (await event.userChoice).outcome
      return outcome
    } finally {
      // The event is used up even when `prompt()` throws, so the offer cannot stay. Read the mode
      // again: `appinstalled` may have already set `installed` while the dialog was open.
      if (mode.value === "prompt") mode.value = outcome === "accepted" ? "installed" : "unavailable"
    }
  }

  function dismiss(): void | Promise<void> {
    // Written first, as `createOnboardingState` does: a write that throws changes nothing here.
    const saving = port.write(true)
    changed.value = true
    if (saving === undefined) return
    return saving.catch((error: unknown) => {
      changed.value = false
      throw error
    })
  }

  return {
    mode,
    dismissed,
    visible: computed(() => !dismissed.value && (mode.value === "prompt" || mode.value === "ios")),
    install,
    dismiss,
    watch,
  }
}

/** The storage key {@link createStoredInstallPrompt} keeps the "dismissed" flag under. */
export const INSTALL_DISMISSED_KEY = "install-prompt-dismissed"

/** What {@link createStoredInstallPrompt} takes: the store's ports, and where the flag is kept. */
export interface StoredInstallPromptOptions extends Omit<InstallPromptPorts, "dismissed"> {
  /** The storage key of the flag. Defaults to {@link INSTALL_DISMISSED_KEY}. */
  key?: string
  /**
   * Where the flag is kept. Defaults to `globalThis.localStorage`, looked up on every call and
   * treated as missing when the lookup throws. `null` means no storage: the flag lives in memory.
   */
  storage?: KeyValueStore | null
}

/**
 * Create an install prompt store that remembers "not now" in the browser's storage.
 *
 * It is {@link createInstallPrompt} with the `dismissed` port filled in: the flag is the text `1`
 * under {@link StoredInstallPromptOptions.key}, and any other stored text counts as not dismissed.
 * Storage that is missing, blocked or full never throws here. A dismissal it could not keep still
 * hides the offer until the page is loaded again, and then the offer shows again.
 *
 * On a server, pass `storage: null`: Deno has a `localStorage` every request would share.
 *
 * @example
 * ```ts
 * export const install = createStoredInstallPrompt()
 * // in the client entry point, as early as possible: the event can fire before the app renders.
 * install.watch()
 * ```
 */
export function createStoredInstallPrompt(
  { key = INSTALL_DISMISSED_KEY, storage, ...ports }: StoredInstallPromptOptions = {},
): InstallPromptStore {
  const flag = createSignedInHint<1>(key, {
    validate: (value): value is 1 => value === 1,
    storage,
  })
  return createInstallPrompt({
    ...ports,
    dismissed: {
      read: () => flag.recall() !== null,
      write: (value) => value ? flag.remember(1) : flag.forget(),
    },
  })
}
