/**
 * `Calendar` — single-month date grid with a dual-mode render.
 *
 * Pass `onSelectDate` and every bookable day is a `<button>`; omit it and the same grid renders
 * `<a href>` links built by `dateHref`. One component therefore serves the hydrated island and
 * the no-JS/embedded fallback, and the URL stays the source of truth in both. Month arrows follow
 * the same rule.
 *
 * The grid is always six weeks (42 cells) so the container does not resize between months, and
 * leading/trailing days bleed in from the neighbouring months as a "peek".
 */

import { cn } from "@preact-components/signals/cn"
import { IconChevronLeft, IconChevronRight } from "@preact-components/icons"
import {
  addDaysIso,
  isoToday,
  monthFirstWeekday,
  monthLabel,
  shiftMonth,
  startOfMonth,
  weekdayLabels,
} from "./date.ts"

/** Why a day cannot be picked. */
export type CalendarDayReason = "past" | "after" | "full" | "unavailable"

/** One cell of the grid, resolved. Passed to `labels.day` and exported so callers can wrap it. */
export interface CalendarDay {
  /** `YYYY-MM-DD` of the cell, including the leading/trailing peek days. */
  date: string
  /** `false` for a day that belongs to the neighbouring month. */
  inMonth: boolean
  disabled: boolean
  /** `null` when the day is bookable. */
  reason: CalendarDayReason | null
  /** Remaining slots, or `undefined` when the day has no availability at all. */
  slots: number | undefined
  selected: boolean
  today: boolean
}

/** Copy the calendar renders. Override per key through the `labels` prop. */
export interface CalendarLabels {
  previousMonth: string
  nextMonth: string
  /** Accessible description of one day cell. */
  day: (day: CalendarDay) => string
}

/** Default day description: date first, then why it cannot be picked. */
export function describeCalendarDay(day: CalendarDay): string {
  switch (day.reason) {
    case "past":
      return `${day.date} — past`
    case "after":
      return `${day.date} — outside the booking window`
    case "full":
      return `${day.date} — fully booked`
    case "unavailable":
      return `${day.date} — no times available`
    default:
      return typeof day.slots === "number"
        ? `${day.date} — ${day.slots} slot${day.slots === 1 ? "" : "s"} available`
        : `${day.date} — available`
  }
}

const defaultLabels: CalendarLabels = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  day: describeCalendarDay,
}

export interface CalendarProps {
  /** Any date in the month to draw, `YYYY-MM-DD`. Use {@link startOfMonth} to normalise. */
  monthAnchor: string
  /** First bookable date, `YYYY-MM-DD`. */
  minDate: string
  /** Last bookable date, `YYYY-MM-DD`. */
  maxDate: string
  /**
   * Remaining slots per `YYYY-MM-DD`. A date the map omits has no availability, and a `0` marks
   * the day as fully booked — the cell looks the same, the accessible label does not.
   */
  slotsByDate?: Readonly<Record<string, number>>
  selectedDate?: string | null
  /** Zone used to resolve `today` when the `today` prop is omitted. Defaults to `"UTC"`. */
  timeZone?: string
  /**
   * Today's date, `YYYY-MM-DD`. Inject it to keep a render deterministic — the component reads
   * the clock only for this one value.
   */
  today?: string
  /**
   * Called when a bookable day is picked. Supplying it switches the grid from `<a href>` to
   * `<button>` and disables navigation-free rendering — that is the whole dual-mode contract.
   */
  onSelectDate?: (date: string) => void
  /** Called when a month arrow is picked. Same interactive/link contract as `onSelectDate`. */
  onSelectMonth?: (monthAnchor: string) => void
  /** Day href in link mode. Defaults to `?date=YYYY-MM-DD`, preserving the current path. */
  dateHref?: (date: string) => string
  /** Month href in link mode. Defaults to `?month=YYYY-MM-DD`. */
  monthHref?: (monthAnchor: string) => string
  /** Remaining-slot count at or below which a scarcity dot is drawn. Defaults to `4`. */
  lowSlotsThreshold?: number
  /** Locale for the month heading and weekday labels. Defaults to `"en-GB"`. */
  locale?: string
  /** Copy overrides. */
  labels?: Partial<CalendarLabels>
  /** Utilities for the outer container. */
  class?: string
}

const cellBase =
  "relative flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition-colors select-none"
const focusRing =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 dark:focus-visible:ring-purple-400 dark:focus-visible:ring-offset-gray-800"
const arrowBase =
  "inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400"
const arrowEnabled =
  "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
const arrowDisabled = "cursor-not-allowed opacity-30"

export function Calendar(
  {
    monthAnchor,
    minDate,
    maxDate,
    slotsByDate = {},
    selectedDate,
    timeZone = "UTC",
    today,
    onSelectDate,
    onSelectMonth,
    dateHref = (date) => `?date=${date}`,
    monthHref = (month) => `?month=${month}`,
    lowSlotsThreshold = 4,
    locale = "en-GB",
    labels,
    class: className,
  }: CalendarProps,
) {
  const copy = { ...defaultLabels, ...labels }
  const firstOfMonth = startOfMonth(monthAnchor)

  // Six weeks, weekday-aligned: the leading cells step back into the previous month, then days
  // are appended until the grid is full.
  const cells: { date: string; inMonth: boolean }[] = []
  for (let back = monthFirstWeekday(firstOfMonth); back > 0; back--) {
    cells.push({ date: addDaysIso(firstOfMonth, -back), inMonth: false })
  }
  let cursor = firstOfMonth
  while (cells.length < 42) {
    cells.push({ date: cursor, inMonth: cursor.slice(0, 7) === firstOfMonth.slice(0, 7) })
    cursor = addDaysIso(cursor, 1)
  }

  const currentDate = today ?? isoToday(timeZone)
  const hasSlotsInMonth = (monthKey: string) =>
    Object.keys(slotsByDate).some((date) => date.slice(0, 7) === monthKey)

  const previousMonth = shiftMonth(firstOfMonth, -1)
  const nextMonth = shiftMonth(firstOfMonth, 1)
  const inHorizon = (monthKey: string) =>
    monthKey >= minDate.slice(0, 7) && monthKey <= maxDate.slice(0, 7)
  // An arrow with nothing to show is not rendered as a dead link: in link mode it becomes a
  // span, because a disabled `<a>` is still focusable and still navigable with Enter.
  const previousEnabled = inHorizon(previousMonth.slice(0, 7)) ||
    hasSlotsInMonth(previousMonth.slice(0, 7))
  const nextEnabled = inHorizon(nextMonth.slice(0, 7)) || hasSlotsInMonth(nextMonth.slice(0, 7))

  const arrow = (
    direction: "previous" | "next",
    enabled: boolean,
    target: string,
    label: string,
  ) => {
    const glyph = direction === "previous"
      ? <IconChevronLeft class="size-4" />
      : <IconChevronRight class="size-4" />
    const classes = cn(arrowBase, enabled ? arrowEnabled : arrowDisabled, focusRing)
    const accessibleLabel = `${label}: ${monthLabel(target, locale)}`

    if (!enabled) {
      return <span aria-disabled="true" aria-label={accessibleLabel} class={classes}>{glyph}</span>
    }
    if (onSelectMonth) {
      return (
        <button
          type="button"
          aria-label={accessibleLabel}
          onClick={() => onSelectMonth(target)}
          class={classes}
        >
          {glyph}
        </button>
      )
    }
    return <a href={monthHref(target)} aria-label={accessibleLabel} class={classes}>{glyph}</a>
  }

  return (
    <div
      class={cn(
        "rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
        className,
      )}
    >
      <div class="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {monthLabel(firstOfMonth, locale)}
        </h3>
        <div class="flex items-center gap-1">
          {arrow("previous", previousEnabled, previousMonth, copy.previousMonth)}
          {arrow("next", nextEnabled, nextMonth, copy.nextMonth)}
        </div>
      </div>

      <div class="grid grid-cols-7 gap-px px-2">
        {weekdayLabels(locale).map((weekday) => (
          <div
            key={weekday}
            class="py-1 text-center text-[11px] font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
          >
            {weekday.slice(0, 2)}
          </div>
        ))}
      </div>

      <div class="grid grid-cols-7 gap-px p-2 pt-0">
        {cells.map(({ date, inMonth }) => {
          const slots = slotsByDate[date]
          const reason = dayReason(date, inMonth, minDate, maxDate, slots)
          const day: CalendarDay = {
            date,
            inMonth,
            disabled: reason !== null,
            reason,
            slots,
            selected: selectedDate === date,
            today: date === currentDate,
          }
          const dayNumber = date.slice(8, 10)

          if (!inMonth) {
            return (
              <div key={date} aria-hidden="true" class={cn(cellBase, outOfMonthClass)}>
                {dayNumber}
              </div>
            )
          }

          if (day.disabled) {
            return (
              <span
                key={date}
                title={copy.day(day)}
                class={cn(cellBase, disabledClass, reason === "full" && fullClass)}
              >
                {dayNumber}
              </span>
            )
          }

          const scarce = !day.selected && typeof slots === "number" && slots > 0 &&
            slots <= lowSlotsThreshold
          const stateClass = day.selected ? selectedClass : day.today ? todayClass : bookableClass
          const attributes = {
            "aria-label": copy.day(day),
            // `as const` keeps the type at `"date" | undefined`, which is the token Preact's
            // `aria-current` accepts.
            "aria-current": day.selected ? ("date" as const) : undefined,
            class: cn(cellBase, stateClass, focusRing),
          }
          const content = (
            <>
              {dayNumber}
              {scarce && (
                <span
                  aria-hidden="true"
                  class="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-purple-600 dark:bg-purple-400"
                />
              )}
            </>
          )

          return onSelectDate
            ? (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDate(date)}
                {...attributes}
              >
                {content}
              </button>
            )
            : <a key={date} href={dateHref(date)} {...attributes}>{content}</a>
        })}
      </div>
    </div>
  )
}

const outOfMonthClass = "text-gray-300 dark:text-gray-600"
const disabledClass = "text-gray-400 cursor-not-allowed dark:text-gray-500"
const fullClass = "line-through decoration-gray-300 dark:decoration-gray-600"
const selectedClass = "bg-purple-900 font-semibold text-white hover:bg-purple-800"
const todayClass =
  "bg-purple-50 font-semibold text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/50"
const bookableClass = "text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"

/**
 * Resolve a cell to a reason or `null`.
 *
 * Order matters: out-of-month and out-of-horizon are checked before availability, because a day
 * outside the booking window must not look merely "busy".
 */
function dayReason(
  date: string,
  inMonth: boolean,
  minDate: string,
  maxDate: string,
  slots: number | undefined,
): CalendarDayReason | null {
  if (!inMonth) return "unavailable"
  if (date < minDate) return "past"
  if (date > maxDate) return "after"
  if (slots === 0) return "full"
  if (slots === undefined) return "unavailable"
  return null
}
