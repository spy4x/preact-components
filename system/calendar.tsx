/**
 * `Calendar` — single-month date grid with a dual-mode render.
 *
 * Pass `onSelectDate` and every selectable day is a `<button>`; omit it and the same grid renders
 * `<a href>` links built by `dateHref`. One component therefore serves the hydrated island and
 * the no-JS/embedded fallback, and the URL stays the source of truth in both. Month arrows follow
 * the same rule.
 *
 * The grid is always six weeks (42 cells) so the container does not resize between months. The
 * cells before the 1st and after the last day are left blank: a month shows no date of a
 * neighbouring month.
 *
 * **The keyboard.** Once hydrated the whole grid is one Tab stop, with the focus roving inside it:
 * the arrow keys step a day and a week, Home and End go to the ends of the week, and Page Up and
 * Page Down ask the caller for the neighbouring month through `onSelectMonth`. Every key the grid
 * answers is also cancelled, so paging a month does not scroll the page under the reader. A month
 * is asked for rather than taken, and the reader keeps their place whatever the answer is: a caller
 * that draws the month — in that render or a later one — lands them on the same day number in it,
 * and a caller that leaves the month where it was leaves them on the day they pressed from. Before
 * hydration — a no-JS page, or an embedded render — the cells keep the natural tab order they are
 * rendered with, which is the only way through them when nothing is listening for a key.
 *
 * **The week is the locale's.** Both the column order and the header text come from `Intl` (see
 * `@spy4x/time/locale`), so the grid starts on Monday in London, on Sunday in New York and on
 * Saturday in Cairo, and an Arabic header reads a weekday rather than the two characters all seven
 * share.
 */

import { cn } from "@spy4x/preact-cn"
import { IconChevronLeft, IconChevronRight } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useId } from "preact/hooks"
import { monthFirstWeekday, shiftMonth, startOfMonth } from "@spy4x/time/date"
import { dayLabel, localeFirstWeekday, monthLabel, weekdayLabels } from "@spy4x/time/locale"
import { addDays, todayInTz, validTimeZoneOr } from "@spy4x/time/tz"
import { monthShown, useCalendarFocus, WEEK, WEEKS } from "./calendar-focus.ts"

/** Why a day cannot be picked. */
export type CalendarDayReason = "past" | "after" | "none-left" | "unavailable"

/** One cell of the grid, resolved. Passed to `labels.day` and exported so callers can wrap it. */
export interface CalendarDay {
  /** `YYYY-MM-DD` of the cell, including the blank cells that lead and trail the month. */
  date: string
  /** The same day as the locale writes it, e.g. `9 February 2026`. */
  label: string
  /** `false` for a day that belongs to the neighbouring month. */
  inMonth: boolean
  disabled: boolean
  /** `null` when the day is selectable. */
  reason: CalendarDayReason | null
  /** How many are still available, or `undefined` when the day has no availability at all. */
  availableCount: number | undefined
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
    case "none-left":
      return `${day.label} — none left`
    case "unavailable":
      return `${day.label} — not available`
    default:
      return typeof day.availableCount === "number"
        ? `${day.label} — ${day.availableCount} available`
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
  /** First selectable date, `YYYY-MM-DD`. */
  minDate: string
  /** Last selectable date, `YYYY-MM-DD`. */
  maxDate: string
  /**
   * How many are still available per `YYYY-MM-DD`. A date the map omits has no availability, and a
   * `0` marks the day as having none left: both cells are greyed out, the none-left one is also
   * struck through, and each accessible label names its own reason.
   */
  availableByDate?: Readonly<Record<string, number>>
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
   * Called when a selectable day is picked. Supplying it switches the grid from `<a href>` to
   * `<button>` and disables navigation-free rendering — that is the whole dual-mode contract.
   */
  onSelectDate?: (date: string) => void
  /**
   * Called when a month arrow is picked, and when Page Up or Page Down is pressed inside the grid.
   * Same interactive/link contract as `onSelectDate`.
   *
   * It is a request rather than an instruction, and the reader keeps their place in the grid
   * whatever the answer is. Two rules cover every answer there is:
   *
   * - **`monthAnchor` changes, in this render or a later one.** The focus goes to the same day
   *   number in the month now on screen, which is what Page Up and Page Down promise. It does not
   *   matter why the month changed: an owner that checks or fetches before it answers gets this,
   *   and so does an owner that changes the month for its own reasons while the reader is standing
   *   in the grid.
   * - **`monthAnchor` stays where it was.** A controlled calendar whose owner leaves it alone —
   *   because the month asked for is outside a range the reader may leave, say — keeps the month
   *   on screen, and the press leaves the focus on the day it started from rather than on the
   *   grid.
   *
   * The focus is moved only when nothing in the document holds it and this grid is where it was.
   * A reader who blurred, tabbed away or moved to another control while the answer was outstanding
   * keeps their place, and that move passes `preventScroll` because it is the one the calendar
   * makes on its own initiative.
   *
   * How far a burst travels depends on whether the owner has answered by the time the next key is
   * delivered. One that has — in the same render, or on a microtask — leaves the presses to
   * accumulate: two Page Downs move two months, and a Page Down and a Page Up cancel out. One
   * that has not has already had its press read as a refusal, so the next press counts from the
   * day on screen and asks for the same month again: two Page Downs move one month, and a Page
   * Down and a Page Up leave the reader one month *before* they started, the calendar having
   * asked for the month after and then the month before. Every press is delivered and answered
   * either way. `system/README.md` says why that trade was taken.
   */
  onSelectMonth?: (monthAnchor: string) => void
  /** Day href in link mode. Defaults to `?date=YYYY-MM-DD`, preserving the current path. */
  dateHref?: (date: string) => string
  /** Month href in link mode. Defaults to `?month=YYYY-MM-DD`. */
  monthHref?: (monthAnchor: string) => string
  /** Available count at or below which a low-availability dot is drawn. Defaults to `4`. */
  lowAvailabilityThreshold?: number
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
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ring-offset-surface"
const arrowBase =
  "inline-flex size-8 items-center justify-center rounded-lg border border-subtle text-muted transition-colors"
const arrowEnabled = "hover:bg-hover hover:text-foreground"
const arrowDisabled = "cursor-not-allowed opacity-30"

/**
 * A month on one page: six weeks of day cells, two month arrows, and a roving keyboard once
 * hydrated. See the module's own comment for the dual-mode contract and the keyboard.
 */
export function Calendar(
  {
    monthAnchor,
    minDate,
    maxDate,
    availableByDate = {},
    selectedDate,
    timeZone = "UTC",
    today,
    onSelectDate,
    onSelectMonth,
    dateHref = (date) => `?date=${date}`,
    monthHref = (month) => `?month=${month}`,
    lowAvailabilityThreshold = 4,
    locale = "en-GB",
    labels,
    class: className,
  }: CalendarProps,
): JSX.Element {
  const copy = { ...defaultLabels, ...labels }
  const firstOfMonth = startOfMonth(monthAnchor)
  const firstWeekday = localeFirstWeekday(locale)
  const headingId = `${useId()}-month`

  // A zone the platform cannot resolve is the environment failing rather than the caller's code:
  // `Intl` answers an unknown one with a `RangeError`, and a grid that refuses to draw at all is a
  // worse answer than a grid whose "today" is UTC.
  const currentDate = today ?? todayInTz(validTimeZoneOr(timeZone, "UTC"))

  const days = monthDays(firstOfMonth, firstWeekday, locale, (date, inMonth) => {
    const available = availableByDate[date]
    const reason = dayReason(date, inMonth, minDate, maxDate, available)
    return {
      disabled: reason !== null,
      reason,
      availableCount: available,
      selected: selectedDate === date,
      today: date === currentDate,
    }
  })

  const focus = useCalendarFocus({
    firstOfMonth,
    days,
    selectedDate: selectedDate ?? null,
    currentDate,
    minDate,
    maxDate,
    availableByDate,
    firstWeekday,
    onSelectMonth,
  })
  const activeDay = days.find((day) => day.date === focus.activeDate)

  const previousMonth = shiftMonth(firstOfMonth, -1)
  const nextMonth = shiftMonth(firstOfMonth, 1)
  // An arrow with nothing to show is not rendered as a dead link: in link mode it becomes a
  // span, because a disabled `<a>` is still focusable and still navigable with Enter.
  const shown = (month: string) => monthShown(month.slice(0, 7), minDate, maxDate, availableByDate)
  const arrow = (direction: -1 | 1, target: string, label: string) =>
    monthArrow({
      glyph: direction === -1
        ? <IconChevronLeft class="size-4" />
        : <IconChevronRight class="size-4" />,
      enabled: shown(target),
      label: `${label}: ${monthLabel(target, locale)}`,
      href: () => monthHref(target),
      // Through the same cursor the keys use, so two activations inside one frame ask for two
      // months. The focus stays on the arrow, which is where the reader is standing.
      onClick: onSelectMonth ? () => focus.requestMonth(direction, false) : undefined,
    })

  // Unpadded and in the locale's own digits, as its label writes them: a `09` on screen is not in a
  // name that reads `9 February 2026`, nor a `9` in `٩ فبراير ٢٠٢٦`, and a speech-input user saying
  // the number they see would miss the cell.
  const dayDigits = new Intl.NumberFormat(locale, { useGrouping: false })
  const cell = (day: CalendarDay) =>
    day.inMonth && dayCell(day, {
      number: dayDigits.format(Number(day.date.slice(8, 10))),
      label: copy.day(day),
      tabIndex: focus.enhanced ? (day.date === focus.activeDate ? 0 : -1) : undefined,
      onFocus: () => focus.onDayFocus(day.date),
      onSelectDate,
      href: dateHref,
      lowAvailabilityThreshold,
    })

  return (
    <div
      class={cn(
        "group rounded-[var(--radius-card,0.75rem)] border border-subtle bg-surface",
        className,
      )}
    >
      <div class="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 id={headingId} class="text-sm font-semibold text-foreground">
          {monthLabel(firstOfMonth, locale)}
        </h3>
        <div class="flex items-center gap-1">
          {arrow(-1, previousMonth, copy.previousMonth)}
          {arrow(1, nextMonth, copy.nextMonth)}
        </div>
      </div>

      <div
        ref={focus.gridRef}
        role="grid"
        // Focusable only from code, never from Tab: it is where the focus stands for the one frame
        // between a month being asked for and the day cells of that month existing.
        tabIndex={-1}
        aria-labelledby={headingId}
        aria-colcount={WEEK}
        onKeyDown={focus.onKeyDown}
        onFocusIn={focus.onFocusIn}
        onFocusOut={focus.onFocusOut}
        class="space-y-px px-2 pb-2"
      >
        <div role="row" class="grid grid-cols-7 gap-px">
          {weekdayLabels(locale).map((weekday, column) => (
            <div
              key={weekday.long}
              role="columnheader"
              aria-colindex={column + 1}
              aria-label={weekday.long}
              class="py-1 text-center text-xs font-medium tracking-wider text-placeholder uppercase"
            >
              {weekday.short}
            </div>
          ))}
        </div>

        {Array.from(
          { length: WEEKS },
          (_, row) => {
            const week = days.slice(row * WEEK, row * WEEK + WEEK)
            return (
              <div
                key={row}
                role="row"
                // A week with no day of this month — the sixth week of every February — has only
                // hidden cells, and a row with no cell left in the tree is a broken grid. The whole
                // row goes, as its cells already have.
                aria-hidden={week.some((day) => day.inMonth) ? undefined : "true"}
                class="grid grid-cols-7 gap-px"
              >
                {week.map((day, column) => (
                  <div
                    key={day.date}
                    role="gridcell"
                    aria-colindex={column + 1}
                    // A cell of a neighbouring month is blank, so there is nothing to announce.
                    aria-hidden={day.inMonth ? undefined : "true"}
                    class="aspect-square"
                  >
                    {cell(day)}
                  </div>
                ))}
              </div>
            )
          },
        )}
      </div>

      {activeDay && (
        // Why the focused day cannot be picked, for the reader who has no screen reader to read
        // the cell's own name out. It is hidden from assistive technology because the focused cell
        // already carries this same sentence as its accessible name.
        <p
          aria-hidden="true"
          data-calendar-hint
          class="hidden px-4 pb-3 text-xs text-muted group-focus-within:block"
        >
          {copy.day(activeDay)}
        </p>
      )}
    </div>
  )
}

const disabledClass = "text-placeholder cursor-not-allowed"
const noneLeftClass = "line-through decoration-control"
const selectedClass = "bg-selected font-semibold text-selected-foreground hover:bg-selected-hover"
const todayClass = "bg-selected-soft font-semibold text-selected hover:bg-selected-soft-hover"
const selectableClass = "text-foreground hover:bg-hover"

/**
 * The grid's 42 cells: six weeks, weekday-aligned. The leading cells step back into the previous
 * month, then days are appended until the grid is full.
 *
 * @param state The parts of a day that depend on the caller's props.
 */
function monthDays(
  firstOfMonth: string,
  firstWeekday: number,
  locale: string,
  state: (date: string, inMonth: boolean) => Omit<CalendarDay, "date" | "label" | "inMonth">,
): CalendarDay[] {
  const monthKey = firstOfMonth.slice(0, 7)
  const cells: { date: string; inMonth: boolean }[] = []
  for (let back = monthFirstWeekday(firstOfMonth, firstWeekday); back > 0; back--) {
    cells.push({ date: addDays(firstOfMonth, -back), inMonth: false })
  }
  let cursor = firstOfMonth
  while (cells.length < WEEK * WEEKS) {
    cells.push({ date: cursor, inMonth: cursor.slice(0, 7) === monthKey })
    cursor = addDays(cursor, 1)
  }
  return cells.map(({ date, inMonth }) => ({
    date,
    label: dayLabel(date, locale),
    inMonth,
    ...state(date, inMonth),
  }))
}

/** What {@link monthArrow} draws. */
interface MonthArrow {
  glyph: JSX.Element
  enabled: boolean
  /** The accessible name: the arrow's label and the month it goes to. */
  label: string
  /** The month's link, used when there is no `onClick`. */
  href: () => string
  /** Asks for the month; a button when given, a link when not. */
  onClick?: () => void
}

/** A month arrow: a button, a link, or an inert stand-in when there is nothing to show. */
function monthArrow({ glyph, enabled, label, href, onClick }: MonthArrow): JSX.Element {
  const classes = cn(arrowBase, enabled ? arrowEnabled : arrowDisabled, focusRing)
  if (!enabled) {
    // The role of the control it stands in for: a `span` with no role may carry neither
    // `aria-label` nor `aria-disabled`, so a screen reader could drop both.
    return (
      <span
        role={onClick ? "button" : "link"}
        aria-disabled="true"
        aria-label={label}
        class={classes}
      >
        {glyph}
      </span>
    )
  }
  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} class={classes}>
        {glyph}
      </button>
    )
  }
  return <a href={href()} aria-label={label} class={classes}>{glyph}</a>
}

/** What {@link dayCell} needs besides the day. */
interface DayCell {
  /** The day number, in the locale's digits. */
  number: string
  /** The cell's accessible name. */
  label: string
  /** `undefined` before hydration, when the cells keep their natural tab order. */
  tabIndex: number | undefined
  /** A reader who clicks or Tabs into a cell moves the grid's Tab stop with them. */
  onFocus: () => void
  onSelectDate?: (date: string) => void
  /** The day's link, used without `onSelectDate`. */
  href: (date: string) => string
  lowAvailabilityThreshold: number
}

/**
 * One day cell's focusable element: a button, a link, or an inert span for a day that is out.
 * `Calendar` draws none for a cell of a neighbouring month: its number would read as a day of this
 * month that cannot be picked.
 */
function dayCell(day: CalendarDay, cell: DayCell): JSX.Element {
  const shared = {
    "data-calendar-date": day.date,
    "aria-label": cell.label,
    tabIndex: cell.tabIndex,
    onFocus: cell.onFocus,
  }

  // A day that cannot be picked is still focusable, and its label is still the reason it cannot:
  // the reason used to live in a `title`, which a keyboard never reaches. It takes the role of the
  // control it stands in for, as a dead month arrow does: a `span` with no role may carry neither
  // `aria-label` nor `aria-disabled`, so a screen reader could drop the reason with both.
  if (day.disabled) {
    return (
      <span
        role={cell.onSelectDate ? "button" : "link"}
        {...shared}
        aria-disabled="true"
        class={cn(cellBase, disabledClass, day.reason === "none-left" && noneLeftClass, focusRing)}
      >
        {cell.number}
      </span>
    )
  }

  const scarce = !day.selected && typeof day.availableCount === "number" &&
    day.availableCount > 0 &&
    day.availableCount <= cell.lowAvailabilityThreshold
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
      {cell.number}
      {scarce && (
        <span
          aria-hidden="true"
          class="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent-600 dark:bg-accent-400"
        />
      )}
    </>
  )
  const select = cell.onSelectDate
  return select
    ? (
      <button type="button" onClick={() => select(day.date)} {...attributes}>
        {content}
      </button>
    )
    : <a href={cell.href(day.date)} {...attributes}>{content}</a>
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
  available: number | undefined,
): CalendarDayReason | null {
  if (!inMonth) return "unavailable"
  if (date < minDate) return "past"
  if (date > maxDate) return "after"
  if (available === 0) return "none-left"
  if (available === undefined) return "unavailable"
  return null
}
