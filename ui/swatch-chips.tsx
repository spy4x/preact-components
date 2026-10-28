import type { JSX } from "preact"
import { RadioChips, type RadioChipsProps } from "./radio-chips.tsx"

/** One colour of a {@link SwatchChips} group. */
export interface SwatchOption {
  /** The radio's submitted value. Unique within the group. */
  value: string
  /** The colour's name: the chip's visible text and its radio's accessible name. */
  name: string
  /** Any CSS colour, drawn as the swatch, such as `"#7a5230"`. */
  color: string
  /** None left in this colour. */
  disabled?: boolean
  /** The radio's `id`, for page CSS such as `:has(#color-brown:checked)`. */
  id?: string
  /** Extra attributes on the radio, as {@link RadioChips} takes them. */
  inputAttributes?: Record<string, string>
}

/** Props of {@link SwatchChips}: those of {@link RadioChips}, with colours for options. */
export interface SwatchChipsProps extends Omit<RadioChipsProps, "options"> {
  options: readonly SwatchOption[]
}

/**
 * A choice of colour drawn as chips with a swatch before each colour's name, on native radios, so
 * it works before, or without, any JavaScript.
 *
 * It is {@link RadioChips} with a swatch in each label: a `<fieldset>` named by its `<legend>`,
 * one tab stop, arrow keys, and the checked chip filled with the accent and marked with a check.
 * The name is always written out, so no choice rests on telling colours apart. The swatch has a
 * border, so white and near-black still show on both palettes, and on the checked chip's accent
 * fill a ring in the fill's label colour keeps it apart from the fill.
 *
 * @param props The colours and options, see {@link SwatchChipsProps}.
 */
export function SwatchChips({ options, ...props }: SwatchChipsProps): JSX.Element {
  return (
    <RadioChips
      {...props}
      options={options.map((option) => ({
        value: option.value,
        disabled: option.disabled,
        id: option.id,
        inputAttributes: option.inputAttributes,
        label: (
          <>
            <span
              aria-hidden="true"
              class="size-4 shrink-0 rounded-full border border-strong group-has-[:checked]/chip:ring-2 group-has-[:checked]/chip:ring-selected-foreground"
              style={{ backgroundColor: option.color }}
            />
            {option.name}
          </>
        ),
      }))}
    />
  )
}
