import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { DIALOG_ACTIONS } from "./plain-classes.ts"

export interface DialogActionsProps
  extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "ref"> {
  /** Utilities added after the row's own, for anything that is not its layout. */
  class?: string
  /** The buttons: Cancel first, the submit last. */
  children?: ComponentChildren
}

/**
 * A dialog's button row: stacked full width on a phone, right-aligned in one row from `sm`.
 *
 * Put it last inside the dialog's `<form>`, Cancel first and the submit last. Children render in
 * DOM order, so on a phone the submit sits at the bottom and Tab reaches it last. A lone button is
 * full width on a phone too. `Modal`'s `footer` already lays its buttons out this way.
 *
 * @param props See {@link DialogActionsProps}.
 */
export function DialogActions(
  { class: className, children, ...rest }: DialogActionsProps,
): JSX.Element {
  return <div {...rest} class={join(DIALOG_ACTIONS, className)}>{children}</div>
}
