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

/**
 * The chosen half reads the selection tokens, not the accent, so an app can point them apart. Each
 * utility is important (`!`) because it replaces the `primary` button's own fill: `Button` appends a
 * `class` to its own classes instead of merging it into them.
 */
const selectedFill =
  "bg-selected! text-selected-foreground! hover:bg-selected-hover! dark:bg-selected! dark:hover:bg-selected-hover!"

/**
 * Segmented ON/OFF pair, optionally annotated with counts.
 *
 * The selected half is a `primary` button filled with the selection colour, the other an `outline`
 * one. The halves are squared off against each other.
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
