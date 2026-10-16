import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

/** Which device a {@link WindowFrame} draws around its content. */
export type WindowFrameVariant = "browser" | "terminal" | "phone"

/** Props of {@link WindowFrame}. */
export interface WindowFrameProps {
  /** A browser window, a terminal window or a phone. */
  variant: WindowFrameVariant
  /**
   * The address in the browser's bar, or the terminal's title. Decorative, so hidden from assistive
   * tech; the terminal's scrollable output takes it as its accessible name ("Terminal" without it).
   */
  title?: string
  children?: ComponentChildren
  /** Shown under the frame as the figure's `<figcaption>`. */
  caption?: ComponentChildren
  class?: string
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

/** Light: a large soft shadow. Dark: a 1 px border with a faint highlight along the top edge. */
const browserFrame = "overflow-hidden rounded-xl border border-transparent bg-surface shadow-2xl " +
  "dark:border-subtle dark:shadow-[inset_0_1px_0_var(--color-border-strong)]"

/*
 * The terminal is dark in both themes: its frame carries the `dark` class, which repaints the theme
 * tokens for its subtree, so it reads the default dark palette's canvas and foreground (about 16:1)
 * whatever the page's theme. Under ink it draws the default dark palette, not ink's.
 */
const terminalFrame =
  "dark overflow-hidden rounded-xl border border-subtle bg-canvas text-foreground shadow-2xl"

const phoneFrame =
  "mx-auto aspect-[9/19] w-full max-w-xs rounded-[2.5rem] bg-foreground p-2 shadow-2xl"

/**
 * Draws a browser window, a terminal or a phone around a screenshot or a snippet, for a marketing
 * page.
 *
 * The chrome (the window buttons, the address bar, the notch) is decorative and hidden from
 * assistive tech. Server-rendered with no hooks and no JavaScript.
 *
 * @param props The variant, content and caption, see {@link WindowFrameProps}.
 * @returns A `<figure>`, with the caption as its `<figcaption>`.
 */
export function WindowFrame(
  { variant, title, children, caption, class: className }: WindowFrameProps,
): JSX.Element {
  return (
    <figure class={cn("flex min-w-0 flex-col gap-3", className)}>
      {variant === "browser" && (
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
      )}
      {variant === "terminal" && (
        <div class={terminalFrame}>
          <div aria-hidden="true" class="flex items-center gap-4 border-b border-subtle px-4 py-3">
            <Dots />
            <span class="min-w-0 flex-1 truncate text-center text-xs text-muted">{title}</span>
          </div>
          {/* It may overflow sideways, so it is focusable and named for keyboard scrolling. */}
          <div
            role="group"
            aria-label={title ?? "Terminal"}
            tabIndex={0}
            class="overflow-x-auto p-4 font-mono text-sm whitespace-pre focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
          >
            {children}
          </div>
        </div>
      )}
      {variant === "phone" && (
        <div class={phoneFrame}>
          <div class="relative h-full overflow-hidden rounded-[2rem] bg-surface">
            <span
              aria-hidden="true"
              class="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-foreground"
            />
            {children}
          </div>
        </div>
      )}
      {caption !== undefined && (
        <figcaption class="text-center text-sm text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
