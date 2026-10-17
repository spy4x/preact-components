/**
 * One formatter for every date and time a screen shows. An app builds it once from the person's
 * own settings (`createFormatters` from `@spy4x/time/format`: region format, time zone, clock) and
 * provides it around everything, so a date looks the same on every screen and every device.
 *
 * `When` and `OnDay` read it; any other component reads it with `useFormat()`.
 *
 * @module
 */

import { type Context, createContext, type JSX } from "preact"
import { useContext } from "preact/hooks"
import { createFormatters, type DateInput, type Formatters } from "@spy4x/time/format"
import { TimeFormatter } from "@spy4x/platform/universal/time"

/**
 * The formatter the components read. An app provides the person's own with
 * `<FormatContext.Provider value={createFormatters(settings)}>`; without a provider (a test, a page
 * before sign-in) it is this device's own region format and time zone.
 */
export const FormatContext: Context<Formatters> = createContext<Formatters>(createFormatters())

/** The formatter of the person whose screen this is: the nearest `FormatContext` value. */
export function useFormat(): Formatters {
  return useContext(FormatContext)
}

/** The words `OnDay` shows around a date. */
export interface DateTextLabels {
  /** Shown instead of a date that is missing or cannot be read. Default `"-"`. */
  missing: string
  /** The hover text, built from the exact instant in the person's format. Default: that text. */
  title: (exact: string) => string
}

/** The words `When` shows: those of `OnDay`, plus the distance from now. */
export interface WhenLabels extends DateTextLabels {
  /**
   * The distance from `now` (epoch milliseconds) to `at`. Default: English, `"a moment ago"`,
   * `"5 minutes ago"`, `"3 days ago"`. An app that wants the region format's own words passes
   * `(at) => format.relative(at)`.
   */
  relative: (at: Date, now: number) => string
}

/** The English words `When` and `OnDay` show when the caller passes none. */
export const WHEN_LABELS: WhenLabels = {
  missing: "-",
  title: (exact) => exact,
  relative: (at, now) => new TimeFormatter({ clock: { now: () => now } }).ago(at),
}

/** Props of `When`. */
export interface WhenProps {
  /** The moment: a `Date`, epoch milliseconds or an ISO string. Missing shows `labels.missing`. */
  at: DateInput
  /** The present, in epoch milliseconds. Default: the time of the render. */
  now?: number
  /** The words shown; see {@link WHEN_LABELS}. */
  labels?: Partial<WhenLabels>
  class?: string
}

/** Props of `OnDay`. */
export interface OnDayProps {
  /** The moment: a `Date`, epoch milliseconds or an ISO string. Missing shows `labels.missing`. */
  at: DateInput
  /** The words shown; see {@link WHEN_LABELS}. */
  labels?: Partial<DateTextLabels>
  class?: string
}

/**
 * A moment as its distance from now, `3 days ago`, in a `<time datetime>` whose hover text is the
 * exact instant in the person's format (`FormatContext`).
 */
export function When({ at, now, labels, class: className }: WhenProps): JSX.Element {
  const format = useFormat()
  const words = { ...WHEN_LABELS, ...labels }
  const instant = toDate(at)
  if (!instant) return <span class={className}>{words.missing}</span>
  return (
    <time class={className} dateTime={instant.toISOString()} title={words.title(format.exact(at))}>
      {words.relative(instant, now ?? Date.now())}
    </time>
  )
}

/**
 * A calendar day in the person's format (`FormatContext`), `17 Oct 2026`, in a `<time datetime>`
 * whose hover text is the exact instant.
 */
export function OnDay({ at, labels, class: className }: OnDayProps): JSX.Element {
  const format = useFormat()
  const words = { ...WHEN_LABELS, ...labels }
  const instant = toDate(at)
  if (!instant) return <span class={className}>{words.missing}</span>
  return (
    <time class={className} dateTime={instant.toISOString()} title={words.title(format.exact(at))}>
      {format.date(at)}
    </time>
  )
}

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
