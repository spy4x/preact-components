/**
 * Calendar arithmetic on `YYYY-MM-DD` strings.
 *
 * Day arithmetic and calendar-field lookups (weekday, month name) are pure string/UTC maths: an
 * ISO date carries no zone, so adding 86 400 000 ms in UTC cannot drift across a DST boundary,
 * and a weekday computed in UTC is the same weekday in every zone. That removes the timezone
 * dependency the source version had in its grid maths — see the package README.
 *
 * A timezone only matters to answer "what is today", and that is `isoDateInTz`.
 */

/** `YYYY-MM-DD` for an instant in a zone, via `Intl` — no local-clock assumptions server-side. */
export function isoDateInTz(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) throw new Error(`could not format a date in ${timeZone}`)
  return `${year}-${month}-${day}`
}

/** Today in a zone. The only place a clock is read. */
export function isoToday(timeZone: string): string {
  return isoDateInTz(new Date(), timeZone)
}

/** Whether `Intl` knows a zone. Guards a prop that arrives from an env var or a client hint. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}

function isoToUtcMs(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new Error(`expected a YYYY-MM-DD date, received: ${date}`)
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

/**
 * Weekday of the first of `date`'s month, Monday-first (`0` = Monday … `6` = Sunday).
 *
 * Monday-first is the ISO week order the grid is laid out in; the caller's locale only changes
 * the label text, not the column order.
 */
export function monthFirstWeekday(date: string): number {
  const sundayFirst = new Date(isoToUtcMs(startOfMonth(date))).getUTCDay()
  return (sundayFirst + 6) % 7
}

/** Localised "August 2026" for the month `date` falls in. */
export function monthLabel(date: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(isoToUtcMs(startOfMonth(date))))
}

/** Seven localised weekday labels, Monday first. */
export function weekdayLabels(locale = "en-GB"): string[] {
  const monday = isoToUtcMs("2024-01-01") // a Monday
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
  return Array.from(
    { length: 7 },
    (_, index) => format.format(new Date(monday + index * 86_400_000)),
  )
}
