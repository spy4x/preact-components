import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { CopyButton, copyToClipboard } from "./copy-button.tsx"

/** Props of `CopyBlock`, the one block of copyable text this package ships. */
export interface CopyBlockProps {
  /** The text shown and copied: real, selectable text inside a `<code>`. */
  text: string
  /**
   * Keep the text on one line, scrolling sideways inside its own box when it is wider than the box.
   * Left out, the text wraps inside the box instead, breaking anywhere a line has to. Neither
   * clips.
   */
  singleLine?: boolean
  /**
   * Injected clipboard port, forwarded to {@link CopyButton}. Left out, the browser clipboard API
   * is used, falling back to `execCommand("copy")` on an insecure origin.
   */
  copy?: (text: string) => void | Promise<void>
  /** Tooltip and accessible name of the copy control. Defaults to `"Copy"`. */
  copyLabel?: string
  /**
   * What a copy is announced as. Defaults to `"Copied"`.
   *
   * A prop rather than a suffix built from `copyLabel`: English past tenses are not derivable, and
   * `"Copy command"` + `"ed"` is not the confirmation anybody wants to hear.
   */
  copiedLabel?: string
  /** Milliseconds the copied state is shown and announced for. Defaults to 1500. */
  copiedForMs?: number
  class?: string
}

/** {@link CopyBlockProps} plus the copied state, which `CopyBlock` itself owns. */
export interface CopyBlockBodyProps extends CopyBlockProps {
  /** Whether a copy has just happened. */
  copied: boolean
  /** Called when the copy control is pressed, before the clipboard write. */
  onCopy: () => void
}

/** Default milliseconds the copied state stays announced for. */
export const DEFAULT_COPIED_FOR_MS = 1500

/**
 * The markup of `CopyBlock`, with the copied state handed in.
 *
 * Kept out of the package's exports on purpose: it exists so a test can call it directly and read
 * the props it hands to {@link CopyButton} — `CopyBlock` calls `useState`, and a component that
 * calls a hook cannot be invoked outside a render.
 *
 * A port is always handed to `CopyButton` — the caller's when there is one, the library's own
 * clipboard write otherwise — because the press would otherwise happen inside `CopyButton` and
 * leave nothing out here to announce.
 *
 * @param props Text, copy wiring and the copied state.
 * @returns The box: the text, the copy control and a polite live region.
 */
export function CopyBlockBody(
  {
    text,
    singleLine = false,
    copy,
    copyLabel = "Copy",
    copiedLabel = "Copied",
    copiedForMs = DEFAULT_COPIED_FOR_MS,
    copied,
    onCopy,
    class: className,
  }: CopyBlockBodyProps,
): JSX.Element {
  const port = (value: string) => {
    onCopy()
    copyToClipboard(value, copy)
  }

  return (
    <div
      class={cn(
        "rounded-primary border-control bg-canvas flex min-w-0 items-start gap-3 border px-3 py-2",
        className,
      )}
    >
      <code
        class={cn(
          "min-w-0 flex-1 self-center font-mono text-sm",
          singleLine ? "overflow-x-auto whitespace-pre" : "whitespace-pre-wrap wrap-anywhere",
        )}
      >
        {text}
      </code>
      <CopyButton
        textToCopy={text}
        copy={port}
        copyLabel={copyLabel}
        copiedForMs={copiedForMs}
        class="shrink-0"
      />
      <span role="status" aria-live="polite" class="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </div>
  )
}
