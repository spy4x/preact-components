import { cn } from "@preact-components/cn"
import type { JSX } from "preact"
import { CopyButton } from "./copy-button.tsx"

export interface InstallBoxProps {
  /** The command text — real, selectable text inside a `<code>`, not a background image. */
  command: string
  /**
   * Injected clipboard port, forwarded to the underlying {@link CopyButton}. Left out, the browser
   * clipboard API is used, falling back to `execCommand("copy")` on an insecure origin.
   */
  copy?: (text: string) => void | Promise<void>
  /** Tooltip and accessible name of the copy control. Defaults to `"Copy command"`. */
  copyLabel?: string
  class?: string
}

/**
 * A code snippet box with a copy button — an install command, most often.
 *
 * Built on {@link CopyButton} rather than reimplementing the clipboard write: this component owns
 * only the box and the monospace text, `CopyButton` owns the write, the insecure-origin fallback
 * and the copied-state icon swap.
 */
export function InstallBox(
  { command, copy, copyLabel = "Copy command", class: className }: InstallBoxProps,
): JSX.Element {
  return (
    <div
      class={cn(
        "rounded-primary border-control bg-canvas flex items-center gap-3 border px-3 py-2",
        className,
      )}
    >
      <code class="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-pre">
        {command}
      </code>
      <CopyButton textToCopy={command} copy={copy} copyLabel={copyLabel} class="shrink-0" />
    </div>
  )
}
