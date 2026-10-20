// Not exported from the package: the listbox pieces `Combobox` and `TagInput` share, so both popups
// look and read the same without either component exporting its internals.
import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { IconXMark } from "@spy4x/preact-icons"

/*
 * `min-h-11` makes every row a 44 px touch target, as tall as the library's other touch targets.
 * Base classes first. `cn` resolves conflicts last-wins, so a state class has to come after the
 * base to win: the highlighted row repaints the background, the selected row repaints the text.
 */
const optionClasses =
  "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-hover"
const activeOptionClasses = "bg-hover font-semibold"
const selectedOptionClasses =
  "bg-selected-soft font-medium text-selected hover:bg-selected-soft-hover"
const activeSelectedOptionClasses = "bg-selected-soft-hover font-semibold"
const disabledOptionClasses = "cursor-not-allowed opacity-50"

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
  return cn(
    optionClasses,
    active && activeOptionClasses,
    selected && selectedOptionClasses,
    active && selected && activeSelectedOptionClasses,
    disabled && disabledOptionClasses,
  )
}

/**
 * The cross of a clear or remove button: `IconXMark` at the listbox's glyph size, hidden from
 * screen readers because the button around it carries the name.
 */
export function CrossGlyph(): JSX.Element {
  return <IconXMark class="size-4" />
}
