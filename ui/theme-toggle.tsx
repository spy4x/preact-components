import { join } from "@spy4x/preact-cn/join"
import { IconMoon, IconSun, IconThemeAuto } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useEffect, useState } from "preact/hooks"
import { Button } from "./button.tsx"
import { hintBubbleClasses } from "./hint-bubble.ts"

/**
 * The slice of a theme store {@link ThemeToggle} reads, described by shape so this package imports
 * no store: `createThemeStore()` from `@spy4x/preact-signals/theme` satisfies it as it is.
 */
export interface ThemeToggleStore {
  /** The chosen preference; `"system"` follows the device. */
  readonly preference: { readonly value: "light" | "dark" | "system" }
  /** The theme being painted: the preference, or the device's theme while on `"system"`. */
  readonly actual: { readonly value: "light" | "dark" }
  /** Step to the next preference: auto → the opposite of the device → the device's own → auto. */
  cycle(): void
}

/** Words {@link ThemeToggle} shows or announces. Each one has an English default. */
export interface ThemeToggleLabels {
  /** Accessible name while the theme follows a light device. Defaults to `"Theme: auto (light)"`. */
  autoLight: string
  /** Accessible name while the theme follows a dark device. Defaults to `"Theme: auto (dark)"`. */
  autoDark: string
  /** Accessible name while the theme is light by choice. Defaults to `"Theme: light"`. */
  light: string
  /** Accessible name while the theme is dark by choice. Defaults to `"Theme: dark"`. */
  dark: string
  /** The hint shown and announced on a switch to auto. Defaults to `"Auto mode"`. */
  hint: string
}

/** The English words {@link ThemeToggle} uses when a caller passes none. */
export const defaultThemeToggleLabels: ThemeToggleLabels = {
  autoLight: "Theme: auto (light)",
  autoDark: "Theme: auto (dark)",
  light: "Theme: light",
  dark: "Theme: dark",
  hint: "Auto mode",
}

export interface ThemeToggleProps {
  /**
   * The app's theme store, normally `createThemeStore()` from `@spy4x/preact-signals/theme`. The
   * app owns it and calls its `attach()`; the button only reads it and calls `cycle()`.
   */
  store: ThemeToggleStore
  /** Replaces any of the English words; see {@link ThemeToggleLabels}. */
  labels?: Partial<ThemeToggleLabels>
  /** Milliseconds the "Auto mode" hint stays up. Defaults to 2000. */
  hintForMs?: number
  /**
   * Utilities for the wrapper around the button and its hint, appended to its own and merged with
   * none of them: mark a replacement important with a trailing `!`.
   */
  class?: string
}

/**
 * Where the hint sits: under the button, right edges aligned, out of the flow so nothing moves
 * when it appears, and out of hit testing so it never takes a click.
 */
const hintRegion = "pointer-events-none absolute top-full right-0 z-50 w-max pt-2"

/**
 * One icon button that steps through the theme preference: auto → the opposite of the device →
 * the device's own → auto, in the order `ThemeStore.cycle()` decides.
 *
 * The icon shows the preference (auto, sun, moon) and the accessible name says it, with the
 * device's theme while on auto. Three states are more than `aria-pressed` can say, so the name
 * changes per state instead.
 *
 * A switch to auto often changes nothing on screen (light becomes auto on a light device), so
 * that click shows a small "Auto mode" hint under the button for {@link ThemeToggleProps.hintForMs}.
 * The hint is the text of a polite live region that is in the DOM from the first render, because a
 * region inserted together with its text is often not announced. It is positioned out of the flow,
 * takes no pointer events and is never focused, so the button keeps focus and nothing moves. A click
 * away from auto while the hint is up hides it at once; the next switch to auto shows it again with
 * a fresh timer. The timer is cleared on unmount.
 *
 * Server-renderable: a store is on auto until its `attach()` reads storage, so the server and the
 * first browser render agree.
 */
export function ThemeToggle(
  { store, labels, hintForMs = 2000, class: className }: ThemeToggleProps,
): JSX.Element {
  const text = { ...defaultThemeToggleLabels, ...labels }
  // A number rather than a flag: each switch to auto gets a new one, so the effect below restarts
  // the timer even when the previous hint has not gone yet. `0` means no hint.
  const [hint, setHint] = useState(0)

  useEffect(() => {
    if (hint === 0) return
    const timer = setTimeout(() => setHint(0), hintForMs)
    return () => clearTimeout(timer)
  }, [hint, hintForMs])

  const preference = store.preference.value
  const label = preference === "light"
    ? text.light
    : preference === "dark"
    ? text.dark
    : store.actual.value === "dark"
    ? text.autoDark
    : text.autoLight
  const icon = preference === "light"
    ? <IconSun class="size-4" />
    : preference === "dark"
    ? <IconMoon class="size-4" />
    : <IconThemeAuto class="size-4" />

  const onClick = () => {
    store.cycle()
    setHint((last) => store.preference.value === "system" ? last + 1 : 0)
  }

  return (
    <span class={join("relative inline-flex", className)}>
      <Button variant="icon" aria-label={label} title={label} onClick={onClick}>
        {icon}
      </Button>
      <span role="status" aria-live="polite" aria-atomic="true" class={hintRegion}>
        {hint === 0 ? null : <span class={hintBubbleClasses}>{text.hint}</span>}
      </span>
    </span>
  )
}
