/**
 * `SavedCopyNotice` — the banner above a list that says "you are looking at the copy saved on this
 * device at this time", for an app that shows saved data while the server is out of reach.
 *
 * It is a separate component from `SyncStatus`, which is about the other direction: `SyncStatus`
 * says whether this person's changes reached the server, once for the whole app, and this says how
 * old one list is. Both can be true at the same moment.
 */

import { cn } from "@spy4x/preact-cn"
import { IconAlertTriangle } from "@spy4x/preact-icons"
import { formatTime as formatClockTime } from "@spy4x/platform/universal/time"
import type { JSX } from "preact"
import { useMemo } from "preact/hooks"

/** Every word {@link SavedCopyNotice} shows. */
export interface SavedCopyNoticeLabels {
  /** The first line, in a heavier weight. Defaults to `"Saved copy"`; an empty string drops it. */
  title: string
  /**
   * The sentence under the title, given the time of the copy as the notice words it. Defaults to
   * `"The server is out of reach. This copy was saved on this device: 12/10/2026 14:05."`.
   */
  body: (time: string) => string
}

/** The English words {@link SavedCopyNotice} shows when the caller passes none. */
export const DEFAULT_SAVED_COPY_NOTICE_LABELS: SavedCopyNoticeLabels = {
  title: "Saved copy",
  body: (time) => `The server is out of reach. This copy was saved on this device: ${time}.`,
}

export interface SavedCopyNoticeProps {
  /**
   * When the copy on screen was saved: a `Date` or epoch milliseconds. `null`, `undefined` and an
   * invalid date mean the list is fresh, and the notice shows nothing.
   */
  savedAt: Date | number | null | undefined
  /**
   * Words the time of the copy. Defaults to the date and the clock time in the host's time zone,
   * `"12/10/2026 14:05"`. It is called once for each copy, not on every render, so return words
   * that stay true while the copy is on screen: a clock time, not "5 minutes ago".
   */
  formatTime?: (savedAt: Date) => string
  /** Words to replace, each with an English default. */
  labels?: Partial<SavedCopyNoticeLabels>
  /** Utilities for the banner. They apply only while it shows. */
  class?: string
}

/** The time of the copy in epoch milliseconds, or `null` when there is no copy to speak of. */
function copyTime(savedAt: SavedCopyNoticeProps["savedAt"]): number | null {
  if (savedAt === null || savedAt === undefined) return null
  const time = typeof savedAt === "number" ? savedAt : savedAt.getTime()
  return Number.isFinite(time) ? time : null
}

/** The date and the clock time, never "Today": the words stay on screen past midnight. */
function clockTime(savedAt: Date): string {
  return formatClockTime(savedAt, { full: true })
}

/**
 * Says that the list under it is a copy saved on this device, and when it was saved.
 *
 * Render it always and pass `savedAt` only while a saved copy is on screen. The element is a
 * `role="status"` region that is in the page from the first render, empty and taking no room, so a
 * screen reader announces the notice when the copy arrives, without focus moving. It is announced
 * once for each copy: the time is worded when `savedAt` changes and kept as it is until the next
 * change, so a re-render never changes the text, even with a `formatTime` whose answer depends on
 * the current time. A notice that mounts together with its text is often not announced at all.
 *
 * `data-saved-at` on the element holds the time of the copy as an ISO string.
 */
export function SavedCopyNotice(
  { savedAt, formatTime = clockTime, labels, class: className }: SavedCopyNoticeProps,
): JSX.Element {
  const words = { ...DEFAULT_SAVED_COPY_NOTICE_LABELS, ...labels }
  const time = copyTime(savedAt)
  // Worded once for each copy: text that changed between two renders would be announced again.
  const worded = useMemo(() => time === null ? "" : formatTime(new Date(time)), [time])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-saved-at={time === null ? undefined : new Date(time).toISOString()}
      class={time === null ? "sr-only" : cn(
        "flex flex-wrap items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm text-foreground",
        className,
      )}
    >
      {time === null ? null : (
        <>
          <IconAlertTriangle class="size-5 text-warning" />
          <div class="min-w-0 flex-1">
            {words.title && <p class="font-medium">{words.title}</p>}
            <p class={words.title ? "mt-1" : undefined}>{words.body(worded)}</p>
          </div>
        </>
      )}
    </div>
  )
}
