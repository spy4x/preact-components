import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { CopyButton } from "./copy-button.tsx"
import type { CopyPort } from "./copy-button-body.tsx"

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
   * Injected clipboard port, forwarded to {@link CopyButton}: it reports a failure by throwing,
   * rejecting or returning `false`. Left out, the browser clipboard API is used, falling back to
   * `execCommand("copy")` on an insecure origin.
   */
  copy?: CopyPort
  /** Tooltip and accessible name of the copy control. Defaults to `"Copy"`. */
  copyLabel?: string
  /**
   * What a copy that worked is announced as. Defaults to `"Copied"`.
   *
   * A prop rather than a suffix built from `copyLabel`: English past tenses are not derivable, and
   * `"Copy command"` + `"ed"` is not the confirmation anybody wants to hear.
   */
  copiedLabel?: string
  /** What a copy that failed is announced as. Defaults to `"Copy failed"`. */
  failedLabel?: string
  /** Milliseconds the confirmation is shown and announced for. Defaults to 1500. */
  copiedForMs?: number
  class?: string
}

/**
 * A box of monospace text with a copy control beside it: an install command, an API key, an id.
 *
 * The text is never clipped. By default it wraps inside the box, breaking anywhere a line has to;
 * `singleLine` keeps it on one line and lets it scroll sideways inside its own box instead.
 *
 * The copy, its confirmation and its announcement are all `CopyButton`'s: a copy that worked is
 * announced as `copiedLabel` and one that failed as `failedLabel`, in a polite live region that
 * empties again after `copiedForMs`, so a second copy is announced a second time.
 *
 * @param props Text, layout and copy wiring.
 * @returns The box: the text and the copy control.
 */
export function CopyBlock(
  {
    text,
    singleLine = false,
    copy,
    copyLabel = "Copy",
    copiedLabel,
    failedLabel,
    copiedForMs,
    class: className,
  }: CopyBlockProps,
): JSX.Element {
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
        copy={copy}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        failedLabel={failedLabel}
        copiedForMs={copiedForMs}
        class="shrink-0"
      />
    </div>
  )
}
