import type { JSX } from "preact"
import { useEffect, useState } from "preact/hooks"
import { CopyBlockBody, type CopyBlockProps, DEFAULT_COPIED_FOR_MS } from "./copy-block-body.tsx"

export type { CopyBlockProps }

/**
 * A box of monospace text with a copy control beside it: an install command, an API key, an id.
 *
 * The text is never clipped. By default it wraps inside the box, breaking anywhere a line has to;
 * `singleLine` keeps it on one line and lets it scroll sideways inside its own box instead.
 *
 * The copy itself is `CopyButton`'s, port and icon swap included. What this adds is one
 * boolean of state, whether a copy has just happened, which fills a polite `role="status"` region:
 * `CopyButton` confirms a copy only by swapping its glyph, which reaches no screen reader. The
 * region is emptied again after `copiedForMs`, so a second copy announces a second time.
 */
export function CopyBlock(props: CopyBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copiedForMs = props.copiedForMs ?? DEFAULT_COPIED_FOR_MS

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), copiedForMs)
    return () => clearTimeout(timer)
  }, [copied, copiedForMs])

  return <CopyBlockBody {...props} copied={copied} onCopy={() => setCopied(true)} />
}
