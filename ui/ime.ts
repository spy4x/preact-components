/**
 * Whether an input method has taken this key press: it confirms or cancels a word the reader is
 * still composing, so a component must not act on it.
 *
 * Safari sends the Enter that ends a composition with `isComposing` false and `keyCode` 229, the
 * code every browser gives a key press an input method has taken, so both are read.
 *
 * @param event The key press, or anything shaped like one.
 */
export function isImeKeyPress(event: Pick<KeyboardEvent, "isComposing" | "keyCode">): boolean {
  return event.isComposing || event.keyCode === 229
}
