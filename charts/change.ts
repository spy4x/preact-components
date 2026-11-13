import type { Translator } from "@spy4x/platform/universal/i18n"
import { ENGLISH, labelsFrom } from "@spy4x/preact-ui/i18n"

/** A number in the current period and the same number in the period before it. */
export interface PeriodChange {
  current: number
  previous: number
}

/** The sentence's English, each a key `changeText.<field>` of the catalog. */
const CHANGE_LABELS = {
  none: (period: string) => `No change vs ${period}`,
  delta: (change: string, period: string) => `${change} vs ${period}`,
}

/**
 * A change as one neutral line of text: `+3 vs previous 7 days`, `−1 vs yesterday`, or
 * `No change vs previous 7 days`.
 *
 * The difference is written out, never as a percentage, so a change from 1 to 4 reads as `+3`
 * rather than `+300%`. The minus is the typographic `−`, which a screen reader says as "minus".
 * `period` names the window compared with, as it reads after "vs".
 *
 * @param change The two values to compare.
 * @param period The earlier window, such as `"previous 30 days"` or `"yesterday"`.
 * @param locale Formats the difference with grouping. Defaults to `"en-GB"`.
 * @param translator Words the sentence in its language, from the catalog keys `changeText.none`
 * and `changeText.delta` (an app's `useT()`). Defaults to English.
 */
export function changeText(
  change: PeriodChange,
  period: string,
  locale = "en-GB",
  translator: Translator<string> = ENGLISH,
): string {
  const words = labelsFrom(translator, "changeText", CHANGE_LABELS, undefined, {
    none: ["period"],
    delta: ["change", "period"],
  })
  const delta = change.current - change.previous
  if (delta === 0) return words.none(period)
  const sign = delta > 0 ? "+" : "−"
  return words.delta(`${sign}${new Intl.NumberFormat(locale).format(Math.abs(delta))}`, period)
}
