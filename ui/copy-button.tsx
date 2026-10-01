import type { JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import {
  CopyButtonBody,
  type CopyButtonProps,
  type CopyStatus,
  copyText,
  DEFAULT_COPIED_FOR_MS,
} from "./copy-button-body.tsx"

export type { CopyButtonProps }

/**
 * Copy a string to the clipboard through an injected port or the browser API, and say whether it
 * worked.
 *
 * The copy is awaited: a checkmark (and, with a `title`, `copiedLabel` in its place) follows a copy
 * that worked, a cross and `failedLabel` one that did not, and a polite live region announces
 * either. The confirmation clears after `copiedForMs`. Any other attribute, such as `data-*` for
 * analytics, is passed to the `<button>`.
 *
 * `document` and `navigator` are touched inside the click handler and the timer effect only, so
 * the server render is unaffected.
 */
export function CopyButton(
  { copy, copiedForMs = DEFAULT_COPIED_FOR_MS, ...props }: CopyButtonProps,
): JSX.Element {
  const [status, setStatus] = useState<CopyStatus>("idle")
  // Counts presses, so a slow copy that settles after a later press does not overwrite its status.
  const latest = useRef(0)

  useEffect(() => {
    if (status === "idle") return
    const timer = setTimeout(() => setStatus("idle"), copiedForMs)
    return () => clearTimeout(timer)
  }, [status, copiedForMs])

  const press = async () => {
    const id = ++latest.current
    // Back to rest first: a second copy then empties the live region and fills it again, so it is
    // announced again, and its confirmation gets a full window of its own.
    setStatus("idle")
    const worked = await copyText(props.textToCopy, copy)
    if (id === latest.current) setStatus(worked ? "copied" : "failed")
  }

  return <CopyButtonBody {...props} status={status} onPress={() => void press()} />
}
