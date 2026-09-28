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
import {
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MINUTE_IN_MILLISECONDS,
} from "@spy4x/platform/universal/time-constants"
import { addDays, hhmmInTz, isoDateInTz, resolveWallClock, WallClockKind } from "@spy4x/time/tz"

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
 * A wall-clock string alone cannot say which of a repeated hour it means: on the day a zone falls
 * back, `2026-10-25T02:30` happens twice in `Europe/Berlin`, and most date libraries convert it to
 * the earlier of the two. So a range can also carry the exact instant behind each end —
 * `fromInstant` and `toInstant`, UTC ISO 8601 strings such as `2026-10-25T01:30:00.000Z` — and a
 * caller that queries by the range should read those rather than convert the strings itself (#264).
 * Both are optional here, so every range written before they existed is still a `DateTimeRange`;
 * {@link ExactDateTimeRange} is the shape that always has them, and it is what
 * {@link rangeForTimePreset}, {@link exactDateTimeRange} and `DateRangePicker`'s `withTime` mode
 * hand back.
 */
export interface DateTimeRange {
  /** Start of the range, inclusive, wall time in the caller's zone. */
  from: string
  /** End of the range, inclusive, wall time in the caller's zone. */
  to: string
  /** The exact instant `from` means, as a UTC ISO 8601 string. */
  fromInstant?: string
  /** The exact instant `to` means, as a UTC ISO 8601 string. */
  toInstant?: string
}

/**
 * A {@link DateTimeRange} that always carries the exact instant behind each end, so a caller never
 * has to guess which of a repeated hour a wall-clock string meant.
 */
export interface ExactDateTimeRange extends DateTimeRange {
  fromInstant: string
  toInstant: string
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
 * Each end also carries its exact instant — `fromInstant`, `toInstant`, see
 * {@link ExactDateTimeRange} — truncated to the minute its string names, so the two instants are
 * always exactly one or twenty-four real hours apart and each reads back as its own string. A
 * caller that queries by those instants is right on every day of the year.
 *
 * A caller that converts the strings instead is not, on the day a zone falls back: the standard
 * conversion of a repeated hour (the earlier of its two instants) reads a preset wrong by one hour
 * for every real hour one of its ends spends inside that repeated hour. `"last-24-hours"` has at
 * most one end there — its ends are 24 real hours apart, wider than the roughly two real hours the
 * repeated hour spans across both passes — so a string round trip reads 23 or 25 hours.
 * `"last-hour"`'s ends are a real hour apart, so both can land there at once, and a string round
 * trip has three outcomes:
 *
 * - Neither end in the repeated hour: the ordinary 1 hour, correct.
 * - Both ends there, `from` in the hour's first pass and `to` in its second: they print the exact
 *   same `YYYY-MM-DDTHH:mm` string, and the string round trip reads 0 hours. Example: `now`
 *   `2026-10-25T01:30:00Z` in `Europe/Berlin` answers `from` and `to` `"2026-10-25T02:30"`, with
 *   `fromInstant` `2026-10-25T00:30:00.000Z` and `toInstant` `2026-10-25T01:30:00.000Z`.
 * - Only `from` there, in the second pass: the string round trip reads 2 hours. Example: `now`
 *   `2026-10-25T02:10:00Z` in `Europe/Berlin` answers `{ from: "2026-10-25T02:10", to:
 *   "2026-10-25T03:10" }`.
 *
 * `date-range.test.ts` pins every case above, both as the strings read back and as the instants.
 *
 * @param preset The sub-day preset to resolve.
 * @param options Injected instant and zone; see {@link RangeForTimePresetOptions}.
 * @throws When `now` or `timeZone` cannot name a wall-clock date and time.
 */
export function rangeForTimePreset(
  preset: TimeRangePreset,
  options: RangeForTimePresetOptions,
): ExactDateTimeRange {
  const { now, timeZone } = options
  const hours = preset === "last-hour" ? 1 : 24
  // Truncated to the minute the strings name. Every zone offset in use is a whole number of
  // minutes, so truncating in UTC truncates the wall clock too, and both ends lose the same seconds:
  // the two instants stay exactly `hours` real hours apart.
  const to = new Date(
    Math.floor(now.getTime() / ONE_MINUTE_IN_MILLISECONDS) * ONE_MINUTE_IN_MILLISECONDS,
  )
  const from = new Date(to.getTime() - hours * ONE_HOUR_IN_MILLISECONDS)
  return {
    from: calendarDateTimeInZone(from, timeZone),
    to: calendarDateTimeInZone(to, timeZone),
    fromInstant: from.toISOString(),
    toInstant: to.toISOString(),
  }
}

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/

/** Whether one end is a well-formed `YYYY-MM-DDTHH:mm` on a day the calendar has. */
function isDateTimeValue(value: string): boolean {
  if (!ISO_DATE_TIME_PATTERN.test(value)) return false
  try {
    parseIsoDate(value.slice(0, 10))
  } catch {
    return false
  }
  return true
}

/**
 * Whether a {@link DateTimeRange} is two well-formed wall-clock values, in order — not necessarily
 * two real ones: nothing here checks whether a named local time actually occurs in any zone, since
 * this function is not handed one. A range naming the hour a zone skips passes it just the same;
 * {@link exactDateTimeRange} is the function that is handed a zone and resolves it.
 *
 * The date half of each value is checked the way {@link isValidDateRange} checks a whole one —
 * round-tripped through {@link parseIsoDate} — so `2026-02-31T10:00` is rejected for the same
 * reason `2026-02-31` is.
 *
 * Order is read from the exact instants when the range carries both of them, and from the strings
 * otherwise. The strings sort exactly the way nominal wall clocks do, which is right on every day
 * but the one a zone falls back: then `02:50` in the repeated hour's first pass comes twenty real
 * minutes before `02:10` in its second, and only the instants can say so. A range without instants
 * keeps the string rule it always had. An instant that does not parse makes the range invalid.
 */
export function isValidDateTimeRange(range: DateTimeRange): boolean {
  if (!isDateTimeValue(range.from) || !isDateTimeValue(range.to)) return false
  if (range.fromInstant !== undefined && range.toInstant !== undefined) {
    const from = Date.parse(range.fromInstant)
    const to = Date.parse(range.toInstant)
    return Number.isFinite(from) && Number.isFinite(to) && from <= to
  }
  return range.from <= range.to
}

/** Which of the two instants a repeated wall-clock time names: before or after the clocks go back. */
export type WallClockOccurrence = "earlier" | "later"

/** The occurrence chosen for each end of a range; an end left out means `"earlier"`. */
export interface DateTimeOccurrences {
  from?: WallClockOccurrence
  to?: WallClockOccurrence
}

/** What {@link resolveDateTime} found for one wall-clock value in one zone. */
export interface ResolvedDateTime {
  /**
   * `Unique`, `Gap` (the clocks skip it) or `Overlap` (the clocks repeat it) — the `WallClockKind`
   * enum from `@spy4x/time/tz`.
   */
  kind: WallClockKind
  /**
   * The instant the value names, as a UTC ISO 8601 string: its only occurrence, the earlier of two,
   * or, for a skipped time, the instant a clock that did not change would have shown it — which
   * the zone's clock reads as {@link ResolvedDateTime.reads}.
   */
  instant: string
  /** `Overlap` only: the later of the two instants. */
  later?: string
  /**
   * What the zone's clock reads at `instant`, as `YYYY-MM-DDTHH:mm`. The value itself, except for a
   * skipped time, which is moved forward by the length of the gap: Berlin's nonexistent
   * `2026-03-29T02:30` reads `2026-03-29T03:30`.
   */
  reads: string
}

/**
 * Whether a `YYYY-MM-DDTHH:mm` wall-clock value happens once, never or twice in `timeZone`, with the
 * instants behind it — `resolveWallClock` from `@spy4x/time/tz`, taking this module's value shape
 * and answering in its string instants.
 *
 * A skipped time resolves forward, Temporal's `"compatible"` rule: `02:30` on the night the clocks
 * jump from `02:00` to `03:00` is read as `03:30`, the time a clock that had not jumped would have
 * called `02:30`.
 *
 * @throws When `value` is not a well-formed wall-clock value, its year is below 100 (which
 * `resolveWallClock` does not accept), or `timeZone` is not a zone.
 */
export function resolveDateTime(value: string, timeZone: string): ResolvedDateTime {
  if (!isDateTimeValue(value)) {
    throw new RangeError(`expected a YYYY-MM-DDTHH:mm value, received: ${value}`)
  }
  const resolution = resolveWallClock(value.slice(0, 10), value.slice(11), timeZone)
  const resolved: ResolvedDateTime = {
    kind: resolution.kind,
    instant: resolution.instant.toISOString(),
    reads: resolution.kind === WallClockKind.Gap
      ? calendarDateTimeInZone(resolution.instant, timeZone)
      : value,
  }
  if (resolution.later) resolved.later = resolution.later.toISOString()
  return resolved
}

/**
 * A wall-clock range resolved to the exact instants it means in `timeZone`.
 *
 * `occurrences` says which pass of a repeated hour each end names — the choice `DateRangePicker`
 * asks the person for when they type one — and defaults to the earlier. It is ignored for an end
 * that is not in a repeated hour. An end in a skipped hour is moved forward (see
 * {@link resolveDateTime}), and its string is rewritten to what the clock really read then, so
 * `from`/`to` and `fromInstant`/`toInstant` always describe the same two moments.
 *
 * Ordered by instant, not by string: `02:50` in the first pass through `02:10` in the second is a
 * valid twenty-minute range, and `02:30` second pass through `02:45` first pass is not.
 *
 * @throws When either end is malformed, cannot be resolved in `timeZone` (see
 * {@link resolveDateTime}), or the resolved `from` comes after the resolved `to`.
 */
export function exactDateTimeRange(
  range: DateTimeRange,
  timeZone: string,
  occurrences: DateTimeOccurrences = {},
): ExactDateTimeRange {
  const resolveEnd = (value: string, occurrence: WallClockOccurrence | undefined) => {
    const resolved = resolveDateTime(value, timeZone)
    const instant = occurrence === "later" && resolved.later ? resolved.later : resolved.instant
    return { reads: resolved.reads, instant }
  }
  const from = resolveEnd(range.from, occurrences.from)
  const to = resolveEnd(range.to, occurrences.to)
  if (Date.parse(from.instant) > Date.parse(to.instant)) {
    throw new RangeError(
      `expected an ordered range, received: ${from.reads} (${from.instant}) … ${to.reads} (${to.instant})`,
    )
  }
  return { from: from.reads, to: to.reads, fromInstant: from.instant, toInstant: to.instant }
}

/**
 * Which pass of its wall clock an instant is: `"later"` when `value` is a repeated time in
 * `timeZone` and `instant` is its second occurrence, `"earlier"` otherwise — including when either
 * argument cannot be resolved. The inverse of the choice {@link exactDateTimeRange} takes, so a
 * range handed back with its instants can be reopened on the same choice.
 */
export function occurrenceOf(
  value: string,
  instant: string,
  timeZone: string,
): WallClockOccurrence {
  try {
    const later = resolveDateTime(value, timeZone).later
    return later !== undefined && Date.parse(later) === Date.parse(instant) ? "later" : "earlier"
  } catch {
    return "earlier"
  }
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
