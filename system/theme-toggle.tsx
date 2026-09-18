/**
 * `ThemeToggle` — one icon button cycling auto → light → dark.
 *
 * Mode in, mode out: the component holds no preference and reads no storage, so the app owns
 * where the setting lives (a signal, `localStorage`, a cookie) and can keep it in sync across
 * tabs. `mode` is optional because the stored preference is unknowable during SSR — with no
 * `mode` the component renders an inert, same-size placeholder, which is what stops the layout
 * shifting when the real button hydrates.
 */

import { cn } from "@preact-components/signals/cn"
import { IconMoon, IconSun, IconThemeAuto } from "@preact-components/icons"
import type { ComponentChildren } from "preact"

/** Theme preference, `"auto"` meaning "follow the system". */
export type ThemeMode = "auto" | "light" | "dark"

/** The mode one click away: auto → light → dark → auto. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  switch (mode) {
    case "auto":
      return "light"
    case "light":
      return "dark"
    default:
      return "auto"
  }
}

/** Accessible name describing the current mode and the next click. */
export function themeToggleLabel(mode: ThemeMode): string {
  return mode === "auto"
    ? "Theme: follows system. Click for light."
    : mode === "light"
    ? "Theme: light. Click for dark."
    : "Theme: dark. Click for auto."
}

export interface ThemeToggleProps {
  /**
   * Resolved preference, or `undefined` before the app has read it — server rendering, and the
   * first client render. No `mode` renders the placeholder instead of a button.
   */
  mode?: ThemeMode
  /** Called with the next mode in the cycle. Persisting it is the caller's job. */
  onChange: (mode: ThemeMode) => void
  /**
   * Replaces the placeholder rendered while `mode` is unknown. It occupies the same box, so the
   * default is an invisible copy of the button.
   */
  placeholder?: ComponentChildren
  /** Accessible name override; defaults to {@link themeToggleLabel}. */
  label?: string
  /** Utilities for the button. */
  class?: string
}

const buttonClass =
  "relative inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus-visible:ring-purple-400 dark:focus-visible:ring-offset-gray-800"

function ModeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "light") return <IconSun class="size-4" />
  if (mode === "dark") return <IconMoon class="size-4" />
  return <IconThemeAuto class="size-4" />
}

export function ThemeToggle(
  { mode, onChange, placeholder, label, class: className }: ThemeToggleProps,
) {
  if (mode === undefined) {
    return (
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        class={cn(buttonClass, "cursor-default opacity-0", className)}
      >
        {placeholder ?? <ModeIcon mode="auto" />}
      </button>
    )
  }

  const accessibleLabel = label ?? themeToggleLabel(mode)

  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={() => onChange(nextThemeMode(mode))}
      class={cn(buttonClass, className)}
    >
      <ModeIcon mode={mode} />
    </button>
  )
}
