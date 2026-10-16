import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/**
 * Moves focus to an element each time a new error arrives, so a failed submit lands on it.
 *
 * Attach the returned ref to the field the error is about, or to the message itself (give a
 * message `tabIndex={-1}` so it can take focus). Focus moves after the render in which `error`
 * changes to a truthy value: on mount when the component starts with one, and again for every
 * different error after that. An error equal to the last one (compared by `Object.is`: a message
 * by its text) moves nothing, so clear it while the next attempt runs if a repeat must take focus
 * again. A falsy `error` moves nothing, and nor does an element that is not rendered.
 *
 * @param error The last error, or a falsy value when there is none.
 * @returns The ref to attach to the element that takes focus.
 */
export function useFocusOnError<T extends HTMLElement>(error: unknown): RefObject<T> {
  const element = useRef<T>(null)
  useEffect(() => {
    if (error) element.current?.focus()
  }, [error])
  return element
}
