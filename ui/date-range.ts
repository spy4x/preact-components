/**
 * Pure preset maths behind `DateRangePicker`.
 *
 * Every range is a pair of inclusive `YYYY-MM-DD` calendar dates. An ISO date carries no zone, so
 * day, month, quarter and year arithmetic is fixed-step UTC maths that cannot drift across a DST
 * boundary — the exact bug class both source implementations had. A zone is needed for one
 * question only: which calendar date the injected `now` falls on, answered by
 * {@link calendarDateInZone}, this module's single `Intl` call.
 *
 * Tradeoff: a date-only model cannot express gb's sub-day frames (`Last1Hour` … `Last24Hours`),
 * so they are not presets here; a caller that needs instants converts `from` to the start of that
 * day and `to` to the end of it in its own zone. Nothing in this file is locale-aware: copy is the
 * caller's, per the library's no-hardcoded-strings rule.
 *
 * Supported window: the four-digit ISO years 0001–9999, e.g. every instant a UI clock can hold.
 * `Intl` returns unpadded years below 1000 and `Date` switches to six-digit expanded years
 * (`+010000-01-01`) above 9999; the first is padded here, and an instant outside the window fails
 * {@link parseIsoDate}'s round trip rather than yielding a plausible wrong date.
 */

const MS_PER_DAY = 86_400_000

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Inclusive calendar range; both ends are `YYYY-MM-DD`, read in the caller's zone. */
export interface DateRange {
  /** First day of the range, inclusive. */
  from: string
  /** Last day of the range, inclusive. */
  to: string
}

/**
 * Every preset the maths knows.
 *
 * `last-N-days` cover N calendar days **including today**, so `last-7-days` is `today - 6 … today`
 * and `last-90-days` is `today - 89 … today`; that is what a date picker is understood to mean,
 * and it is why a range's day count never drifts across a DST change.
 *
 * `custom` carries no maths of its own: {@link rangeForPreset} returns, and validates, the range
 * the caller passes in.
 */
export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last-3-days"
  | "last-7-days"
  | "last-14-days"
  | "last-30-days"
  | "last-90-days"
  | "last-12-months"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-year"
  | "last-year"
  | "custom"

/**
 * Canonical presentation order, narrowest to widest, custom last.
 *
 * Carries no labels on purpose: user-facing copy is a prop, so the picker is handed its option
 * list (label included) by the caller and the library never ships an English string.
 */
export const dateRangePresets: readonly DateRangePreset[] = [
  "today",
  "yesterday",
  "last-3-days",
  "last-7-days",
  "last-14-days",
  "last-30-days",
  "last-90-days",
  "last-12-months",
  "this-month",
  "last-month",
  "this-quarter",
  "last-quarter",
  "this-year",
  "last-year",
  "custom",
]

/** Options shared by every preset resolution. */
export interface RangeForPresetOptions {
  /** Instant the relative presets are resolved against. Injected, never read from the clock. */
  now: Date
  /** IANA zone that decides which calendar date `now` falls on, e.g. `"Europe/Paris"`. */
  timeZone: string
  /** Read only by the `"custom"` preset; omitting it there, or reversing it, throws. */
  custom?: DateRange
}

/** Options for {@link presetForRange}. */
export interface PresetForRangeOptions {
  /** Instant the candidate ranges are resolved against. */
  now: Date
  /** IANA zone used to resolve the candidates' `today`. */
  timeZone: string
  /** Candidates and their precedence. Defaults to {@link dateRangePresets}. */
  presets?: readonly DateRangePreset[]
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function isSameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to
}

/**
 * Midnight UTC of a calendar date, in milliseconds.
 *
 * Rejects anything a calendar would reject, so a bad value fails at the boundary instead of
 * producing a plausible wrong day. `Date.parse` alone is not enough: it returns `NaN` for
 * `2026-13-01` but silently rolls `2026-02-31` into March and `2026-02-29` into 1 March of a
 * non-leap year. The round trip through {@link formatIsoDate} is what makes the day real.
 */
export function parseIsoDate(date: string): number {
  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error(`expected a YYYY-MM-DD date, received: ${date}`)
  }
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms) || formatIsoDate(ms) !== date) {
    throw new Error(`expected a YYYY-MM-DD date, received: ${date}`)
  }
  return ms
}

/** The `YYYY-MM-DD` calendar date of midnight-UTC milliseconds. */
export function formatIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** The date `days` after `date` (negative goes back). DST-proof: fixed UTC day steps. */
export function addDays(date: string, days: number): string {
  return formatIsoDate(parseIsoDate(date) + days * MS_PER_DAY)
}

/**
 * The first day of the month `months` away from `date`.
 *
 * Month arithmetic, not day arithmetic: "one month before 31 March" has to land on 1 February,
 * which adding 28, 30 or 31 days cannot guarantee.
 */
export function shiftMonth(date: string, months: number): string {
  const iso = formatIsoDate(parseIsoDate(date))
  const total = Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1) + months
  const year = Math.floor(total / 12)
  return `${String(year).padStart(4, "0")}-${pad2(total - year * 12 + 1)}-01`
}

/** First day of the month `date` falls in. */
export function startOfMonth(date: string): string {
  return `${formatIsoDate(parseIsoDate(date)).slice(0, 7)}-01`
}

/** Last day of the month `date` falls in — 28, 29, 30 or 31, leap year included. */
export function endOfMonth(date: string): string {
  return formatIsoDate(parseIsoDate(shiftMonth(date, 1)) - MS_PER_DAY)
}

/** First day of the calendar quarter `date` falls in. */
export function startOfQuarter(date: string): string {
  const month = Number(formatIsoDate(parseIsoDate(date)).slice(5, 7))
  return shiftMonth(date, -((month - 1) % 3))
}

/** Last day of the calendar quarter `date` falls in. */
export function endOfQuarter(date: string): string {
  return formatIsoDate(parseIsoDate(shiftMonth(startOfQuarter(date), 3)) - MS_PER_DAY)
}

/** First day of the calendar year `date` falls in. */
export function startOfYear(date: string): string {
  return `${formatIsoDate(parseIsoDate(date)).slice(0, 4)}-01-01`
}

/** Last day of the calendar year `date` falls in. */
export function endOfYear(date: string): string {
  return `${formatIsoDate(parseIsoDate(date)).slice(0, 4)}-12-31`
}

/** Whether two values name the same calendar day. Throws on a value that is not a date. */
export function isSameDay(a: string, b: string): boolean {
  return parseIsoDate(a) === parseIsoDate(b)
}

/**
 * Whether a range is two real dates in order.
 *
 * One day is a valid range; a reversed or unparsable one is not. Returns `false` rather than
 * throwing, because the caller uses it to gate a button on half-typed input.
 */
export function isValidDateRange(range: DateRange): boolean {
  try {
    return parseIsoDate(range.from) <= parseIsoDate(range.to)
  } catch {
    return false
  }
}

/**
 * The calendar date an instant falls on in a zone.
 *
 * The only zone-aware step in the module: every other preset is arithmetic on the date this
 * returns. `formatToParts` is used instead of parsing a formatted string, so a locale's field
 * order or separators cannot leak into the result, and the parts are assembled from the zone's own
 * calendar rather than from the host clock.
 *
 * The year is padded to four digits because `Intl` does not: `year: "numeric"` reports year 999 as
 * `"999"`, and an unpadded year would leave every date in it unparsable by {@link parseIsoDate}.
 */
export function calendarDateInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const field = (type: string) => parts.find((part) => part.type === type)?.value
  const year = field("year")
  const month = field("month")
  const day = field("day")
  if (!year || !month || !day) {
    throw new Error(`could not read a calendar date in ${timeZone}`)
  }
  return `${year.padStart(4, "0")}-${month}-${day}`
}

/**
 * The range a preset describes on a known day.
 *
 * Split out of {@link rangeForPreset} so a caller resolving many presets against one instant —
 * {@link presetForRange} does, once per candidate — pays for the zone lookup once instead of per
 * candidate. Nothing here is zone-aware: `today` is already a calendar date.
 */
function rangeFromToday(preset: Exclude<DateRangePreset, "custom">, today: string): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "yesterday": {
      const day = addDays(today, -1)
      return { from: day, to: day }
    }
    case "last-3-days":
      return { from: addDays(today, -2), to: today }
    case "last-7-days":
      return { from: addDays(today, -6), to: today }
    case "last-14-days":
      return { from: addDays(today, -13), to: today }
    case "last-30-days":
      return { from: addDays(today, -29), to: today }
    case "last-90-days":
      return { from: addDays(today, -89), to: today }
    case "last-12-months":
      return { from: startOfMonth(shiftMonth(today, -11)), to: endOfMonth(today) }
    case "this-month":
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case "last-month": {
      const first = shiftMonth(today, -1)
      return { from: first, to: endOfMonth(first) }
    }
    case "this-quarter":
      return { from: startOfQuarter(today), to: endOfQuarter(today) }
    case "last-quarter": {
      const first = shiftMonth(startOfQuarter(today), -3)
      return { from: first, to: endOfQuarter(first) }
    }
    case "this-year":
      return { from: startOfYear(today), to: endOfYear(today) }
    case "last-year": {
      const first = `${String(Number(startOfYear(today).slice(0, 4)) - 1).padStart(4, "0")}-01-01`
      return { from: first, to: endOfYear(first) }
    }
    default:
      throw new Error(`unknown date range preset: ${preset}`)
  }
}

/**
 * The inclusive range a preset describes.
 *
 * Relative presets are resolved from `now` in `timeZone`, so the result is a function of its
 * arguments alone; `"custom"` echoes the caller's range after validating it.
 *
 * @param preset Preset to resolve.
 * @param options Injected instant, zone, and the range `"custom"` reads.
 * @throws When `now` or `timeZone` cannot name a day, or `"custom"` is missing a usable range.
 */
export function rangeForPreset(preset: DateRangePreset, options: RangeForPresetOptions): DateRange {
  const { now, timeZone, custom } = options

  if (preset === "custom") {
    if (!custom) throw new Error(`the "custom" preset needs a range in options.custom`)
    if (!isValidDateRange(custom)) {
      throw new Error(`expected an ordered range, received: ${custom.from} … ${custom.to}`)
    }
    return { from: custom.from, to: custom.to }
  }

  return rangeFromToday(preset, calendarDateInZone(now, timeZone))
}

/**
 * The first preset whose range equals `range`, or `undefined` when none does.
 *
 * Lets a caller highlight the active option without tracking a preset of its own. `"custom"` is
 * never a match — it describes no range.
 *
 * Two presets can describe the same range, and then the first candidate in `presets` wins: the
 * answer is a property of {@link dateRangePresets} order, not of the preset the caller had in mind.
 * The canonical order collides by construction, on 143 days of 2024–2027 — `this-month` with
 * `last-30-days` (`2024-04-01 → 2024-04-30`), `this-year` with `last-12-months`
 * (`2024-01-01 → 2024-12-31`), `this-quarter` with `last-90-days` (`2025-01-01 → 2025-03-31`) —
 * and each resolves to the earlier one. A caller that has to highlight what the user actually
 * picked should keep the preset in its own state rather than derive it from the range.
 */
export function presetForRange(
  range: DateRange,
  options: PresetForRangeOptions,
): DateRangePreset | undefined {
  if (!isValidDateRange(range)) return undefined
  const { now, timeZone, presets = dateRangePresets } = options
  // One zone lookup for the whole candidate list: every candidate is resolved against the same
  // instant, so rebuilding that date per candidate is the same answer at 14 times the cost.
  const today = calendarDateInZone(now, timeZone)

  return presets.find((preset) =>
    preset !== "custom" && isSameRange(rangeFromToday(preset, today), range)
  )
}
