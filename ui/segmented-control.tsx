import { cn } from "@spy4x/preact-cn"
import { IconCheck } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { nextTabIndex } from "./tabs.tsx"

/** One segment of a {@link SegmentedControl}. */
export interface SegmentedOption<V extends string = string> {
  /** What `onChange` carries. Unique within the control. */
  value: V
  /** The segment's text, and its accessible name. */
  label: ComponentChildren
}

/** Props of {@link SegmentedControl}. */
export interface SegmentedControlProps<V extends string = string> {
  options: readonly SegmentedOption<V>[]
  /** The chosen segment. A value no option has chooses none, and the first segment takes Tab. */
  value: V
  /** Called with the segment a click or an arrow key chose. */
  onChange: (value: V) => void
  /**
   * The group's name for a screen reader, such as `"Period"`. Required: a radio group without a
   * name says only "radio group".
   */
  ariaLabel: string
  /** Utilities on the group. */
  class?: string
}

const segment =
  "relative -ms-px first:ms-0 first:rounded-s-md last:rounded-e-md inline-flex items-center justify-center gap-1 min-h-11 sm:min-h-9 px-3 border border-control text-sm font-medium whitespace-nowrap cursor-pointer transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden"

const idle = "bg-surface text-foreground hover:bg-hover"

/** The chosen segment reads the selection tokens, as a pressed `OnOffButtons` half does. */
const chosen = "z-1 border-transparent bg-selected text-selected-foreground hover:bg-selected-hover"

/**
 * The key `nextTabIndex` reads for a key pressed in the group: Up and Down step as Left and Right
 * do, and Left and Right swap in a right-to-left page, where the first segment is on the right.
 */
function stepKey(key: string, rtl: boolean): string | undefined {
  if (key === "Home" || key === "End") return key
  if (key === "ArrowUp") return "ArrowLeft"
  if (key === "ArrowDown") return "ArrowRight"
  if (key === "ArrowLeft") return rtl ? "ArrowRight" : "ArrowLeft"
  if (key === "ArrowRight") return rtl ? "ArrowLeft" : "ArrowRight"
  return undefined
}

/**
 * A single choice among two to five short options, drawn as joined segments: a period picker
 * ("7 days, 30 days, 90 days"), a view switch.
 *
 * A `role="radiogroup"` of `role="radio"` buttons with one tab stop (roving `tabindex`): Tab lands on
 * the chosen segment, the arrow keys move to the next or previous one and choose it, wrapping
 * around both ends (Left and Right swap in a right-to-left page), and Home and End go to the first
 * and the last.
 * The chosen segment fills with the selection colour and shows a check, so the choice does not rest
 * on colour alone. Each segment is 44 px tall on a phone and 36 px from `sm`.
 *
 * Controlled: the caller owns `value` and changes it in `onChange`. Use `RadioChips` instead for a
 * choice that must work without JavaScript, and `Tabs` to switch panels.
 */
export function SegmentedControl<V extends string = string>(
  { options, value, onChange, ariaLabel, class: className }: SegmentedControlProps<V>,
): JSX.Element {
  const checked = options.findIndex((option) => option.value === value)
  const tabStop = Math.max(0, checked)

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>, index: number) => {
    const pressed = event.currentTarget
    const key = stepKey(event.key, getComputedStyle(pressed).direction === "rtl")
    if (key === undefined) return
    const next = nextTabIndex(key, index, options.length)
    if (next === undefined) return
    event.preventDefault()
    const target = pressed.parentElement?.children[next] as HTMLElement | undefined
    target?.focus()
    if (options[next].value !== value) onChange(options[next].value)
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} class={cn("isolate inline-flex", className)}>
      {options.map((option, index) => {
        const isChecked = index === checked
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isChecked ? "true" : "false"}
            tabindex={index === tabStop ? 0 : -1}
            class={cn(segment, isChecked ? chosen : idle)}
            onClick={() => {
              if (!isChecked) onChange(option.value)
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {isChecked && <IconCheck class="size-3.5" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
