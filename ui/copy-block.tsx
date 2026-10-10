import { cn } from "@spy4x/preact-cn"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
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
   * Accessible name of the text of a `singleLine` block when the text overflows its box: only then
   * is it a Tab stop, so that a keyboard can scroll it. Defaults to `"Text to copy"`. Text that
   * fits, and a block that wraps, has no Tab stop and no name.
   */
  textLabel?: string
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

/** What the text looks like in both layouts. */
const TEXT_CLASS = "min-w-0 flex-1 self-center font-mono text-sm"

/**
 * The text of a `singleLine` block: one line that scrolls sideways inside its own box.
 *
 * The server cannot know whether the text fits, so it renders the box as a named Tab stop, which
 * is right when the text overflows and no script runs. After mount the box is measured, and again
 * whenever it or the text changes size (a narrower page, a web font that arrives late, new text):
 * while the text fits, the Tab stop, the role and the name are dropped, because a stop with
 * nothing to scroll does nothing. The text sits in an inline block of its own so that its width
 * can be observed; the box's own size does not change when only the text does.
 *
 * @param props The text and the accessible name of the box while it scrolls.
 * @returns The `<code>` element.
 */
function OneLineText({ text, label }: { text: string; label: string }): JSX.Element {
  const box = useRef<HTMLElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const fits = useSignal(false)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const measure = () => {
      fits.value = node.scrollWidth <= node.clientWidth
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (line.current) observer.observe(line.current)
    return () => observer.disconnect()
  }, [])

  return (
    <code
      ref={box}
      {...(fits.value ? {} : { role: "group", "aria-label": label, tabIndex: 0 })}
      class={cn(
        TEXT_CLASS,
        "overflow-x-auto whitespace-pre",
        !fits.value &&
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus",
      )}
    >
      <span ref={line} class="inline-block">{text}</span>
    </code>
  )
}

/**
 * A box of monospace text with a copy control beside it: an install command, an API key, an id.
 *
 * The text is never clipped. By default it wraps inside the box, breaking anywhere a line has to;
 * `singleLine` keeps it on one line and lets it scroll sideways inside its own box instead. When
 * the text overflows that box, the box is a Tab stop named `textLabel`, so the arrow keys scroll
 * it: a group, not a landmark, so several blocks on one page do not fill the landmark list. Text
 * that fits is plain text with no Tab stop.
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
    textLabel = "Text to copy",
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
      {singleLine
        ? <OneLineText text={text} label={textLabel} />
        : (
          <code class={cn(TEXT_CLASS, "whitespace-pre-wrap wrap-anywhere")}>
            {text}
          </code>
        )}
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
