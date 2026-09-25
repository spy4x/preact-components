import { cn } from "@preact-components/cn"
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
  class?: string
}

/**
 * Format an ISO 8601 date (`"2026-09-25"`) as `Intl.DateTimeFormat` would read it aloud — `"25
 * September 2026"` in `en` — rather than echoing the machine-readable string back as the visible
 * text.
 *
 * @param iso An ISO 8601 date, as `<time datetime>` expects it.
 * @returns The formatted date, or `iso` unchanged if it does not parse.
 */
function formatCheckedOn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" })
    .format(date)
}

/**
 * A short aside with an optional source link or a "checked on" date.
 *
 * A real `<aside>`, named `"Note"` by default through `aria-label` so it reads as a landmark
 * distinct from the surrounding prose — a caller with several notes on one page overrides it to
 * tell them apart. Column placement is CSS alone: a wide viewport floats the note into the right
 * margin (`float: right` inside a page that reserves the gutter through `theme`'s own layout, or a
 * caller's own grid column), a narrow one renders it inline, in reading order, through the
 * `sm:`-gated utilities below — no JavaScript media-query listener, so the layout is correct before
 * hydration.
 */
export function MarginNote(
  {
    children,
    sourceHref,
    sourceLabel = "Source",
    checkedOn,
    checkedLabel = "Checked",
    class: className,
  }: MarginNoteProps,
): JSX.Element {
  return (
    <aside
      aria-label="Note"
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
              {checkedLabel} <time dateTime={checkedOn}>{formatCheckedOn(checkedOn)}</time>
            </span>
          )}
        </p>
      )}
    </aside>
  )
}
