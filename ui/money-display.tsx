import { cn } from "@spy4x/preact-cn"
import { formatMoney } from "@spy4x/platform/universal/money-core"
import type { JSX } from "preact"
import { useFormat } from "./format.tsx"

/**
 * How {@link MoneyDisplay} marks an amount's direction:
 *
 * - `"plain"`: the surrounding text colour, a minus sign on a negative amount only.
 * - `"negative"`: a negative amount in the danger colour.
 * - `"signed"`: income gets a `+` and the success colour, spending its minus sign and the danger
 *   colour, zero neither. The sign carries the meaning and the colour repeats it.
 */
export type MoneyTone = "plain" | "negative" | "signed"

export interface MoneyDisplayProps {
  /** Amount in `currency`'s smallest unit — `12345` is `€123.45` for `EUR`, `¥12,345` for `JPY`. */
  amount: number
  /** ISO 4217 code, e.g. `"EUR"`, `"JPY"`, `"KWD"`, or an app's own code such as `"BTC"`. */
  currency: string
  /**
   * BCP 47 locale for `Intl.NumberFormat`. Defaults to the region format of the nearest
   * `FormatContext` (`useFormat().locale`), so money matches the dates on the same screen.
   */
  locale?: string
  /**
   * How many decimals the smallest unit has: `8` for `BTC`. Defaults to the ISO 4217 table, which
   * a code it lacks cannot rely on.
   */
  decimals?: number
  /** How the amount's direction is marked; see {@link MoneyTone}. Defaults to `"plain"`. */
  tone?: MoneyTone
  /** @deprecated Use `tone="negative"`, which it stands for. */
  colorNegative?: boolean
  class?: string
}

/**
 * Renders an amount in `currency`'s smallest unit as display text, through `Intl.NumberFormat`,
 * in the person's region format: `<MoneyDisplay amount={123456} currency="EUR" />` is
 * `1.234,56 €` under a `FormatContext` for `de-DE` and `€1,234.56` for `en-US`, whatever language
 * the words around it are in. `currency="JPY"` has no decimals, `currency="KWD"` three, and
 * `decimals={8}` gives a coin its own.
 *
 * A bare `<span>` with tabular figures, so a column of amounts lines up: this is text, not a
 * control, so it carries no role or label of its own. `tone` is the only styling decision it makes
 * for the caller; size, weight and alignment are `class`. The tone colours are the status tokens,
 * which reach 4.5:1 on the canvas and the surface in every theme; a caller that puts a toned amount
 * on a tinted background (a selected row, a `*-soft` fill) checks the contrast there.
 */
export function MoneyDisplay(
  {
    amount,
    currency,
    locale,
    decimals,
    tone: toneProp,
    colorNegative = false,
    class: className,
  }: MoneyDisplayProps,
): JSX.Element {
  const region = useFormat().locale
  const tone = toneProp ?? (colorNegative ? "negative" : "plain")
  const text = formatMoney(amount, currency, locale ?? region, {
    decimals,
    signDisplay: tone === "signed" ? "exceptZero" : "auto",
  })
  return <span class={cn("tabular-nums", toneClass(tone, amount), className)}>{text}</span>
}

/** The colour class `tone` gives `amount`, or nothing for the surrounding colour. */
function toneClass(tone: MoneyTone, amount: number): string | undefined {
  if (tone === "plain" || amount === 0) return undefined
  if (amount < 0) return "text-danger"
  return tone === "signed" ? "text-success" : undefined
}
