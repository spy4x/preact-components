import { cn } from "@preact-components/cn"
import { formatMoney } from "@spy4x/platform/universal/money"
import type { JSX } from "preact"

export interface MoneyDisplayProps {
  /** Amount in `currency`'s smallest unit — `12345` is `€123.45` for `EUR`, `¥12,345` for `JPY`. */
  amount: number
  /** ISO 4217 code, e.g. `"EUR"`, `"JPY"`, `"KWD"`. */
  currency: string
  /** BCP 47 locale for `Intl.NumberFormat`. Defaults to `"en"`. */
  locale?: string
  /** Colours a negative amount red instead of the surrounding text colour. Defaults to `false`. */
  colorNegative?: boolean
  class?: string
}

const negativeClass = "text-red-600 dark:text-red-400"

/**
 * Renders an amount in `currency`'s smallest unit as display text, through
 * `Intl.NumberFormat` — `<MoneyDisplay amount={12345} currency="EUR" />` is `€123.45`,
 * `currency="JPY"` is `¥12,345`, `currency="KWD"` is three decimals.
 *
 * A bare `<span>`: this is text, not a control, so it carries no role or label of its own — a
 * caller who needs one (a table cell header, a form summary) supplies it the way it would for any
 * other text.
 *
 * `colorNegative` is the only styling decision this component makes for the caller; everything
 * else — size, weight, alignment — is `class`, the same as every other primitive here.
 */
export function MoneyDisplay(
  { amount, currency, locale = "en", colorNegative = false, class: className }: MoneyDisplayProps,
): JSX.Element {
  const text = formatMoney(amount, currency, locale)
  return <span class={cn(colorNegative && amount < 0 && negativeClass, className)}>{text}</span>
}
