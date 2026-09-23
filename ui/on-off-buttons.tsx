import { cn } from "@preact-components/cn"
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
 * Segmented ON/OFF pair, optionally annotated with counts.
 *
 * The selected half is a `primary` button, the other an `outline` one, so selection needs no
 * conditional utility strings. The halves are squared off against each other.
 */
export function OnOffButtons(
  { value, amount, onSwitch, onLabel = "ON", offLabel = "OFF", class: className }:
    OnOffButtonsProps,
): JSX.Element {
  return (
    <div class={cn(group, className)}>
      <Button
        variant={value === true ? "primary" : "outline"}
        class="flex-col rounded-r-none"
        onClick={() => onSwitch(true)}
      >
        <span>{onLabel}</span>
        {amount && <span class="text-xs">{amount.on}</span>}
      </Button>
      <Button
        variant={value === false ? "primary" : "outline"}
        class="-ml-px flex-col rounded-l-none"
        onClick={() => onSwitch(false)}
      >
        <span>{offLabel}</span>
        {amount && <span class="text-xs">{amount.off}</span>}
      </Button>
    </div>
  )
}
