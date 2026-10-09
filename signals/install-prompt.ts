import { computed, type ReadonlySignal, signal } from "@preact/signals"
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
 * no browser.
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
   * mode leaves `prompt` either way: `installed` on acceptance, `unavailable` otherwise.
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
 */
export function isIosDevice(navigator: InstallPromptNavigator | null | undefined): boolean {
  const agent = navigator?.userAgent ?? ""
  if (/iPhone|iPad|iPod/.test(agent)) return true
  return agent.includes("Macintosh") && (navigator?.maxTouchPoints ?? 0) > 1
}

/** Whether the page runs as an installed app: the display mode says so, or iOS's own flag does. */
export function isStandalone(
  navigator: InstallPromptNavigator | null | undefined,
  matchMedia: InstallPromptMatchMedia | null | undefined,
): boolean {
  if (navigator?.standalone === true) return true
  return Boolean(matchMedia?.("(display-mode: standalone)").matches)
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
  const dismissed = signal(port.read())
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
    await event.prompt()
    const { outcome } = await event.userChoice
    // Read again: `appinstalled` may have already set `installed` while the dialog was open.
    if (mode.value === "prompt") mode.value = outcome === "accepted" ? "installed" : "unavailable"
    return outcome
  }

  function dismiss(): void | Promise<void> {
    // Written first, as `createOnboardingState` does: a write that throws changes nothing here.
    const saving = port.write(true)
    dismissed.value = true
    if (saving === undefined) return
    return saving.catch((error: unknown) => {
      dismissed.value = false
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
