/**
 * The frame `WindowFrame` draws, without its figure and caption: a plain frame, a browser window, a
 * terminal or a phone around the content. Kept apart from `window-frame.tsx` because that module merges its
 * `class` with `cn`, and `ScreenTour` draws the same device in an island that must not carry
 * `tailwind-merge`. Internal: not one of the package's entry points.
 *
 * @module
 */

import type { ComponentChildren, JSX } from "preact"
import { translate, useT } from "./i18n.tsx"

/**
 * Which frame a `WindowFrame` or a `ScreenTour` draws around its content. `plain` is the rounded
 * border and surface alone, the default for product media; `browser` adds a window bar with an
 * address, for when the URL itself matters.
 */
export type WindowFrameVariant = "plain" | "browser" | "terminal" | "phone"

/** Props of {@link FrameChrome}. */
export interface FrameChromeProps {
  /** A plain frame, a browser window, a terminal window or a phone. */
  variant: WindowFrameVariant
  /** The address in the browser's bar, or the terminal's title. The plain frame and the phone show none. */
  title?: string
  children?: ComponentChildren
}

/** The three window buttons, drawn in neutral dots. */
function Dots(): JSX.Element {
  return (
    <span class="flex shrink-0 gap-2">
      <span class="size-3 rounded-full bg-track" />
      <span class="size-3 rounded-full bg-track" />
      <span class="size-3 rounded-full bg-track" />
    </span>
  )
}

/**
 * The browser's and the plain frame's box. Light: a large soft shadow. Dark: a 1 px border with a
 * faint highlight along the top edge. The border is the `--color-border-frame` token, not a `dark:`
 * class, so an app that maps its palette through tokens without the `dark` variant still gets the
 * edge.
 */
const browserFrame = "overflow-hidden rounded-xl border border-frame bg-surface shadow-2xl " +
  "dark:shadow-[inset_0_1px_0_var(--color-border-strong)]"

/*
 * The terminal is dark in both themes: its frame carries the `dark` class, which repaints the theme
 * tokens for its subtree, so it reads the default dark palette's canvas and foreground (about 16:1)
 * whatever the page's theme. Under ink it draws the default dark palette, not ink's.
 */
const terminalFrame =
  "dark overflow-hidden rounded-xl border border-subtle bg-canvas text-foreground shadow-2xl"

/**
 * The phone. Its top bezel is deeper than the sides and holds the notch, so the notch never covers
 * the top of the screenshot, where an app keeps its own bar.
 */
const phoneFrame =
  "relative mx-auto aspect-[9/19] w-full max-w-xs rounded-[2.5rem] bg-foreground p-2 pt-8 shadow-2xl"

/**
 * Draws the device around `children`. The chrome (the window buttons, the address bar, the notch)
 * is decorative and hidden from assistive tech; the terminal's output is a named, focusable group
 * because it may scroll sideways.
 *
 * @param props The variant, the title and the content, see {@link FrameChromeProps}.
 * @returns The device's outer `<div>`.
 */
export function FrameChrome({ variant, title, children }: FrameChromeProps): JSX.Element {
  const translator = useT()
  if (variant === "terminal") {
    return (
      <div class={terminalFrame}>
        <div aria-hidden="true" class="flex items-center gap-4 border-b border-subtle px-4 py-3">
          <Dots />
          <span class="min-w-0 flex-1 truncate text-center text-xs text-muted">{title}</span>
        </div>
        {/* It may overflow sideways, so it is focusable and named for keyboard scrolling. */}
        <div
          role="group"
          aria-label={title ?? translate(translator, "FrameChrome.terminal", "Terminal")}
          tabIndex={0}
          class="overflow-x-auto p-4 font-mono text-sm whitespace-pre focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          {children}
        </div>
      </div>
    )
  }
  if (variant === "phone") {
    return (
      <div class={phoneFrame}>
        <span
          aria-hidden="true"
          class="absolute start-1/2 top-3 h-2 w-16 -translate-x-1/2 [&:dir(rtl)]:translate-x-1/2 rounded-full bg-track"
        />
        <div class="relative h-full overflow-hidden rounded-[2rem] bg-surface">{children}</div>
      </div>
    )
  }
  if (variant === "plain") return <div class={browserFrame}>{children}</div>
  return (
    <div class={browserFrame}>
      <div
        aria-hidden="true"
        class="flex items-center gap-4 border-b border-subtle bg-canvas px-4 py-3"
      >
        <Dots />
        <span class="min-w-0 flex-1 truncate rounded-md bg-surface px-3 py-1 text-center text-xs text-muted">
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}
