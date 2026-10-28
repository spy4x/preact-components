/**
 * A value inside a translated sentence, kept in its own direction (#876): a Latin file name in an
 * Arabic message, or an Arabic one in an English message, stays whole and in its own order, and
 * its punctuation does not jump to the other end of the sentence.
 */

import type { JSX } from "preact"

/** The marker a message is filled with, to find where the value goes. */
const VALUE_SLOT = "\u0001"

/**
 * `message` filled with `value`, the value drawn in a `<bdi>`. The message is filled with a marker
 * and the value drawn where the marker landed; a message that drops or changes the marker is drawn
 * as it is, filled with the plain value.
 *
 * @param props.message The sentence, as a label function of the value.
 * @param props.value The value, such as a name the user gave.
 */
export function Isolated(
  { message, value }: { message: (value: string) => string; value: string },
): JSX.Element {
  const parts = message(VALUE_SLOT).split(VALUE_SLOT)
  if (parts.length !== 2) return <>{message(value)}</>
  return (
    <>
      {parts[0]}
      <bdi>{value}</bdi>
      {parts[1]}
    </>
  )
}

/**
 * `value` between Unicode's first-strong isolate and its closing mark: what `<bdi>` does, for text
 * that cannot hold markup, such as a message kept in state or an `aria-label`.
 *
 * @param value The value to keep in its own direction.
 */
export function isolate(value: string): string {
  return `⁨${value}⁩`
}
