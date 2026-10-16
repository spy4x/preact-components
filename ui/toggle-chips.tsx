import { cn } from "@spy4x/preact-cn"
import { IconCheck } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { badgeClasses, type BadgeColor } from "./badge.tsx"

/** One chip of a {@link ToggleChips} group. */
export interface ToggleChipOption {
  /** What `value` and `onChange` carry for this chip. Unique within the group. */
  value: string
  /** The chip's visible text, and its accessible name. */
  label: string
  disabled?: boolean
}

interface ToggleChipsBase {
  options: ToggleChipOption[]
  /** Accessible name of the group. Defaults to `"Filters"`. */
  label?: string
  /** Colour of a pressed chip, from `Badge`'s palette. Defaults to `"purple"`, the accent. */
  color?: BadgeColor
  class?: string
}

/** Any number of chips pressed at once: `value` lists them, in the order of `options`. */
export interface ToggleChipsMultipleProps extends ToggleChipsBase {
  /** Defaults to `"multiple"`. */
  mode?: "multiple"
  value: string[]
  onChange: (value: string[]) => void
}

/** At most one chip pressed: pressing another moves it, pressing the pressed one clears it. */
export interface ToggleChipsSingleProps extends ToggleChipsBase {
  mode: "single"
  value: string | null
  onChange: (value: string | null) => void
}

/** Props of {@link ToggleChips}: one shape per `mode`. */
export type ToggleChipsProps = ToggleChipsMultipleProps | ToggleChipsSingleProps

/**
 * The selection after one chip is pressed, in multiple mode: the chip is added or removed, and the
 * result keeps the order of `options` rather than the order of presses.
 *
 * @param options Every chip of the group.
 * @param selected The chips pressed before.
 * @param pressed The chip just pressed.
 * @returns The new selection.
 */
export function toggleChipSelection(
  options: readonly ToggleChipOption[],
  selected: readonly string[],
  pressed: string,
): string[] {
  const next = new Set(selected)
  if (next.has(pressed)) next.delete(pressed)
  else next.add(pressed)
  return options.map((option) => option.value).filter((value) => next.has(value))
}

/**
 * Every chip: a 44 px touch target on a phone, the badge's own height from `sm` up, with room for
 * the pressed chip's check.
 */
const chip =
  "normal-case gap-1 min-h-11 sm:min-h-8 px-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"

/**
 * The unpressed chip: the surface with full-strength text and a quiet border, so it reads as a
 * live control rather than a disabled one. Its text is the foreground token on the surface token,
 * and on the hover token under the pointer, in both palettes.
 */
const unpressed = "bg-surface text-foreground border-subtle hover:bg-hover"

/**
 * A group of pressable chips for filtering a list — the clickable counterpart of `Badge`, which
 * only shows text.
 *
 * Each chip is a real `button` with `aria-pressed`, so Space and Enter press it and a screen
 * reader says "pressed" or "not pressed". A pressed chip is a filled badge in `color` with a check
 * before its text, so being pressed does not rest on colour alone; an unpressed one is a plain
 * chip on the surface, in the full text colour. Every chip is 44 px tall on a phone. The group is a `role="group"` named by `label`.
 *
 * Controlled: the chips show `value` and report every press through `onChange`. `mode="single"`
 * holds at most one chip; the default, `"multiple"`, holds any number. A chip's text keeps the
 * caller's case, unlike `Badge`, because a tag's case is part of its name.
 */
export function ToggleChips(props: ToggleChipsProps): JSX.Element {
  const { options, label = "Filters", color = "purple", class: className } = props
  const isPressed = (value: string): boolean =>
    props.mode === "single" ? props.value === value : props.value.includes(value)

  function press(value: string): void {
    if (props.mode === "single") props.onChange(props.value === value ? null : value)
    else props.onChange(toggleChipSelection(options, props.value, value))
  }

  return (
    <div role="group" aria-label={label} class={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const pressed = isPressed(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed ? "true" : "false"}
            disabled={option.disabled}
            class={badgeClasses(
              pressed ? color : "gray",
              pressed ? "filled" : "outline",
              cn(chip, !pressed && unpressed),
            )}
            onClick={() => press(option.value)}
          >
            {pressed ? <IconCheck class="size-3.5" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
