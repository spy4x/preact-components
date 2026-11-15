/**
 * The page half of a honeypot form field. The server half — the default field name
 * `HONEYPOT_FIELD_NAME` and the check `honeypotFilled` — lives in spy4x/ts-libs, in
 * `@spy4x/platform/universal/honeypot`, so a handler that receives a no-JavaScript post can run it.
 *
 * @module
 */

import { HONEYPOT_FIELD_NAME } from "@spy4x/platform/universal/honeypot"
import type { JSX } from "preact"

/**
 * A field simple bots fill in and people never see: off-screen rather than `display: none` or
 * `type="hidden"`, since a scraper that already skips those two is exactly the bot this stops
 * nothing against, and a sighted visitor tabbing past it never lands on it — `tabindex="-1"` keeps
 * it out of the tab order on top of being off-screen, and `aria-hidden` keeps a screen reader from
 * ever announcing it.
 *
 * @param name Field name a submit handler reads back with `honeypotFilled` from
 * `@spy4x/platform/universal/honeypot`. Defaults to its `HONEYPOT_FIELD_NAME`, the name
 * `honeypotFilled` reads by default.
 * @param label Defaults to `"Leave this field blank"`; a translated page passes
 * `useT().t("Honeypot.label")`, since this is a function, not a component that reads the context. Off-screen text for the one assistive technology that does not honour
 * `aria-hidden` on a field it is autofilling — kept short and plain rather than skipped, because
 * "why is there a field with no label" is a worse trap than one extra sentence nobody sees.
 */
export function honeypotField(
  name: string = HONEYPOT_FIELD_NAME,
  label: string = "Leave this field blank",
): JSX.Element {
  return (
    <div class="absolute h-px w-px overflow-hidden" style="clip: rect(0 0 0 0)" aria-hidden="true">
      <label>
        {label}
        <input type="text" name={name} tabIndex={-1} autocomplete="off" />
      </label>
    </div>
  )
}
