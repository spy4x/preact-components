import { useRef } from "preact/hooks"

/** The two handlers {@link useBackdropPress} hands a dialog. */
export interface BackdropPress {
  /** Goes on the dialog's `onPointerDown`: records whether the press began on the backdrop. */
  onPointerDown: (event: PointerEvent) => void
  /** Whether this click both began and ended on the backdrop. Read once per click, in `onClick`. */
  isBackdropClick: (event: MouseEvent) => boolean
}

/**
 * Tells a real backdrop click from a drag that only ended on the backdrop.
 *
 * A press inside a dialog released outside it, such as a text selection dragged past the panel's
 * edge, fires `click` on the `<dialog>` itself, which a target test alone counts as a backdrop
 * click. So the press is tested too: the same `onBackdrop` test runs on `pointerdown` and on
 * `click`, and only a click whose press passed it dismisses.
 *
 * Only a click the browser itself sent counts. A press that never becomes a click, such as a touch
 * the browser takes over for a scroll, leaves its record behind, and a script's `dialog.click()`
 * afterwards must not read it. A real click always follows a press of its own, which writes a fresh
 * record first.
 *
 * @param onBackdrop Whether one event's target and position are the backdrop.
 * @returns The dialog's `onPointerDown` handler and the click test.
 */
export function useBackdropPress(onBackdrop: (event: MouseEvent) => boolean): BackdropPress {
  const pressed = useRef(false)
  return {
    onPointerDown: (event) => {
      pressed.current = onBackdrop(event)
    },
    isBackdropClick: (event) => {
      const began = pressed.current
      pressed.current = false
      return began && event.isTrusted && onBackdrop(event)
    },
  }
}
