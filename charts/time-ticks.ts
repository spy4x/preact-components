/**
 * Ticks for a time axis — minutes to decades — with no date library.
 *
 * Ticks fall on round instants of the wall clock in the caller's time zone: whole hours, midnights,
 * the first of a month, the first of a year. The zone is `UTC` unless told otherwise, because a
 * chart rendered on a server and then in a browser must print the same text in both, and the two
 * rarely share a zone. Labels are formatted with `Intl.DateTimeFormat` in the same zone.
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

/**
 * Steps from finest to coarsest; years beyond the last one grow by 1-2-5. No step is more than 2.5
 * times the one before it, so the first step that fits the target still leaves at least a third
 * of it: 45 days get fortnights, not a single month label.
 */
const STEPS: readonly TimeStep[] = [
  { unit: "minute", count: 1 },
  { unit: "minute", count: 2 },
  { unit: "minute", count: 5 },
  { unit: "minute", count: 10 },
  { unit: "minute", count: 15 },
  { unit: "minute", count: 30 },
  { unit: "hour", count: 1 },
  { unit: "hour", count: 2 },
  { unit: "hour", count: 3 },
  { unit: "hour", count: 6 },
  { unit: "hour", count: 12 },
  { unit: "day", count: 1 },
  { unit: "day", count: 2 },
  { unit: "day", count: 3 },
  { unit: "day", count: 7 },
  { unit: "day", count: 14 },
  { unit: "month", count: 1 },
  { unit: "month", count: 2 },
  { unit: "month", count: 3 },
  { unit: "month", count: 6 },
  { unit: "year", count: 1 },
]

/** What {@link timeTicks} takes besides the span. */
export interface TimeTickOptions {
  /** About how many steps the span should hold at most. Defaults to 6. */
  target?: number
  /** The IANA zone whose wall clock the ticks fall on. Defaults to `"UTC"`. */
  timeZone?: string
}

/**
 * The finest step that divides `[start, end]` into at most `target` parts, and its ticks.
 *
 * A zero span gives its one instant as the only tick; a non-finite end gives none.
 */
export function timeTicks(start: number, end: number, options: TimeTickOptions = {}): TimeTicks {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { step: STEPS[0], ticks: [] }
  const [low, high] = start <= end ? [start, end] : [end, start]
  if (high === low) return { step: STEPS[0], ticks: [low] }
  const target = options.target ?? 6
  const limit = Number.isFinite(target) && target >= 1 ? target : 6
  const span = high - low
  const step =
    STEPS.find((candidate) => span / (UNIT_MS[candidate.unit] * candidate.count) <= limit) ??
      { unit: "year", count: niceYears(span / YEAR / limit) }
  const zone = options.timeZone ?? "UTC"
  const ticks = stepTicks(toWall(low, zone), toWall(high, zone), step)
    .map((wall) => fromWall(wall, zone))
    .filter((time, index, all) => time >= low && time <= high && time !== all[index - 1])
  return { step, ticks }
}

/** Formats that read a zone's wall clock, one per zone, built once. */
const WALL_FORMATS = new Map<string, Intl.DateTimeFormat>()

/**
 * `time` as the wall clock of `timeZone` reads it, written as if that reading were UTC: 09:00 in
 * Tokyo is 09:00 here. Ticks are laid on this clock, so a midnight is the zone's midnight.
 */
export function toWall(time: number, timeZone = "UTC"): number {
  if (timeZone === "UTC") return time
  let format = WALL_FORMATS.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
    WALL_FORMATS.set(timeZone, format)
  }
  const part = Object.fromEntries(
    format.formatToParts(time).map(({ type, value }) => [type, value]),
  )
  const wall = Date.UTC(
    Number(part.year),
    Number(part.month) - 1,
    Number(part.day),
    Number(part.hour),
    Number(part.minute),
    Number(part.second),
  )
  return wall + (((time % 1000) + 1000) % 1000)
}

/** The instant whose wall clock in `timeZone` reads `wall`; the later one across a DST change. */
function fromWall(wall: number, timeZone: string): number {
  if (timeZone === "UTC") return wall
  const guess = wall - (toWall(wall, timeZone) - wall)
  return wall - (toWall(guess, timeZone) - guess)
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
  const offset = step.unit === "day" && step.count % 7 === 0 ? 4 * DAY : 0
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
 * An axis label for a tick of `step`: a clock time below a day — or the date, on a tick that falls
 * on the zone's midnight — a day and month for days, a month and year for months, a year for years.
 */
export function formatTimeTick(time: number, step: TimeStep, options: TimeFormatOptions = {}) {
  const belowDay = step.unit === "minute" || step.unit === "hour"
  if (belowDay && isMidnight(time, options.timeZone)) {
    return format(time, { day: "numeric", month: "short" }, options)
  }
  const parts: Record<TimeUnit, Intl.DateTimeFormatOptions> = {
    minute: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    hour: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    day: { day: "numeric", month: "short" },
    month: { month: "short", year: "numeric" },
    year: { year: "numeric" },
  }
  return format(time, parts[step.unit], options)
}

/** Whether `time` is a midnight of the wall clock in `timeZone`. */
export function isMidnight(time: number, timeZone = "UTC"): boolean {
  return ((toWall(time, timeZone) % DAY) + DAY) % DAY === 0
}

/**
 * A tooltip heading: the date, plus the clock time when `withClock` — which the caller decides from
 * the data, not the axis: hourly points over ten days need their hour, though the axis steps days.
 */
export function formatTimeFull(time: number, withClock: boolean, options: TimeFormatOptions = {}) {
  const clock: Intl.DateTimeFormatOptions = withClock
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
