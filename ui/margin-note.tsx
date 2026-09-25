import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

export interface MarginNoteProps {
  /** The note's own text. */
  children: ComponentChildren
  /** A source the note points at. */
  sourceHref?: string
  /** Visible text for `sourceHref`. Defaults to `"Source"`. */
  sourceLabel?: string
  /** ISO 8601 date the note was last checked, rendered through a real `<time>`. */
  checkedOn?: string
  /** Prefix before `checkedOn`'s formatted text. Defaults to `"Checked"`. */
  checkedLabel?: string
  /** BCP 47 locale for `checkedOn`'s `Intl.DateTimeFormat`. Defaults to `"en"`. */
  locale?: string
  /** The landmark's accessible name (`aria-label`). Defaults to `"Note"`. */
  label?: string
  class?: string
}

/**
 * Format an ISO 8601 date (`"2026-09-25"`) as `Intl.DateTimeFormat` would read it aloud — `"25
 * September 2026"` in `en` — rather than echoing the machine-readable string back as the visible
 * text.
 *
 * `new Date("2026-09-25")` parses as UTC midnight, and formatting it in the caller's own local time
 * zone can read back a day early anywhere west of UTC — `timeZone: "UTC"` pins the reading to the
 * calendar date the ISO string actually names, not to whichever offset the browser happens to run
 * in.
 *
 * @param iso An ISO 8601 date, as `<time datetime>` expects it.
 * @param locale A BCP 47 locale.
 * @returns The formatted date, or `iso` unchanged if it does not parse.
 */
function formatCheckedOn(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/**
 * A short aside with an optional source link or a "checked on" date.
 *
 * A real `<aside>`, named `"Note"` by default through `aria-label` so it reads as a landmark
 * distinct from the surrounding prose — a caller with several notes on one page overrides `label`
 * to tell them apart. Column placement is CSS alone: a wide viewport floats the note into the right
 * margin (`float: right`, into whatever margin the caller's own layout leaves for it), a narrow one
 * renders it inline, in reading order, through the `sm:`-gated utilities below — no JavaScript
 * media-query listener, so the layout is correct before hydration.
 */
export function MarginNote(
  {
    children,
    sourceHref,
    sourceLabel = "Source",
    checkedOn,
    checkedLabel = "Checked",
    locale = "en",
    label = "Note",
    class: className,
  }: MarginNoteProps,
): JSX.Element {
  return (
    <aside
      aria-label={label}
      class={cn(
        "border-subtle text-muted block border-l-2 pl-3 text-sm sm:float-right sm:ml-6 sm:w-48 sm:border-l-0 sm:pl-0",
        className,
      )}
    >
      <p>{children}</p>
      {(sourceHref || checkedOn) && (
        <p class="mt-1 flex flex-wrap gap-x-2 text-xs">
          {sourceHref && (
            <a class="link" href={sourceHref}>
              {sourceLabel}
            </a>
          )}
          {checkedOn && (
            <span>
              {checkedLabel} <time dateTime={checkedOn}>{formatCheckedOn(checkedOn, locale)}</time>
            </span>
          )}
        </p>
      )}
    </aside>
  )
}
