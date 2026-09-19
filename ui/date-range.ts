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
 * There is no year 0000, so the window's lower edge is the first of January 0001. Nothing here
 * leaves the window on purpose, and the escapes that remain are named rather than implied:
 *
 * - An instant at or above year 10000 is outside the window twice over. {@link calendarDateInZone}
 *   still pads and reports the year with five digits (`"10000-01-01"`), so `today` echoes that
 *   string; every arithmetic preset, and {@link parseIsoDate} itself, reject it as
 *   `expected a YYYY-MM-DD date, received: 10000-01-01`.
 * - An instant at or below year 0 is outside it too, and no era is read. `Intl` calls `0000-06-15`
 *   year `"1"` — that date is 1 BC — so {@link calendarDateInZone} pads it to `"0001-06-15"`, a
 *   plausible wrong date one year ahead, and `today` echoes it. `last-year` from 0001, whose maths
 *   is string arithmetic on the padded year, answers with the nonexistent range
 *   `0000-01-01 … 0000-12-31`. Everything that goes through `Date` instead — `addDays`,
 *   {@link formatIsoDate}, {@link parseIsoDate} — keeps year 0000 as `Date` writes it, so the two
 *   halves of the module disagree about that one year and nothing detects it. Unfixable without an
 *   era-aware date model; documented, not fixed.
 * - December 9999 throws for `this-month`, `this-quarter` and `last-12-months`: each asks for the
 *   end of a month that lies past 9999-12-31. 9999 is inside the window; a range of it that ends
 *   on its last day is not. The other presets resolve.
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

/**
 * The `YYYY-MM-DD` calendar date of midnight-UTC milliseconds.
 *
 * Returns a `YYYY-MM-DD` string, or throws rather than returning half of one. `toISOString`
 * switches to a signed six-digit expanded year outside the four-digit window — `+010000-01-01`
 * past 9999, `-000001-06-15` in 1 BC — and the bare `slice(0, 10)` this used to be returned
 * `+010000-01` instead. Adding a day to 9999-12-31 is the ordinary way to reach it.
 *
 * Known residual: `Date` treats `0000` as a year, so `0000-06-15` — 1 BC — keeps a plain
 * four-digit year, passes this check, and round-trips through {@link parseIsoDate} unchanged. Only
 * {@link calendarDateInZone} disagrees, reporting the era's year `"1"`; see its own note.
 *
 * @param ms Milliseconds since the Unix epoch, in UTC.
 * @throws When `ms` is an invalid instant, or `Date` writes its year with a sign.
 */
export function formatIsoDate(ms: number): string {
  const iso = new Date(ms).toISOString()
  if (!/^\d{4}-\d{2}-/.test(iso)) {
    throw new Error(`expected a date in the 0001-9999 window, received: ${iso.slice(0, 10)}`)
  }
  return iso.slice(0, 10)
}

/**
 * The date `days` after `date` (negative goes back). DST-proof: fixed UTC day steps.
 *
 * Fails loudly past either edge of the supported window rather than clamping: a clamp would return
 * 9999-12-31 for a question the caller did not ask — a plausible wrong date, the failure this
 * module exists to prevent — and would hide their off-by-N. Throwing also matches the convention
 * already here, where {@link parseIsoDate} rejects `2026-02-31` instead of rolling it into March.
 *
 * @throws On a `date` that is not a `YYYY-MM-DD` date, and on an answer `toISOString` writes with
 * a signed year. One day back from `0001-01-01` lands in 1 BC, which `addDays("0001-01-01", -1)`
 * reaches only because string arithmetic cannot see that `"0000"` is not a year.
 */
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
 * Two consequences of that padding are documented rather than fixed, because both need an instant a
 * UI clock cannot hold. A year-10000 instant comes back with five digits (`"10000-01-01"`), which
 * {@link parseIsoDate} rejects. A 1 BC instant, `0000-06-15`, comes back as `"0001-06-15"`: no era
 * is formatted, and without one the era's year is `"1"`, so the padding invents a year. Reading the
 * era would mean formatting for it, and every date here is deliberately era-less — `Date` itself
 * keeps year 0000 and agrees with the rest of the module, not with this function.
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
