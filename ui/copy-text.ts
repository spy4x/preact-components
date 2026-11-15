import { copyToClipboard } from "@spy4x/platform/browser/clipboard"

/**
 * A clipboard port. It fails by throwing, by rejecting or by returning `false`; anything else,
 * `undefined` included, counts as a copy that worked.
 */
export type CopyPort = (text: string) => void | boolean | Promise<void | boolean>

/** Default milliseconds a confirmation stays visible. */
export const DEFAULT_COPIED_FOR_MS = 1500

/**
 * Copy `text` through `copy`, or the browser clipboard when there is none, and say whether it
 * worked. Never throws: a text function or a port that throws, or a port that rejects, is a failed
 * copy.
 *
 * Kept apart from `CopyButton`'s markup so that `enhanceCodeCopy`'s island carries only this.
 *
 * @param text What to copy, or a function that returns it now.
 * @param copy The caller's clipboard port, if any.
 * @returns `true` when the copy worked.
 */
export async function copyText(
  text: string | (() => string),
  copy?: CopyPort,
): Promise<boolean> {
  try {
    if (typeof text === "function") text = text()
    const result = await (copy ? copy(text) : copyToClipboard(text))
    return result !== false
  } catch {
    return false
  }
}
