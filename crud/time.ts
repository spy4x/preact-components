/**
 * The archive line's relative label, from `@spy4x/platform/universal/time` (#306).
 *
 * ts-libs 1.3.0's `timeAgo` switches from months to years at 12 thirty-day months (360 days) but
 * counts years in 365-day steps, so a row archived 360–364 days ago reads "0 years ago". The local
 * copy this replaced had already fixed that, and this wrapper keeps the fix until ts-libs ships it.
 */

import { timeAgo as platformTimeAgo } from "@spy4x/platform/universal/time"

/**
 * How long ago `value` was, in words: `"a moment ago"`, `"3 minutes ago"`, `"12 months ago"`.
 *
 * `null`, `undefined`, `""` and an unparsable value render `"-"`. Measured from the host clock.
 */
export function timeAgo(value: null | undefined | number | string | Date): string {
  const label = platformTimeAgo(value)
  // Only 360–364 days produce "0 years"; `floor(days / 30)` is exactly 12 for every one of them.
  return label === "0 years ago" ? "12 months ago" : label
}
