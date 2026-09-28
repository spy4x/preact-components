/**
 * Pure preset maths behind `DateRangePicker`.
 *
 * Every range is a pair of inclusive `YYYY-MM-DD` calendar dates. An ISO date carries no zone, so
 * day, month, quarter and year arithmetic is fixed-step UTC maths that cannot drift across a DST
 * boundary — the exact bug class both source implementations had. That arithmetic comes from
 * spy4x/ts-libs (`@spy4x/time/date`, and `addDays` from `@spy4x/time/tz`); this module holds only
 * the presets built on it. A zone is needed for one question only: which calendar date the injected
 * `now` falls on, answered by `@spy4x/time/tz`'s {@link isoDateInTz}.
 *
 * Sub-day frames (`"last-hour"`, `"last-24-hours"`) are no longer absent: {@link DateTimeRange}
 * keeps {@link DateRange}'s own `from`/`to` shape and adds a wall-clock time, and
 * {@link rangeForTimePreset} computes the two of them the same way every preset here is computed —
 * `now` and `timeZone` passed in, nothing read from the clock. They stay a separate, smaller family
 * rather than two more members of {@link DateRangePreset}: their return shape is not `DateRange`,
 * and folding a differently-shaped answer into one function would hand every existing caller of
 * {@link rangeForPreset} a type they never asked for. Nothing in this file is locale-aware: it
 * computes dates and times and holds no copy at all, so nothing here needs a default or an
 * override.
 *
 * Supported window: the four-digit ISO years 0001–9999, e.g. every instant a UI clock can hold.
 * The window is four digits wide, not 0001 upward: year 0000 **is** a representable year — ISO 8601
 * calls it 1 BC, `Date` keeps it, and {@link parseIsoDate} and `formatIsoDate` both accept it,
 * so {@link shiftMonth} answers `0000-12-01` for the month before `0001-01-01` rather than
 * rejecting it. 0000 is outside the window because a UI clock cannot hold it, and what makes it an
 * escape is that `Intl` disagrees with `Date` about the era, not that the year does not exist.
 * Nothing here leaves the window on purpose, and the escapes that remain are named rather than
 * implied:
 *
 * - An instant at or above year 10000 is outside the window twice over. {@link isoDateInTz}
 *   still pads and reports the year with five digits (`"10000-01-01"`), so `today` echoes that
 *   string; every arithmetic preset, and {@link parseIsoDate} itself, reject it as
 *   `expected a YYYY-MM-DD date, received: 10000-01-01`.
 * - An instant at or below year 0 is outside it too, and no era is read. `Intl` calls `0000-06-15`
 *   year `"1"` — that date is 1 BC — so {@link isoDateInTz} pads it to `"0001-06-15"`, a
 *   plausible wrong date one year ahead, and `today` echoes it. `last-year` from 0001, whose maths
 *   is string arithmetic on the padded year, answers with the nonexistent range
 *   `0000-01-01 … 0000-12-31`. Everything that goes through `Date` instead — `addDays`,
 *   `formatIsoDate`, {@link parseIsoDate} — keeps year 0000 as `Date` writes it, so the two
 *   halves of the module disagree about that one year and nothing detects it. Unfixable without an
 *   era-aware date model; documented, not fixed.
 * - December 9999 throws for `this-month`, `this-quarter` and `last-12-months`: each asks for the
 *   end of a month that lies past 9999-12-31. 9999 is inside the window; a range of it that ends
 *   on its last day is not. The other presets resolve. December 9999 is also the one month where
 *   {@link shiftMonth} itself is asked for a year 10000 date, and like {@link addDays} it throws
 *   rather than answering `10000-01-01`; the presets above were already failing on that value one
 *   step later, when {@link parseIsoDate} rejected it.
 */

import {
  type DateRange,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  isValidDateRange,
  parseIsoDate,
  shiftMonth,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "@spy4x/time/date"
import { ONE_HOUR_IN_MILLISECONDS } from "@spy4x/platform/universal/time-constants"
import { addDays, hhmmInTz, isoDateInTz } from "@spy4x/time/tz"

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
 * Canonical presentation order: single days and rolling day counts, then the last 12 months, then
 * calendar periods, then custom.
 *
 * Carries no labels on purpose. This module is the maths, and copy belongs to the component layer
 * above it: `DateRangePicker` is handed its option list, each option's label included, by the
 * caller. The panel's own six strings do have English defaults there — every user-visible string in
 * this library does — but a preset's label is not one of them, because the caller chooses both
 * which presets to offer and how to word each of them.
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

function isSameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to
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

  return rangeFromToday(preset, isoDateInTz(now, timeZone))
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
  const today = isoDateInTz(now, timeZone)

  return presets.find((preset) =>
    preset !== "custom" && isSameRange(rangeFromToday(preset, today), range)
  )
}

/**
 * Every sub-day preset the maths knows.
 *
 * Kept separate from {@link DateRangePreset} rather than added to it: each of these returns a
 * {@link DateTimeRange}, a different shape from the plain calendar days {@link rangeForPreset}
 * returns, and folding a differently-shaped answer into one function would hand every existing
 * caller of it a type they never asked for.
 */
export type TimeRangePreset = "last-hour" | "last-24-hours"

/** Canonical presentation order — the {@link TimeRangePreset} counterpart of {@link dateRangePresets}. */
export const timeRangePresets: readonly TimeRangePreset[] = ["last-hour", "last-24-hours"]

/**
 * Inclusive wall-clock range, minute precision, in the caller's zone.
 *
 * Same shape as {@link DateRange} — `from`/`to` — carrying a time as well: `YYYY-MM-DDTHH:mm`. `to`
 * is inclusive at the minute named, the same convention {@link DateRange.to} uses for a whole day —
 * which means a `"last-hour"` window covers 61 minutes end to end, not 60: the whole of the `to`
 * minute is included, not just its first instant.
 *
 * This module never converts a wall-clock string back to an instant, so it is never asked to resolve
 * the classic DST hazard on its own — but a caller who does convert one, the ordinary next step for
 * querying a database with it, meets it squarely. {@link isValidDateTimeRange} checks the string's
 * shape and calendar date only, not whether the named local time actually occurs: a `from` or `to`
 * naming the hour a zone springs forward — a local time that never happens that day — passes it, and
 * so does either reading of an hour the zone repeats when it falls back. A caller's own conversion of
 * a repeated hour resolves to whichever of its two instants that conversion defaults to — most date
 * libraries pick the earlier one — and {@link rangeForTimePreset}'s own doc lists what that can cost
 * `"last-hour"` and `"last-24-hours"` on the day a zone falls back.
 */
export interface DateTimeRange {
  /** Start of the range, inclusive, wall time in the caller's zone. */
  from: string
  /** End of the range, inclusive, wall time in the caller's zone. */
  to: string
}

/** Options for {@link rangeForTimePreset}. */
export interface RangeForTimePresetOptions {
  /** Instant the preset is resolved against. Injected, never read from the clock. */
  now: Date
  /** IANA zone the wall time is expressed in, e.g. `"Europe/Berlin"`. */
  timeZone: string
}

/**
 * The wall-clock date and time an instant reads as in a zone, minute precision: `YYYY-MM-DDTHH:mm`.
 *
 * Both halves come from `@spy4x/time/tz`, whose `hhmmInTz` asks `Intl` for `hourCycle: "h23"`, so
 * midnight reads `00:00` and never `24:00`, an hour {@link isValidDateTimeRange} would reject.
 */
function calendarDateTimeInZone(instant: Date, timeZone: string): string {
  return `${isoDateInTz(instant, timeZone)}T${hhmmInTz(instant, timeZone)}`
}

/**
 * The inclusive wall-clock range a sub-day preset describes, minute precision.
 *
 * Both ends are computed from real elapsed time — `now`'s instant, minus exactly one or
 * twenty-four hours in milliseconds — and only then read as a wall clock in `timeZone`, the same
 * order {@link rangeForPreset}'s own arithmetic keeps: fixed-step first, zone-aware read after.
 * Read only as the strings this function returns, that order is what keeps `"last-24-hours"`
 * correct on the two days a year a zone's clocks change: the subtraction is always exactly 24 real
 * hours, and it is the *printed* wall-clock span that reads as 23 or 25 hours on that day, rather
 * than the reverse — a 24-hour-looking span that is really 23 or 25 real ones, which is what
 * stepping the clock back a day at a time would give.
 *
 * That correctness is in the strings only, and does not survive a caller converting them back to
 * instants — see {@link DateTimeRange}'s own doc for why a caller would. On the day a zone falls
 * back, the standard conversion of a repeated hour (the earlier of its two instants) reads a preset
 * wrong by one hour for every real hour one of its ends spends inside that repeated hour.
 * `"last-24-hours"` has at most one end there: `from` and `to` are 24 real hours apart, wider than
 * the roughly two real hours the repeated hour spans across both of its passes, so its round trip
 * reads as 23 or 25 hours, never both wrong at once, depending on which end landed there and which
 * pass it fell in. `"last-hour"`'s ends are only a real hour apart, so both can land there at once,
 * and its round trip has three outcomes:
 *
 * - Neither end in the repeated hour: the ordinary 1 hour, correct.
 * - Both ends there, `from` in the hour's first pass and `to` in its second: they print the exact
 *   same `YYYY-MM-DDTHH:mm` string — one wall-clock reading, taken at two different UTC offsets
 *   either side of the fall-back — and the round trip reads 0 hours. Example: `now`
 *   `2026-10-25T01:30:00Z` in `Europe/Berlin` answers `{ from: "2026-10-25T02:30", to:
 *   "2026-10-25T02:30" }`.
 * - Only `from` there, in the second pass, with `to` already past the repeated hour and reading
 *   correctly on its own: the standard conversion reads `from` a real hour later than it is, and the
 *   round trip reads 2 hours. Example: `now` `2026-10-25T02:10:00Z` in `Europe/Berlin` answers
 *   `{ from: "2026-10-25T02:10", to: "2026-10-25T03:10" }`.
 *
 * `date-range.test.ts` pins both examples above, plus a 23- and a 25-hour `"last-24-hours"` case,
 * each with the duration a standard conversion reads back.
 *
 * Every string in every case above is still a correct reading of its own instant, and
 * {@link isValidDateTimeRange} still accepts all of them: a range whose ends read identically is
 * `from <= to`, the same rule a one-day {@link DateRange} passes by design.
 *
 * @param preset The sub-day preset to resolve.
 * @param options Injected instant and zone; see {@link RangeForTimePresetOptions}.
 * @throws When `now` or `timeZone` cannot name a wall-clock date and time.
 */
export function rangeForTimePreset(
  preset: TimeRangePreset,
  options: RangeForTimePresetOptions,
): DateTimeRange {
  const { now, timeZone } = options
  const hours = preset === "last-hour" ? 1 : 24
  const from = new Date(now.getTime() - hours * ONE_HOUR_IN_MILLISECONDS)
  return {
    from: calendarDateTimeInZone(from, timeZone),
    to: calendarDateTimeInZone(now, timeZone),
  }
}

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/

/**
 * Whether a {@link DateTimeRange} is two well-formed wall-clock values, in order — not necessarily
 * two real ones: nothing here checks whether a named local time actually occurs in any zone, since
 * this function is not handed one. A range naming the hour a zone skips passes it just the same.
 *
 * The date half of each value is checked the way {@link isValidDateRange} checks a whole one —
 * round-tripped through {@link parseIsoDate} — so `2026-02-31T10:00` is rejected for the same
 * reason `2026-02-31` is. Ordering is a plain string comparison rather than a parse into instants:
 * `YYYY-MM-DDTHH:mm` sorts lexicographically exactly the way it sorts chronologically as a nominal
 * wall clock, so there is nothing here to convert, and so nothing here to get wrong about a wall
 * time a zone repeats or skips — see {@link DateTimeRange}'s own doc for what a caller who does
 * convert one meets instead.
 */
export function isValidDateTimeRange(range: DateTimeRange): boolean {
  if (!ISO_DATE_TIME_PATTERN.test(range.from) || !ISO_DATE_TIME_PATTERN.test(range.to)) {
    return false
  }
  try {
    parseIsoDate(range.from.slice(0, 10))
    parseIsoDate(range.to.slice(0, 10))
  } catch {
    return false
  }
  return range.from <= range.to
}

function isSameDateTimeRange(a: DateTimeRange, b: DateTimeRange): boolean {
  return a.from === b.from && a.to === b.to
}

/** Options for {@link presetForTimeRange}. */
export interface PresetForTimeRangeOptions {
  /** Instant the candidate ranges are resolved against. */
  now: Date
  /** IANA zone used to resolve the candidates' wall clock. */
  timeZone: string
  /** Candidates and their precedence. Defaults to {@link timeRangePresets}. */
  presets?: readonly TimeRangePreset[]
}

/**
 * The first sub-day preset whose range equals `range`, or `undefined` when none does — the
 * {@link TimeRangePreset} counterpart of {@link presetForRange}.
 *
 * `"last-hour"` and `"last-24-hours"` keep moving with the clock, so a range built from what a
 * person typed a minute ago rarely still equals either of them; this is for a caller that
 * re-resolves against a fresh `now` to decide whether to keep highlighting one.
 */
export function presetForTimeRange(
  range: DateTimeRange,
  options: PresetForTimeRangeOptions,
): TimeRangePreset | undefined {
  if (!isValidDateTimeRange(range)) return undefined
  const { now, timeZone, presets = timeRangePresets } = options

  return presets.find((preset) =>
    isSameDateTimeRange(rangeForTimePreset(preset, { now, timeZone }), range)
  )
}
