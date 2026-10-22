// Not exported from the package: the listbox pieces `Combobox` and `TagInput` share, so both popups
// look and read the same without either component exporting its internals.
import { join } from "@spy4x/preact-cn/join"

/*
 * `min-h-11` makes every row a 44 px touch target, as tall as the library's other touch targets.
 * The classes are joined, not merged, so each state picks its own text, fill, weight and cursor
 * and no two utilities of one group reach a row: the highlighted row repaints the background, the
 * selected row repaints the text.
 */
const optionClasses = "flex min-h-11 items-center gap-2 px-3 py-2 text-sm"

/** Classes of the popup listbox itself, before the caller's own. */
export const listboxClasses =
  "absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-control bg-surface shadow-popover"

/** Which states one option row is drawn in. */
export interface ListboxOptionLook {
  /** The keyboard is on this row. */
  active: boolean
  /** The row is the picked value. */
  selected: boolean
  /** The row cannot be picked. */
  disabled: boolean
}

/**
 * Class list of one `role="option"` row.
 *
 * @param look The states the row is in.
 */
export function listboxOptionClass({ active, selected, disabled }: ListboxOptionLook): string {
  return join(
    optionClasses,
    selected
      ? active ? "bg-selected-soft-hover" : "bg-selected-soft"
      : active
      ? "bg-hover"
      : undefined,
    active ? "font-semibold" : selected ? "font-medium" : undefined,
    selected ? "text-selected" : "text-foreground",
    active ? undefined : selected ? "hover:bg-selected-soft-hover" : "hover:bg-hover",
    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
  )
}
