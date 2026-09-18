/**
 * `@preact-components/signals/clipboard` — copy text, report through a callback.
 *
 * The source store imported the app's toast singleton to say "copied". Here the feedback is a port
 * the caller supplies, so the same helper works in an app with toasts, one with a tooltip, and a
 * test with nothing at all.
 */

/** Write port. `navigator.clipboard` satisfies it. */
export interface ClipboardPort {
  writeText(text: string): Promise<void>
}

/** What to do about the outcome. Both optional; omitting one keeps that case silent. */
export interface CopyFeedback {
  onSuccess?: (text: string) => void
  onError?: (error: unknown) => void
}

/** A clipboard helper. */
export interface ClipboardStore {
  /** Copy `text`. Resolves `true` on success; never throws. */
  copy(text: string, feedback?: CopyFeedback): Promise<boolean>
}

/** Reason reported when the runtime has no clipboard at all (an insecure origin, a server render). */
export const CLIPBOARD_UNAVAILABLE = "Clipboard API is unavailable"

/**
 * Create a clipboard helper.
 *
 * @param options.clipboard Write port. Defaults to `navigator.clipboard` when it exists; pass
 * `null` to disable copying outright.
 */
export function createClipboard(
  options: { clipboard?: ClipboardPort | null } = {},
): ClipboardStore {
  const port = options.clipboard === undefined ? defaultClipboard() : options.clipboard

  return {
    async copy(text: string, feedback: CopyFeedback = {}): Promise<boolean> {
      if (!port) {
        feedback.onError?.(new Error(CLIPBOARD_UNAVAILABLE))
        return false
      }
      try {
        await port.writeText(text)
        feedback.onSuccess?.(text)
        return true
      } catch (error) {
        feedback.onError?.(error)
        return false
      }
    },
  }
}

/** `navigator.clipboard` when this runtime exposes one. */
function defaultClipboard(): ClipboardPort | null {
  return globalThis.navigator?.clipboard ?? null
}
