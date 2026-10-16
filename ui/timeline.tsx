import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

/** The colour of an entry's dot. */
export type TimelineTone = "neutral" | "accent" | "success" | "warning" | "danger"

/** One thing that happened. */
export interface TimelineItem {
  /** Stable key for the entry. */
  id: string | number
  /** What happened, in a few words. */
  title: ComponentChildren
  /** When it happened, as an ISO 8601 instant; it becomes the `<time>`'s `dateTime`. */
  at: string
  /**
   * What the time reads, such as "3 days ago". Defaults to `at` as a medium date and a short time
   * in `timeZone`.
   */
  when?: ComponentChildren
  /** A second line: who, from where, what changed. */
  description?: ComponentChildren
  /** The dot's colour. Defaults to `"neutral"`. */
  tone?: TimelineTone
  dataE2E?: string
}

export interface TimelineProps {
  /** The entries in the order to show them, usually newest first. */
  items: readonly TimelineItem[]
  /** The list's accessible name. Defaults to `"Timeline"`. */
  label?: string
  /** What shows in place of an empty list. Defaults to `"Nothing yet."`. */
  empty?: ComponentChildren
  /**
   * The zone a default `when` is printed in. Defaults to `"UTC"`, so a page rendered on the server
   * reads the same in the browser.
   */
  timeZone?: string
  class?: string
  dataE2E?: string
}

/** Each tone's dot, read through the shared colour tokens. */
const DOTS: Record<TimelineTone, string> = {
  neutral: "bg-track",
  accent: "bg-selected",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
}

/** `at` as a medium date and a short time in `timeZone`, or `at` itself when it is no date. */
export function timelineTime(at: string, timeZone = "UTC"): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return at
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone })
    .format(date)
}

/**
 * A vertical list of events: a dot per entry on a line that joins them, the title and its time on
 * the first line, and an optional description under them. For an audit trail, an order's history
 * or a person's activity.
 *
 * An ordered list (`<ol>`) with an accessible name, so a screen reader announces how many entries
 * there are. The dots and the line are decoration, hidden from assistive tech: the tone never
 * carries meaning alone, so a caller that needs a state names it in the title. The time is a
 * `<time>` with the exact instant in `dateTime`. An empty list renders `empty` instead, so the
 * caller does not draw a bare frame.
 */
export function Timeline(
  {
    items,
    label = "Timeline",
    empty = "Nothing yet.",
    timeZone = "UTC",
    class: className,
    dataE2E,
  }: TimelineProps,
): JSX.Element {
  if (items.length === 0) {
    return <p class={cn("text-sm text-muted", className)} data-e2e={dataE2E}>{empty}</p>
  }
  return (
    <ol aria-label={label} class={cn("flex flex-col", className)} data-e2e={dataE2E}>
      {items.map((item, index) => (
        <li key={item.id} class="relative flex gap-3 pb-6 last:pb-0" data-e2e={item.dataE2E}>
          {index < items.length - 1 && (
            <span
              aria-hidden="true"
              data-timeline-line=""
              class="absolute top-4 bottom-0 left-1.5 w-px -translate-x-1/2 bg-track"
            />
          )}
          <span
            aria-hidden="true"
            data-timeline-dot={item.tone ?? "neutral"}
            class={cn(
              "relative mt-1 size-3 shrink-0 rounded-full ring-4 ring-surface",
              DOTS[item.tone ?? "neutral"],
            )}
          />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium">{item.title}</span>
              <time class="text-xs text-muted" dateTime={item.at}>
                {item.when ?? timelineTime(item.at, timeZone)}
              </time>
            </div>
            {item.description && (
              <div class="text-sm text-muted wrap-anywhere">{item.description}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
