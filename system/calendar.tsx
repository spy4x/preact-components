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
 *
 * **The keyboard.** Once hydrated the whole grid is one Tab stop, with the focus roving inside it:
 * the arrow keys step a day and a week, Home and End go to the ends of the week, and Page Up and
 * Page Down ask the caller for the neighbouring month through `onSelectMonth`. Every key the grid
 * answers is also cancelled, so paging a month does not scroll the page under the reader. Before
 * hydration — a no-JS page, or an embedded render — the cells keep the natural tab order they are
 * rendered with, which is the only way through them when nothing is listening for a key.
 *
 * **The week is the locale's.** Both the column order and the header text come from `Intl` (see
 * `date.ts`), so the grid starts on Monday in London, on Sunday in New York and on Saturday in
 * Cairo, and an Arabic header reads a weekday rather than the two characters all seven share.
 */

import { cn } from "@preact-components/cn"
import { IconChevronLeft, IconChevronRight } from "@preact-components/icons"
import { useEffect, useId, useRef, useState } from "preact/hooks"
import {
  addDaysIso,
  dayInMonth,
  dayLabel,
  isoToday,
  isValidTimeZone,
  localeFirstWeekday,
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
  /** The same day as the locale writes it, e.g. `9 February 2026`. */
  label: string
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
  /** Accessible description of one day cell, and the hint shown while the grid has focus. */
  day: (day: CalendarDay) => string
}

/** Default day description: the date as the locale writes it, then why it cannot be picked. */
export function describeCalendarDay(day: CalendarDay): string {
  switch (day.reason) {
    case "past":
      return `${day.label} — past`
    case "after":
      return `${day.label} — outside the allowed range`
    case "full":
      return `${day.label} — no slots left`
    case "unavailable":
      return `${day.label} — no times available`
    default:
      return typeof day.slots === "number"
        ? `${day.label} — ${day.slots} slot${day.slots === 1 ? "" : "s"} available`
        : `${day.label} — available`
  }
}

const defaultLabels: CalendarLabels = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  day: describeCalendarDay,
}

export interface CalendarProps {
  /**
   * Any date in the month to draw, `YYYY-MM-DD`. Use {@link startOfMonth} to normalise.
   *
   * A string that is not a date the calendar has — `2026-02-30` — is refused rather than rolled
   * over into the following month.
   */
  monthAnchor: string
  /** First bookable date, `YYYY-MM-DD`. */
  minDate: string
  /** Last bookable date, `YYYY-MM-DD`. */
  maxDate: string
  /**
   * Remaining slots per `YYYY-MM-DD`. A date the map omits has no availability, and a `0` marks
   * the day as having no slots left — the cell looks the same, the accessible label does not.
   */
  slotsByDate?: Readonly<Record<string, number>>
  selectedDate?: string | null
  /**
   * Zone used to resolve `today` when the `today` prop is omitted. Defaults to `"UTC"`; a zone
   * this platform cannot resolve falls back to UTC rather than throwing out of the render.
   */
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
  /**
   * Called when a month arrow is picked, and when Page Up or Page Down is pressed inside the grid.
   * Same interactive/link contract as `onSelectDate`.
   */
  onSelectMonth?: (monthAnchor: string) => void
  /** Day href in link mode. Defaults to `?date=YYYY-MM-DD`, preserving the current path. */
  dateHref?: (date: string) => string
  /** Month href in link mode. Defaults to `?month=YYYY-MM-DD`. */
  monthHref?: (monthAnchor: string) => string
  /** Remaining-slot count at or below which a scarcity dot is drawn. Defaults to `4`. */
  lowSlotsThreshold?: number
  /**
   * Locale for the month heading, the weekday headers, the day labels and the column order.
   * Defaults to `"en-GB"`.
   */
  locale?: string
  /** Copy overrides. */
  labels?: Partial<CalendarLabels>
  /** Utilities for the outer container. */
  class?: string
}

const cellBase =
  "relative flex size-full items-center justify-center rounded-lg text-sm tabular-nums transition-colors select-none"
const focusRing =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 dark:focus-visible:ring-purple-400 dark:focus-visible:ring-offset-gray-800"
const arrowBase =
  "inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400"
const arrowEnabled =
  "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
const arrowDisabled = "cursor-not-allowed opacity-30"

/** Days in a week, and weeks in the grid: the two numbers the layout is built from. */
const WEEK = 7
const WEEKS = 6

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
  const monthKey = firstOfMonth.slice(0, 7)
  const firstWeekday = localeFirstWeekday(locale)
  const headingId = `${useId()}-month`

  // A zone the platform cannot resolve is the environment failing rather than the caller's code:
  // `Intl` answers an unknown one with a `RangeError`, and a grid that refuses to draw at all is a
  // worse answer than a grid whose "today" is UTC.
  const currentDate = today ?? isoToday(isValidTimeZone(timeZone) ? timeZone : "UTC")

  // Six weeks, weekday-aligned: the leading cells step back into the previous month, then days
  // are appended until the grid is full.
  const cells: { date: string; inMonth: boolean }[] = []
  for (let back = monthFirstWeekday(firstOfMonth, firstWeekday); back > 0; back--) {
    cells.push({ date: addDaysIso(firstOfMonth, -back), inMonth: false })
  }
  let cursor = firstOfMonth
  while (cells.length < WEEK * WEEKS) {
    cells.push({ date: cursor, inMonth: cursor.slice(0, 7) === monthKey })
    cursor = addDaysIso(cursor, 1)
  }

  const days: CalendarDay[] = cells.map(({ date, inMonth }) => {
    const slots = slotsByDate[date]
    const reason = dayReason(date, inMonth, minDate, maxDate, slots)
    return {
      date,
      label: dayLabel(date, locale),
      inMonth,
      disabled: reason !== null,
      reason,
      slots,
      selected: selectedDate === date,
      today: date === currentDate,
    }
  })

  // The one day the grid offers as its Tab stop. It is a request rather than a decision: a month
  // arrow can change the month under it, and a requested day that is not on screen has to give way
  // to one that is.
  const [requestedDate, setRequestedDate] = useState<string | null>(null)
  const activeDate = firstOnScreen(
    [requestedDate, selectedDate ?? null, currentDate],
    monthKey,
    days,
  )
  const activeDay = days.find((day) => day.date === activeDate)

  // Roving tabindex is a hydrated-page contract: taking Tab away from the cells is only safe
  // because a key handler gives the movement back. Before hydration there is no handler, so the
  // cells keep their natural tab order and a reader without JavaScript can still reach every day.
  const [enhanced, setEnhanced] = useState(false)
  useEffect(() => setEnhanced(true), [])

  const gridRef = useRef<HTMLDivElement>(null)
  const keyboardMove = useRef(false)
  useEffect(() => {
    if (!keyboardMove.current) return
    keyboardMove.current = false
    gridRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${activeDate}"]`)?.focus()
  }, [activeDate])

  const previousMonth = shiftMonth(firstOfMonth, -1)
  const nextMonth = shiftMonth(firstOfMonth, 1)
  const hasSlotsInMonth = (key: string) =>
    Object.keys(slotsByDate).some((date) => date.slice(0, 7) === key)
  const inHorizon = (key: string) => key >= minDate.slice(0, 7) && key <= maxDate.slice(0, 7)
  // An arrow with nothing to show is not rendered as a dead link: in link mode it becomes a
  // span, because a disabled `<a>` is still focusable and still navigable with Enter.
  const previousEnabled = inHorizon(previousMonth.slice(0, 7)) ||
    hasSlotsInMonth(previousMonth.slice(0, 7))
  const nextEnabled = inHorizon(nextMonth.slice(0, 7)) || hasSlotsInMonth(nextMonth.slice(0, 7))

  /** Move the roving focus to `date`, when the grid has that day of this month. */
  const moveTo = (date: string) => {
    if (!days.some((day) => day.inMonth && day.date === date)) return
    keyboardMove.current = true
    setRequestedDate(date)
  }

  /**
   * Ask for the neighbouring month, keeping the cursor on the same day number.
   *
   * Nothing happens without `onSelectMonth`: in link mode the month lives in the URL, and a key
   * press that navigated the page would be a surprise the dual-mode contract does not promise.
   * The arrows are links there, and Tab reaches them.
   *
   * @returns Whether the grid answered the key.
   */
  const requestMonth = (months: -1 | 1, enabled: boolean): boolean => {
    if (!onSelectMonth || !enabled || !activeDate) return false
    const target = shiftMonth(firstOfMonth, months)
    keyboardMove.current = true
    setRequestedDate(dayInMonth(target, Number(activeDate.slice(8, 10))))
    onSelectMonth(target)
    return true
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!activeDate || event.altKey || event.ctrlKey || event.metaKey) return

    const index = days.findIndex((day) => day.date === activeDate)
    const rowStart = Math.floor(index / WEEK) * WEEK
    const week = days.slice(rowStart, rowStart + WEEK).filter((day) => day.inMonth)

    switch (event.key) {
      case "ArrowLeft":
        moveTo(addDaysIso(activeDate, -1))
        break
      case "ArrowRight":
        moveTo(addDaysIso(activeDate, 1))
        break
      case "ArrowUp":
        moveTo(addDaysIso(activeDate, -WEEK))
        break
      case "ArrowDown":
        moveTo(addDaysIso(activeDate, WEEK))
        break
      case "Home":
        if (week.length > 0) moveTo(week[0].date)
        break
      case "End":
        if (week.length > 0) moveTo(week[week.length - 1].date)
        break
      case "PageUp":
        if (!requestMonth(-1, previousEnabled)) return
        break
      case "PageDown":
        if (!requestMonth(1, nextEnabled)) return
        break
      default:
        return
    }

    // Only for a key the grid answered. An unanswered Page Down still scrolls, which is what the
    // reader expects of a page the grid has no month to give them.
    event.preventDefault()
  }

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

  /** One day cell's focusable element: a button, a link, or an inert span for a day that is out. */
  const renderDay = (day: CalendarDay) => {
    const dayNumber = day.date.slice(8, 10)
    if (!day.inMonth) {
      return <div class={cn(cellBase, outOfMonthClass)}>{dayNumber}</div>
    }

    const shared = {
      "data-calendar-date": day.date,
      "aria-label": copy.day(day),
      tabIndex: enhanced ? (day.date === activeDate ? 0 : -1) : undefined,
      onFocus: () => setRequestedDate(day.date),
    }

    // A day that cannot be picked is still focusable, and its label is still the reason it cannot:
    // the reason used to live in a `title`, which a keyboard never reaches.
    if (day.disabled) {
      return (
        <span
          {...shared}
          aria-disabled="true"
          class={cn(cellBase, disabledClass, day.reason === "full" && fullClass, focusRing)}
        >
          {dayNumber}
        </span>
      )
    }

    const scarce = !day.selected && typeof day.slots === "number" && day.slots > 0 &&
      day.slots <= lowSlotsThreshold
    const stateClass = day.selected ? selectedClass : day.today ? todayClass : selectableClass
    const attributes = {
      ...shared,
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
        <button type="button" onClick={() => onSelectDate(day.date)} {...attributes}>
          {content}
        </button>
      )
      : <a href={dateHref(day.date)} {...attributes}>{content}</a>
  }

  return (
    <div
      class={cn(
        "group rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
        className,
      )}
    >
      <div class="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 id={headingId} class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {monthLabel(firstOfMonth, locale)}
        </h3>
        <div class="flex items-center gap-1">
          {arrow("previous", previousEnabled, previousMonth, copy.previousMonth)}
          {arrow("next", nextEnabled, nextMonth, copy.nextMonth)}
        </div>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-labelledby={headingId}
        aria-colcount={WEEK}
        onKeyDown={onKeyDown}
        class="space-y-px px-2 pb-2"
      >
        <div role="row" class="grid grid-cols-7 gap-px">
          {weekdayLabels(locale).map((weekday, column) => (
            <div
              key={weekday.long}
              role="columnheader"
              aria-colindex={column + 1}
              aria-label={weekday.long}
              class="py-1 text-center text-[11px] font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
            >
              {weekday.short}
            </div>
          ))}
        </div>

        {Array.from(
          { length: WEEKS },
          (_, row) => (
            <div key={row} role="row" class="grid grid-cols-7 gap-px">
              {days.slice(row * WEEK, row * WEEK + WEEK).map((day, column) => (
                <div
                  key={day.date}
                  role="gridcell"
                  aria-colindex={column + 1}
                  // A peek day repeats the neighbouring month's own grid, so it is decoration here;
                  // announcing it would read a year's dates twice over as the reader pages through.
                  aria-hidden={day.inMonth ? undefined : "true"}
                  class="aspect-square"
                >
                  {renderDay(day)}
                </div>
              ))}
            </div>
          ),
        )}
      </div>

      {activeDay && (
        // Why the focused day cannot be picked, for the reader who has no screen reader to read
        // the cell's own name out. It is hidden from assistive technology because the focused cell
        // already carries this same sentence as its accessible name.
        <p
          aria-hidden="true"
          data-calendar-hint
          class="hidden px-4 pb-3 text-xs text-gray-500 group-focus-within:block dark:text-gray-400"
        >
          {copy.day(activeDay)}
        </p>
      )}
    </div>
  )
}

const outOfMonthClass = "text-gray-300 dark:text-gray-600"
const disabledClass = "text-gray-400 cursor-not-allowed dark:text-gray-500"
const fullClass = "line-through decoration-gray-300 dark:decoration-gray-600"
const selectedClass = "bg-purple-900 font-semibold text-white hover:bg-purple-800"
const todayClass =
  "bg-purple-50 font-semibold text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/50"
const selectableClass = "text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"

/**
 * The first candidate that is a day of the month on screen, or that month's first day.
 *
 * The grid always has exactly one Tab stop, so "none of them applies" cannot be an answer: a month
 * the reader has just paged into carries neither the selection nor today.
 *
 * @param candidates Preferred days, best first; `null` entries are skipped.
 * @param monthKey `YYYY-MM` of the month on screen.
 * @param days The grid's cells.
 */
function firstOnScreen(
  candidates: (string | null)[],
  monthKey: string,
  days: CalendarDay[],
): string | undefined {
  for (const candidate of candidates) {
    if (candidate && candidate.slice(0, 7) === monthKey) return candidate
  }
  return days.find((day) => day.inMonth)?.date
}

/**
 * Resolve a cell to a reason or `null`.
 *
 * Order matters: out-of-month and out-of-horizon are checked before availability, because a day
 * outside the allowed range must not look merely "busy".
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
