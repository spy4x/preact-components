/**
 * Timestamp formatting for the scaffold's chrome.
 *
 * Ported from a source application's shared helpers module. The editor shows the archive time as a `title`
 * (absolute) plus a relative label, and neither is worth a date dependency, so both live here.
 * `timeAgo` takes the current instant as a parameter rather than reading the clock, so it is
 * deterministic under test.
 */

/** Anything the two formatters accept: a timestamp, or the `null` of an unset column. */
export type TimeLike = Date | string | number | null | undefined

/** Formatting options of {@link formatTimestamp}. */
export interface FormatTimestampOptions {
  /** Full date and time, even for today. Defaults to `false`, which prints `Today HH:MM`. */
  full?: boolean
  /** Time only, no date. */
  timeOnly?: boolean
  /** IANA zone the timestamp is rendered in. Defaults to the runtime's. */
  timeZone?: string
}

/** Same-day timestamps print as `Today HH:MM` unless `full` is set. */
function isToday(date: Date): boolean {
  return new Date().toDateString() === date.toDateString()
}

/** `HH:MM` in `en-GB`, so the hour is unambiguous. */
function clockTime(date: Date, timeZone?: string): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  })
}

/**
 * Absolute timestamp for a `title` attribute: `Today 14:05`, `04/03/2025 09:31`, or `"-"` when the
 * column is unset.
 */
export function formatTimestamp(value: TimeLike, options?: FormatTimestampOptions): string {
  if (value === null || value === undefined) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const time = clockTime(date, options?.timeZone)
  if (options?.timeOnly) return time
  if (!options?.full && isToday(date)) return `Today ${time}`

  const day = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: options?.timeZone,
  })
  return `${day} ${time}`
}

/**
 * Relative label for the archive line: `"a moment ago"`, `"3 minutes ago"`, `"2 months ago"`.
 *
 * @param value The instant to describe; `null`/`undefined` and an unparsable value render `"-"`.
 * @param now The instant "ago" is measured from. Defaults to the current clock.
 */
export function timeAgo(value: TimeLike, now: Date = new Date()): string {
  if (value === null || value === undefined) return "-"
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return "-"

  const seconds = Math.floor((now.getTime() - time) / 1000)
  if (seconds < 10) return "a moment ago"
  if (seconds < 60) return plural(seconds, "second")
  if (seconds < 3600) return plural(Math.floor(seconds / 60), "minute")
  if (seconds < 86400) return plural(Math.floor(seconds / 3600), "hour")

  const days = Math.floor(seconds / 86400)
  if (days < 30) return plural(days, "day")
  if (days < 365) return plural(Math.floor(days / 30), "month")
  return plural(Math.floor(days / 365), "year")
}

/** `"1 minute ago"` / `"2 minutes ago"`. */
function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`
}
