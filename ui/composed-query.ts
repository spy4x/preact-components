import { useSignal } from "@preact/signals"
import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/**
 * Hold a filter still while an input method composes, and let it catch up once, when the word is
 * finished.
 *
 * A Korean, Japanese or Chinese input method fires an `input` event for every step of a character
 * it is still building, so a list filtered on each one would empty and refill mid-syllable: "한국"
 * passes through "한구", which matches nothing. The field keeps showing every step — the caller still
 * writes the text it is given, so a render cannot put the old text back under the input method —
 * but the list is filtered by the text this returns, which stays at the field's text from before
 * the composition until it ends. The caller's `input` handler skips its filtering work while
 * {@link isComposingInput} holds, and `onComposed` does that work once with the finished text.
 *
 * The composition events are listened for on the field itself rather than through JSX props:
 * Preact names a listener after its prop, and `onCompositionStart` would listen for an event called
 * `CompositionStart`, which never fires, because no element has an `oncompositionstart` property
 * from which Preact could learn the lower-case name.
 *
 * @param field The text field.
 * @param text The field's text as the caller holds it.
 * @param onComposed What the caller's `input` handler does for a plain keystroke.
 * @returns The text to filter by.
 */
export function useComposedQuery(
  field: RefObject<HTMLInputElement>,
  text: string,
  onComposed: (text: string) => void,
): string {
  const held = useSignal<string | null>(null)
  const latest = useRef({ text, onComposed })
  latest.current = { text, onComposed }
  useEffect(() => {
    const input = field.current
    if (!input) return
    const start = () => {
      held.value = latest.current.text
    }
    const end = () => {
      held.value = null
      latest.current.onComposed(input.value)
    }
    input.addEventListener("compositionstart", start)
    input.addEventListener("compositionend", end)
    return () => {
      input.removeEventListener("compositionstart", start)
      input.removeEventListener("compositionend", end)
    }
  }, [])
  return held.value ?? text
}

/**
 * Whether an `input` event is a step of a word an input method is still composing.
 *
 * @param event The `input` event.
 */
export function isComposingInput(event: Event): boolean {
  return (event as InputEvent).isComposing === true
}
