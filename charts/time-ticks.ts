/**
 * Ticks for a time axis — minutes to decades — with no date library.
 *
 * Ticks fall on round instants in UTC: whole hours, midnights, the first of a month, the first of a
 * year. Labels are formatted with `Intl.DateTimeFormat` in the caller's time zone, `UTC` unless told
 * otherwise, because a chart rendered on a server and then in a browser must print the same text in
 * both, and the two rarely share a zone.
 */

/** The unit a tick step counts in. */
export type TimeUnit = "minute" | "hour" | "day" | "month" | "year"

/** One step between ticks, e.g. `{ unit: "hour", count: 6 }`. */
export interface TimeStep {
  unit: TimeUnit
  count: number
}

/** A step and the ticks it produced, as epoch milliseconds. */
export interface TimeTicks {
  step: TimeStep
  ticks: number[]
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** Average lengths, used only to pick a step, never to place a tick. */
const MONTH = 30.44 * DAY
const YEAR = 365.25 * DAY

const UNIT_MS: Record<TimeUnit, number> = {
  minute: MINUTE,
  hour: HOUR,
  day: DAY,
  month: MONTH,
  year: YEAR,
}

/** Steps from finest to coarsest; years beyond the last one grow by 1-2-5. */
const STEPS: readonly TimeStep[] = [
  { unit: "minute", count: 1 },
  { unit: "minute", count: 5 },
  { unit: "minute", count: 15 },
  { unit: "minute", count: 30 },
  { unit: "hour", count: 1 },
  { unit: "hour", count: 3 },
  { unit: "hour", count: 6 },
  { unit: "hour", count: 12 },
  { unit: "day", count: 1 },
  { unit: "day", count: 2 },
  { unit: "day", count: 7 },
  { unit: "month", count: 1 },
  { unit: "month", count: 3 },
  { unit: "month", count: 6 },
  { unit: "year", count: 1 },
]

/**
 * The coarsest-enough step for `[start, end]` and its ticks, at most about `target` of them.
 *
 * A zero span gives its one instant as the only tick; a non-finite end gives none.
 */
export function timeTicks(start: number, end: number, target = 6): TimeTicks {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { step: STEPS[0], ticks: [] }
  const [low, high] = start <= end ? [start, end] : [end, start]
  if (high === low) return { step: STEPS[0], ticks: [low] }
  const limit = Number.isFinite(target) && target >= 1 ? target : 6
  const span = high - low
  const step =
    STEPS.find((candidate) => span / (UNIT_MS[candidate.unit] * candidate.count) <= limit) ??
      { unit: "year", count: niceYears(span / YEAR / limit) }
  return { step, ticks: stepTicks(low, high, step) }
}

/** Every instant of `step` inside `[low, high]`. */
function stepTicks(low: number, high: number, step: TimeStep): number[] {
  const ticks: number[] = []
  if (step.unit === "month" || step.unit === "year") {
    const months = step.unit === "year" ? step.count * 12 : step.count
    const first = new Date(low)
    let index = Math.ceil((first.getUTCFullYear() * 12 + first.getUTCMonth()) / months) * months
    for (let time = monthStart(index); time <= high; time = monthStart(index += months)) {
      if (time >= low) ticks.push(time)
    }
    return ticks
  }
  const size = UNIT_MS[step.unit] * step.count
  // A week starts on Monday: the epoch was a Thursday, so weekly ticks are shifted by four days.
  const offset = step.unit === "day" && step.count === 7 ? 4 * DAY : 0
  for (let time = Math.ceil((low - offset) / size) * size + offset; time <= high; time += size) {
    ticks.push(time)
  }
  return ticks
}

/** Epoch milliseconds of the first of a month counted from year 0. */
function monthStart(index: number): number {
  return Date.UTC(Math.floor(index / 12), index % 12, 1)
}

/** The smallest of 1, 2, 5, 10, 20, 50 … years that is at least `years`. */
function niceYears(years: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(years, 1)))
  return [1, 2, 5, 10].map((factor) => factor * power).find((count) => count >= years) ?? power * 10
}

/** Where a time is printed: on the axis, or in a tooltip's heading. */
export interface TimeFormatOptions {
  /** A BCP 47 locale. Defaults to `"en-GB"`: day before month, 24-hour clock. */
  locale?: string
  /** An IANA time zone. Defaults to `"UTC"`. */
  timeZone?: string
}

/**
 * An axis label for a tick of `step`: a clock time below a day, a day and month for days, a month
 * and year for months, a year for years.
 */
export function formatTimeTick(time: number, step: TimeStep, options: TimeFormatOptions = {}) {
  const parts: Record<TimeUnit, Intl.DateTimeFormatOptions> = {
    minute: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    hour: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    day: { day: "numeric", month: "short" },
    month: { month: "short", year: "numeric" },
    year: { year: "numeric" },
  }
  return format(time, parts[step.unit], options)
}

/** A tooltip heading: the date, plus the clock time when ticks are less than a day apart. */
export function formatTimeFull(time: number, step: TimeStep, options: TimeFormatOptions = {}) {
  const clock: Intl.DateTimeFormatOptions = step.unit === "minute" || step.unit === "hour"
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : {}
  return format(time, { day: "numeric", month: "short", year: "numeric", ...clock }, options)
}

function format(time: number, parts: Intl.DateTimeFormatOptions, options: TimeFormatOptions) {
  return new Intl.DateTimeFormat(options.locale ?? "en-GB", {
    timeZone: options.timeZone ?? "UTC",
    ...parts,
  }).format(time)
}
