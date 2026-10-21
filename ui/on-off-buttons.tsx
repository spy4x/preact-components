import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { Button } from "./button.tsx"

/** Props every {@link OnOffButtons} takes, whichever name its value port goes by. */
interface OnOffButtonsBaseProps {
  /** `undefined` renders both halves unselected. */
  value?: boolean
  /** Optional counts rendered under each label, e.g. active and archived totals. */
  amount?: { on: number; off: number }
  /** Text of the ON half. Defaults to `"ON"`. */
  onLabel?: string
  /** Text of the OFF half. Defaults to `"OFF"`. */
  offLabel?: string
  /**
   * Accessible name of the pair, which a screen reader says before the halves. Defaults to the two
   * labels joined, `"ON / OFF"`; pass what the pair switches, such as `"Show archived"`.
   */
  ariaLabel?: string
  /**
   * Accessible name of the pair; `ariaLabel` wins when both are given.
   *
   * @deprecated Use `ariaLabel`. Removed in the next major.
   */
  label?: string
  class?: string
}

/** Props of {@link OnOffButtons}: the base props plus one value port. */
export type OnOffButtonsProps =
  & OnOffButtonsBaseProps
  & (
    | {
      /** Called with `true` for the ON half, `false` for the OFF half. */
      onChange: (on: boolean) => void
      onSwitch?: undefined
    }
    | {
      /**
       * Called with `true` for the ON half, `false` for the OFF half.
       *
       * @deprecated Use `onChange`, which takes the same boolean. Removed in the next major.
       */
      onSwitch: (on: boolean) => void
      onChange?: undefined
    }
  )

const group = "isolate inline-flex"

/**
 * The chosen half reads the selection tokens, not the accent, so an app can point them apart. Each
 * utility is important (`!`) so it outranks the `primary` button's own fill whatever order the two
 * land in.
 */
const selectedFill =
  "bg-selected! text-selected-foreground! hover:bg-selected-hover! dark:bg-selected! dark:hover:bg-selected-hover!"

/**
 * Segmented ON/OFF pair, optionally annotated with counts.
 *
 * The selected half is a `primary` button filled with the selection colour, the other an `outline`
 * one. The halves are squared off against each other.
 *
 * The colour is not the only sign of the choice: each half carries `aria-pressed`, and the pair is
 * a `role="group"` named by `ariaLabel`. With `value` undefined both halves read "not pressed".
 */
export function OnOffButtons(
  {
    value,
    amount,
    onChange,
    onSwitch,
    onLabel = "ON",
    offLabel = "OFF",
    ariaLabel,
    label,
    class: className,
  }: OnOffButtonsProps,
): JSX.Element {
  // The type allows exactly one of the two; `onChange` is the name, `onSwitch` the old alias.
  const report = (onChange ?? onSwitch) as (on: boolean) => void
  const name = ariaLabel ?? label ?? `${onLabel} / ${offLabel}`
  return (
    <div role="group" aria-label={name} class={cn(group, className)}>
      <Button
        aria-pressed={value === true ? "true" : "false"}
        variant={value === true ? "primary" : "outline"}
        class={cn("flex-col rounded-r-none", value === true && selectedFill)}
        onClick={() => report(true)}
      >
        <span>{onLabel}</span>
        {amount && <span class="text-xs">{amount.on}</span>}
      </Button>
      <Button
        aria-pressed={value === false ? "true" : "false"}
        variant={value === false ? "primary" : "outline"}
        class={cn("-ml-px flex-col rounded-l-none", value === false && selectedFill)}
        onClick={() => report(false)}
      >
        <span>{offLabel}</span>
        {amount && <span class="text-xs">{amount.off}</span>}
      </Button>
    </div>
  )
}
