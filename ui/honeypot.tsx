import type { JSX } from "preact"

/**
 * Default `name` of the honeypot field {@link honeypotField} renders and {@link honeypotFilled}
 * reads back.
 *
 * Exported because a server checking the no-JavaScript path — the one path a client-side check can
 * never run on, since there is no client-side code left to run it — has to read the same field a
 * plain HTML form posted it under.
 */
export const HONEYPOT_FIELD_NAME = "company-website"

/**
 * A field simple bots fill in and people never see: off-screen rather than `display: none` or
 * `type="hidden"`, since a scraper that already skips those two is exactly the bot this stops
 * nothing against, and a sighted visitor tabbing past it never lands on it — `tabindex="-1"` keeps
 * it out of the tab order on top of being off-screen, and `aria-hidden` keeps a screen reader from
 * ever announcing it.
 *
 * @param name Field name a submit handler reads back with {@link honeypotFilled}.
 * @param label Off-screen text for the one assistive technology that does not honour
 * `aria-hidden` on a field it is autofilling — kept short and plain rather than skipped, because
 * "why is there a field with no label" is a worse trap than one extra sentence nobody sees.
 */
export function honeypotField(name: string, label: string): JSX.Element {
  return (
    <div class="absolute h-px w-px overflow-hidden" style="clip: rect(0 0 0 0)" aria-hidden="true">
      <label>
        {label}
        <input type="text" name={name} tabIndex={-1} autocomplete="off" />
      </label>
    </div>
  )
}

/**
 * Whether a submitted honeypot field carries a value — a person never types into a field they
 * cannot see, so any value here means whatever posted the form was not one.
 *
 * @param data The submitted form data.
 * @param name Field name, matching what {@link honeypotField} rendered. Defaults to
 * {@link HONEYPOT_FIELD_NAME}.
 */
export function honeypotFilled(data: FormData, name: string = HONEYPOT_FIELD_NAME): boolean {
  return String(data.get(name) ?? "").length > 0
}
