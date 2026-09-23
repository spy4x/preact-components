import type { JSX } from "preact"
import { Button } from "./button.tsx"
import { useEffect, useState } from "preact/hooks"

export interface CopyButtonProps {
  textToCopy: string
  /** Visible label. Without it the button renders icon-only. */
  title?: string
  /**
   * Injected clipboard port, e.g. the host app's `clipboard.copy`.
   *
   * Left out, the component uses `navigator.clipboard` and falls back to a hidden textarea plus
   * `execCommand("copy")` — `navigator.clipboard` is unavailable on insecure origins.
   */
  copy?: (text: string) => void | Promise<void>
  /** Tooltip and accessible name. Defaults to `"Copy"`. */
  copyLabel?: string
  /** Milliseconds the confirmation icon stays visible. Defaults to 1500. */
  copiedForMs?: number
  class?: string
}

/**
 * Copy a string to the clipboard through an injected port or the browser API.
 *
 * `document` and `navigator` are touched inside the click handler and the timer effect only, so
 * the server render is unaffected.
 */
export function CopyButton(
  {
    textToCopy,
    title,
    copy,
    copyLabel = "Copy",
    copiedForMs = 1500,
    class: className,
  }: CopyButtonProps,
): JSX.Element {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), copiedForMs)
    return () => clearTimeout(timer)
  }, [copied, copiedForMs])

  const handleCopy = () => {
    copyToClipboard(textToCopy, copy)
    setCopied(true)
  }

  return (
    <Button
      variant={title ? "outline" : "icon"}
      class={className}
      title={copyLabel}
      aria-label={title ? undefined : copyLabel}
      onClick={handleCopy}
    >
      {copied
        ? (
          <svg
            class="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        )
        : (
          <svg
            class="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      {title ?? null}
    </Button>
  )
}

/**
 * Write text to the clipboard.
 *
 * The injected port wins when present, so a host app can route copies through its own clipboard
 * service (and its own toast). Otherwise the browser API is used, falling back to
 * `document.execCommand("copy")` on an off-screen textarea for insecure origins.
 *
 * @param text Text to place on the clipboard.
 * @param copy Optional injected port.
 */
export function copyToClipboard(
  text: string,
  copy?: (text: string) => void | Promise<void>,
): void {
  if (copy) {
    void copy(text)
    return
  }
  void writeToClipboard(text)
}

/** Browser clipboard write, with the legacy path for insecure origins. */
async function writeToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Permission denied or insecure origin — fall through to the textarea path.
    }
  }
  legacyCopy(text)
}

/** `document.execCommand("copy")` on an off-screen textarea. */
function legacyCopy(text: string): void {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}
