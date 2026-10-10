/**
 * The wording behind `QuickAdd`'s badges, apart from the component so it can be tested without a
 * browser. Not an entry point of the package: an app imports `./quick-add.tsx` alone.
 *
 * @module
 */
import type { QuickAddResult } from "@spy4x/platform/universal/quick-add"
import { relativeDayLabel } from "@spy4x/time/locale"
import { isoDateInTz } from "@spy4x/time/tz"
import type { QuickAddDueLabel, QuickAddLabels } from "./quick-add.tsx"

/**
 * The default due-day wording: "Today", "Tomorrow" or "Yesterday" for a viewer in `zone`, and a
 * short day such as `Mon 5 Jan` otherwise.
 *
 * @param date The day, `YYYY-MM-DD`.
 * @param now The clock the line was read with.
 * @param zone The time zone the line was read in.
 */
export function quickAddDueLabel(date: string, now: Date, zone: string): string {
  return relativeDayLabel(date, isoDateInTz(now, zone))
}

/** What {@link quickAddParts} needs besides the parsed line. */
export interface QuickAddPartsOptions {
  /** The clock the line was read with; handed to `dueLabel`. */
  now: Date
  /** The time zone the line was read in; handed to `dueLabel`. */
  zone: string
  /** The words of each kind of badge. */
  labels: QuickAddLabels
  /** Words the due day. Defaults to {@link quickAddDueLabel}. */
  dueLabel?: QuickAddDueLabel
}

/**
 * The recognised parts of a line, as the words a badge and the screen reader share: tags, then
 * contexts, the due date, the priority.
 *
 * The day is worded from the date alone and the time is shown as typed, because that is what
 * `onAdd` receives: a time inside a daylight-saving gap must not show as the next hour.
 *
 * @param parsed What `parseQuickAdd` read.
 * @param options The clock, the zone and the wording.
 */
export function quickAddParts(parsed: QuickAddResult, options: QuickAddPartsOptions): string[] {
  const { labels } = options
  const parts = [...parsed.tags.map(labels.tag), ...parsed.contexts.map(labels.context)]
  if (parsed.due) {
    const day = (options.dueLabel ?? quickAddDueLabel)(parsed.due.date, options.now, options.zone)
    parts.push(labels.due(day, parsed.due.time))
  }
  if (parsed.priority !== undefined) parts.push(labels.priority(parsed.priority))
  return parts
}
