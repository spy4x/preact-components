/** What {@link listenToKeydown} needs of `document`: adding and removing a `keydown` listener. */
export interface KeydownTarget {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void
}

/**
 * Adds `listener` for `keydown` on `target` and returns what removes it again: an effect's cleanup,
 * so a hotkey hook stops listening once its component unmounts or turns its shortcuts off.
 *
 * @param target Where the presses arrive, `document` in a page.
 * @param listener The keydown listener.
 */
export function listenToKeydown(
  target: KeydownTarget,
  listener: (event: KeyboardEvent) => void,
): () => void {
  target.addEventListener("keydown", listener)
  return () => target.removeEventListener("keydown", listener)
}
