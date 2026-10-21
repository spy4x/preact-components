/** A number in the current period and the same number in the period before it. */
export interface PeriodChange {
  current: number
  previous: number
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
 */
export function changeText(change: PeriodChange, period: string, locale = "en-GB"): string {
  const delta = change.current - change.previous
  if (delta === 0) return `No change vs ${period}`
  const sign = delta > 0 ? "+" : "−"
  return `${sign}${new Intl.NumberFormat(locale).format(Math.abs(delta))} vs ${period}`
}
