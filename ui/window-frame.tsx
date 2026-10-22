import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { FrameChrome, type WindowFrameVariant } from "./frame-chrome.tsx"

export type { WindowFrameVariant }

/** Props of {@link WindowFrame}. */
export interface WindowFrameProps {
  /**
   * A plain frame (the border and surface alone, the default for product media), a browser window
   * (when the address matters), a terminal window or a phone.
   */
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

/**
 * Draws a plain frame, a browser window, a terminal or a phone around a screenshot or a snippet, for
 * a marketing page. The plain frame suits most product media; the browser's bar is for when the URL
 * itself matters.
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
      <FrameChrome variant={variant} title={title}>{children}</FrameChrome>
      {caption !== undefined && (
        <figcaption class="text-center text-sm text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
