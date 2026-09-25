import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { CopyButton, copyToClipboard } from "./copy-button.tsx"
import { useEffect, useState } from "preact/hooks"

export interface CopyableTextProps {
  /** The identifier itself. Always the value rendered, and always the value copied. */
  text: string
  /**
   * Clip the rendered value to one line with `text-overflow: ellipsis`.
   *
   * Visual only: the element keeps the whole string as its text, so its accessible name is the full
   * value. The `title` below is what lets a sighted user read what the ellipsis swallowed.
   */
  truncate?: boolean
  /** Tooltip on the value element. Defaults to `text` while `truncate` is set. */
  title?: string
  /**
   * Injected clipboard port, forwarded to {@link CopyButton}, e.g. the host app's `clipboard.copy`.
   *
   * Left out, copying falls back to `navigator.clipboard` and `document.execCommand("copy")`.
   */
  copy?: (text: string) => void | Promise<void>
  /** Tooltip and accessible name of the copy control. Defaults to `"Copy"`. */
  copyLabel?: string
  /**
   * What a copy is announced as. Defaults to `"Copied"`.
   *
   * A prop rather than a suffix built from `copyLabel`: English past tenses are not derivable, and
   * `"Copy API key"` + `"ed"` is not the confirmation anybody wants to hear.
   */
  copiedLabel?: string
  /** Milliseconds the copied state is announced for. Defaults to 1500. */
  copiedForMs?: number
  class?: string
}

/** {@link CopyableTextProps} without the copied state, which the caller owns. */
export interface CopyableTextBodyProps extends CopyableTextProps {
  /** Whether a copy has just happened. */
  copied: boolean
  /** Called when the copy control is clicked, before the clipboard write. */
  onCopy: () => void
}

/* Monospace so an id reads as an id, and `min-w-0` so the flex child is allowed to shrink. */
const valueClasses = "min-w-0 font-mono text-sm text-gray-700 dark:text-gray-300"

/**
 * Monospace value with an integrated copy control — the "id + copy" pattern, minus the state.
 *
 * Exists as its own export because {@link CopyableText} calls `useState`, and a component that calls
 * a hook cannot be invoked outside a render: splitting the body is what lets the props it hands down
 * — the copy port above all — be asserted directly, the way `ui-guide`'s copy suite asserts them.
 *
 * The port is handed over on every render rather than memoised: `CopyButton` reads it inside its own
 * click handler, so identity carries nothing, and the state lives in one instance either way.
 *
 * Truncation is CSS-only: the value element keeps the whole string and `truncate` clips it, so the
 * accessible name is the full value and nothing has to be hidden from, or duplicated for, assistive
 * tech. A `title` carries the full value for sighted users who only see the ellipsis.
 *
 * The copy itself is {@link CopyButton}, port and feedback included; this component adds nothing to
 * the clipboard path beyond the live region.
 *
 * @param props Value, copy wiring and the caller's copied state.
 * @returns The value, the copy control and the live region.
 */
export function CopyableTextBody(
  {
    text,
    truncate,
    title,
    copy,
    copyLabel = "Copy",
    copiedLabel = "Copied",
    copiedForMs,
    copied,
    onCopy,
    class: className,
  }: CopyableTextBodyProps,
): JSX.Element {
  /*
   * A port is always handed to `CopyButton` — the caller's when there is one, the library's own
   * clipboard write otherwise — because the click would otherwise happen inside `CopyButton` and
   * leave nothing out here to announce.
   */
  const port = (value: string) => {
    onCopy()
    copyToClipboard(value, copy)
  }

  return (
    <span class={cn("inline-flex max-w-full min-w-0 items-center gap-2", className)}>
      <span
        title={truncate ? title ?? text : title}
        class={cn(valueClasses, truncate && "truncate")}
      >
        {text}
      </span>
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
    </span>
  )
}

/** Default milliseconds the copied state stays announced for. */
const DEFAULT_COPIED_FOR_MS = 1500

/** The copied-for window, defaulted in one place so body and shell cannot disagree. */
function copiedForMsOf(props: CopyableTextProps): number {
  return props.copiedForMs ?? DEFAULT_COPIED_FOR_MS
}

/**
 * Monospace value with an integrated copy control — the "id + copy" pattern.
 *
 * The state here is one boolean: whether a copy has just happened. It exists to fill a polite
 * `role="status"` region, because `CopyButton` confirms a copy by swapping its glyph and that swap
 * reaches neither a screen reader nor an `aria-label`. The region is emptied again after
 * `copiedForMs`, which is what makes a second copy announce a second time.
 */
export function CopyableText(props: CopyableTextProps): JSX.Element {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), copiedForMsOf(props))
    return () => clearTimeout(timer)
  }, [copied, props.copiedForMs])

  return CopyableTextBody({ ...props, copied, onCopy: () => setCopied(true) })
}
