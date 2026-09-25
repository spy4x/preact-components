/**
 * Calendar arithmetic on `YYYY-MM-DD` strings.
 *
 * Day arithmetic and calendar-field lookups (weekday, month name) are pure string/UTC maths: an
 * ISO date carries no zone, so adding 86 400 000 ms in UTC cannot drift across a DST boundary,
 * and a weekday computed in UTC is the same weekday in every zone. That removes the timezone
 * dependency the source version had in its grid maths — see the package README.
 *
 * A timezone only matters to answer "what is today", and that is `@spy4x/time/tz`'s
 * `isoDateInTz`/`todayInTz` — this module has no zone-aware helper of its own.
 *
 * Which day a week starts on, and what its days are called, are the locale's business rather than
 * this module's: `localeFirstWeekday` and `weekdayLabels` read both out of `Intl`, so a grid laid
 * out with them starts on Monday in London, on Sunday in New York and on Saturday in Cairo with no
 * table of exceptions here.
 */

/** `YYYY-MM-DD`, the only date shape this module accepts. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * `YYYY-MM-DD` to a UTC timestamp, refusing anything that is not a date the calendar has.
 *
 * The guard is a round-trip rather than a range test, because rolling over is what has to be
 * caught: `Date.parse("2026-02-30T00:00:00Z")` answers 2 March without complaint, so a grid
 * anchored on that string used to draw a month its caller never asked for.
 */
function isoToUtcMs(date: string): number {
  const match = ISO_DATE.exec(date)
  if (!match) throw new Error(`expected a YYYY-MM-DD date, received: ${date}`)

  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(ms) || utcMsToIso(ms) !== date) {
    throw new Error(`expected a date the calendar has, received: ${date}`)
  }

  return ms
}

function utcMsToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

/** The ISO date `days` after `date` (negative goes back). DST-proof: fixed UTC day steps. */
export function addDaysIso(date: string, days: number): string {
  return utcMsToIso(isoToUtcMs(date) + days * 86_400_000)
}

/** First day of the month `date` falls in. */
export function startOfMonth(date: string): string {
  return `${utcMsToIso(isoToUtcMs(date)).slice(0, 7)}-01`
}

/**
 * The first day of the month `months` away from `date`.
 *
 * Month arithmetic, not day arithmetic: "one month before 31 March" has to land on 1 February,
 * which adding 28 or 30 days does not guarantee.
 */
export function shiftMonth(date: string, months: number): string {
  const iso = utcMsToIso(isoToUtcMs(date))
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const total = year * 12 + (month - 1) + months
  const shiftedYear = Math.floor(total / 12)
  const shiftedMonth = ((total % 12) + 12) % 12 + 1
  return `${shiftedYear}-${pad2(shiftedMonth)}-01`
}

/** How many days the month `date` falls in has. */
export function daysInMonth(date: string): number {
  return Number(addDaysIso(shiftMonth(date, 1), -1).slice(8, 10))
}

/**
 * The same day number in another month, clipped to that month's length.
 *
 * What a Page Up from 31 January needs: February has no 31st, so the nearest day that exists is
 * the 28th or the 29th, and clipping is the one answer that keeps the cursor inside the month it
 * has just moved to.
 *
 * @param date Any date in the target month.
 * @param dayNumber The day wanted, 1-based.
 * @returns That day in the target month, clipped to the month's last day.
 */
export function dayInMonth(date: string, dayNumber: number): string {
  const clipped = Math.min(Math.max(dayNumber, 1), daysInMonth(date))
  return `${startOfMonth(date).slice(0, 8)}${pad2(clipped)}`
}

/**
 * Weekday of the first of `date`'s month, counted from the week's own first day.
 *
 * The answer is how many leading cells a weekday-aligned grid needs before the 1st: `0` when the
 * month opens on the week's first day, `6` when it opens on its last.
 *
 * @param date Any date in the month.
 * @param firstWeekday The week's first day, `1` = Monday … `7` = Sunday, as `Intl` numbers them.
 */
export function monthFirstWeekday(date: string, firstWeekday = 1): number {
  const sundayFirst = new Date(isoToUtcMs(startOfMonth(date))).getUTCDay()
  return (sundayFirst - (firstWeekday % 7) + 7) % 7
}

/**
 * The day the locale's week starts on, `1` = Monday … `7` = Sunday.
 *
 * `Intl.Locale.getWeekInfo` is the platform's own answer — Monday across most of Europe, Sunday in
 * the United States, Saturday across much of the Middle East — and a hard-coded Monday is the
 * wrong grid for two of those three. A platform that does not carry the method falls back to
 * Monday, which is the ISO week.
 *
 * @param locale A BCP 47 tag, e.g. `en-US`.
 */
export function localeFirstWeekday(locale = "en-GB"): number {
  try {
    // Two spellings, because the method replaced a property of the same name and an engine carries
    // one or the other: reading only the newer one would quietly put every locale back on Monday.
    const tag = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay?: number }
      weekInfo?: { firstDay?: number }
    }
    const firstDay = (tag.getWeekInfo?.() ?? tag.weekInfo)?.firstDay
    return typeof firstDay === "number" && firstDay >= 1 && firstDay <= 7 ? firstDay : 1
  } catch {
    return 1
  }
}

/** Localised "August 2026" for the month `date` falls in. */
export function monthLabel(date: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(isoToUtcMs(startOfMonth(date))))
}

/** Localised "23 August 2026" — the date as a person reads it, not as a machine writes it. */
export function dayLabel(date: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoToUtcMs(date)))
}

/** One weekday header: what its column shows, and what that abbreviation stands for. */
export interface WeekdayLabel {
  /** The abbreviation the column header shows, e.g. `Mon`. */
  short: string
  /** The full name, e.g. `Monday` — the column's accessible name. */
  long: string
}

/**
 * Seven localised weekday labels, starting on the locale's own first day.
 *
 * Both forms are returned because a header needs both, and neither can be had by cutting the other
 * down: `short` is what `Intl` itself abbreviates to, and cutting *that* to two characters leaves
 * every Arabic weekday reading `ال` and six of seven Vietnamese ones reading `Th`.
 *
 * @param locale A BCP 47 tag; it decides the language *and* the column order.
 */
export function weekdayLabels(locale = "en-GB"): WeekdayLabel[] {
  const monday = isoToUtcMs("2024-01-01") // a Monday
  const first = localeFirstWeekday(locale)
  const short = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
  const long = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" })

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday + ((first - 1 + index) % 7) * 86_400_000)
    return { short: short.format(day), long: long.format(day) }
  })
}
