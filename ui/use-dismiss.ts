import type { RefObject } from "preact"
import { useEffect, useRef } from "preact/hooks"

/**
 * Calls `onDismiss` when a press lands outside `root` while a popup is open.
 *
 * The document listener exists only while `open` is true, so a page of closed popups listens for
 * nothing. The press is a `mousedown`, which a touch also fires, so the popup closes as the press
 * starts, before the click lands on whatever was pressed. `onDismiss` may change on every render:
 * the latest one runs.
 *
 * @param root The popup's root: a press on it or inside it is not a dismissal.
 * @param open Whether the popup is open now.
 * @param onDismiss Closes the popup.
 */
export function useDismiss(
  root: RefObject<Element>,
  open: boolean,
  onDismiss: () => void,
): void {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  useEffect(() => {
    if (!open) return
    const handlePress = (event: MouseEvent) => {
      const element = root.current
      if (element && !element.contains(event.target as Node)) dismiss.current()
    }
    document.addEventListener("mousedown", handlePress)
    return () => document.removeEventListener("mousedown", handlePress)
  }, [open])
}
