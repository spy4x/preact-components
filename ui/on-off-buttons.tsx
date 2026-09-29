import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { Button } from "./button.tsx"

export interface OnOffButtonsProps {
  /** `undefined` renders both halves unselected. */
  value?: boolean
  /** Optional counts rendered under each label, e.g. active and archived totals. */
  amount?: { on: number; off: number }
  onSwitch: (on: boolean) => void
  /** Text of the ON half. Defaults to `"ON"`. */
  onLabel?: string
  /** Text of the OFF half. Defaults to `"OFF"`. */
  offLabel?: string
  class?: string
}

const group = "isolate inline-flex"

/** The chosen half reads the selection tokens, not the accent, so an app can point them apart. */
const selectedFill = "bg-selected text-selected-foreground dark:bg-selected"

/**
 * Segmented ON/OFF pair, optionally annotated with counts.
 *
 * The selected half is a `primary` button filled with the selection colour, the other an `outline`
 * one. Its hover still darkens the accent: the theme has no selected-hover token yet. The halves are squared off against each other.
 */
export function OnOffButtons(
  { value, amount, onSwitch, onLabel = "ON", offLabel = "OFF", class: className }:
    OnOffButtonsProps,
): JSX.Element {
  return (
    <div class={cn(group, className)}>
      <Button
        variant={value === true ? "primary" : "outline"}
        class={cn("flex-col rounded-r-none", value === true && selectedFill)}
        onClick={() => onSwitch(true)}
      >
        <span>{onLabel}</span>
        {amount && <span class="text-xs">{amount.on}</span>}
      </Button>
      <Button
        variant={value === false ? "primary" : "outline"}
        class={cn("-ml-px flex-col rounded-l-none", value === false && selectedFill)}
        onClick={() => onSwitch(false)}
      >
        <span>{offLabel}</span>
        {amount && <span class="text-xs">{amount.off}</span>}
      </Button>
    </div>
  )
}
