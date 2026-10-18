// Not exported from the package: where `CommandPalette` sends focus when it closes.

/** The parts of an element {@link focusOnClose} uses, so a test can pass a stand-in. */
export interface Focusable {
  focus(): void
  blur(): void
  getClientRects(): { length: number }
  readonly isConnected: boolean
}

/**
 * The element to give focus back to once the palette closes: the one that has it now, unless that
 * is the page's body, which means nothing had it.
 *
 * @param active `document.activeElement` as the palette opens.
 * @param body `document.body`.
 */
export function focusBefore<T>(active: T | null, body: T | null): T | null {
  return active === body ? null : active
}

/**
 * Where focus goes when the palette closes: the trigger while it is drawn; otherwise the element
 * that had focus before the palette opened, while it is still in the page. With neither, the field
 * gives focus up, so it is not left on a control inside the closed dialog.
 *
 * @param trigger The palette's own button.
 * @param before What {@link focusBefore} kept as the palette opened.
 * @param field The palette's search field.
 */
export function focusOnClose(
  trigger: Focusable | null,
  before: Focusable | null,
  field: Focusable | null,
): void {
  if (trigger && trigger.getClientRects().length > 0) return trigger.focus()
  if (before?.isConnected) return before.focus()
  field?.blur()
}
