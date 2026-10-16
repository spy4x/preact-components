import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/**
 * Moves focus to an element when a value, such as the step of a flow, differs from the one the
 * component mounted with.
 *
 * Use it to put focus on the next step's first control or heading after a step change.
 *
 * Focus moves after every render in which `value` changes to something other than the mounted
 * value, compared with `!==`, as Preact compares an effect's dependencies. Mounting moves nothing, so a page that opens on a later step
 * keeps focus where the browser put it, and neither does a change back to the mounted value. An
 * element that is not rendered takes nothing; give a heading or a message `tabIndex={-1}` so it
 * can take focus.
 *
 * @param value What decides the step: a step name, an index, a status.
 * @returns The ref to attach to the element that takes focus.
 */
export function useFocusOnChange<T extends HTMLElement>(value: unknown): RefObject<T> {
  const mounted = useRef(value)
  const element = useRef<T>(null)
  useEffect(() => {
    if (value !== mounted.current) element.current?.focus()
  }, [value])
  return element
}
