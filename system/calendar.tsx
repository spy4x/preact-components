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
 * answers is also cancelled, so paging a month does not scroll the page under the reader. A month
 * is asked for rather than taken, and the reader keeps their place whatever the answer is: a caller
 * who draws the month lands them on the same day number in it, a caller who leaves the month where
 * it was leaves them on the day they pressed from, and a caller who draws it a render or more later
 * still lands them on that same day number when it arrives. Before hydration — a no-JS page, or an
 * embedded render — the cells keep the natural tab order they are rendered with, which is the only
 * way through them when nothing is listening for a key.
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
   *
   * It is a request rather than an instruction, and every answer to it keeps the reader's place.
   * Three answers are supported, and a key press is where the difference shows:
   *
   * - **Drawn in the render the call triggers.** The focus lands on the same day number in the new
   *   month, which is what Page Up and Page Down promise.
   * - **Not drawn at all.** A controlled calendar whose owner leaves `monthAnchor` where it was —
   *   because the month asked for is outside a range the reader may leave, say — keeps the month on
   *   screen, and the press leaves the focus on the day it started from rather than on the grid.
   * - **Drawn a render or more later.** An owner that checks or fetches before it answers is read
   *   as the previous case first, because a refusal can only be judged by the render that follows
   *   the call. When the month it asked for is drawn after all, the calendar finishes the press:
   *   the focus goes to that same day number. An owner that answers late with a *different* month
   *   has answered a request of its own, and the reader lands on that month's Tab stop instead.
   *
   * The focus is only ever moved from somewhere the calendar itself put it — the grid container, or
   * the day it restored on a refusal, or nowhere at all. A reader who moved the focus elsewhere
   * while the answer was outstanding keeps it.
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

  // Where the next key press counts from, and the one value the keyboard is allowed to read.
  //
  // A press can arrive before the render its predecessor asked for, so anything a press works out
  // from what the *render* is showing is a step lost: the second of two presses would count from
  // the day the first has left, and — because a press can also change the month — from the month
  // the first has left. Everything below therefore counts from this cursor and from the props the
  // component never changes itself (`minDate`, `maxDate`, `slotsByDate`, `locale`), never from
  // `firstOfMonth`, `days` or `activeDate`, which are all answers to the last render.
  //
  // The render reconciles it, unless a press is still waiting to be answered: a caller that
  // ignores `onSelectMonth` leaves the cursor in a month nothing will ever draw, and the effect
  // below puts it back.
  const cursorDate = useRef(activeDate)

  // The day a key press is waiting to be given the focus on, or `null` when none is.
  //
  // A day rather than a flag, because Preact runs an effect a frame after the render that queued
  // it: two presses inside one frame leave two effects to run, and a flag lets the first of them —
  // which carries the day the reader has already left — consume the request the second made. Each
  // effect below therefore acts only on the day it is itself showing.
  const gridRef = useRef<HTMLDivElement>(null)
  const keyboardTarget = useRef<string | null>(null)

  // The day the focus was standing on when a month request parked it on the grid, so a request the
  // caller refuses can put the reader back on it.
  //
  // `activeDate` is not that day and cannot stand in for it. A refused request leaves
  // `requestedDate` pointing into a month nothing will draw, so the render that carries the refusal
  // skips it and falls back to the selection, then to today, then to the first of the month — the
  // day the reader was standing on is exactly the one candidate that render no longer has.
  const parkedFrom = useRef<string | null>(null)

  // A month request that was dropped, kept in case the caller draws that month after all.
  //
  // An owner that checks something before it answers — a fetch for the new month's availability is
  // the ordinary case — changes `monthAnchor` a render or more after the call, which is late enough
  // to have been read as a refusal. Without this the reader paid for that: the day the refusal put
  // them back on is one of the cells the late month replaces, so the focus fell to `<body>` and no
  // key reached the grid at all. Remembering the day the dropped press asked for lets the late
  // month be answered exactly as a prompt one would have been.
  const droppedRequest = useRef<{ waitingIn: string; landing: string } | null>(null)

  /**
   * Whether the focus is this component's to move, rather than somewhere the reader put it.
   *
   * Three answers count as the component's: nothing is focused, the document body has it because a
   * cell the focus was on has just been replaced, or the grid container is holding it while a month
   * is being asked for. Anything else — a month arrow, a control elsewhere on the page — is the
   * reader's own position and is never taken from them.
   */
  const focusIsOurs = () => {
    const active = document.activeElement
    return active === null || active === document.body ||
      active === document.documentElement || active === gridRef.current
  }

  if (keyboardTarget.current === null) cursorDate.current = activeDate
  useEffect(() => {
    // A month that was asked for, dropped, and drawn after all. The month on screen changing is
    // what says the caller has answered at last; until it does there is nothing to decide, and a
    // refusal that stays a refusal never reaches this at all.
    const dropped = droppedRequest.current
    if (dropped && keyboardTarget.current === null && monthKey !== dropped.waitingIn) {
      const honoured = days.some((day) => day.inMonth && day.date === dropped.landing)
      // Some month arrived, but not necessarily the one that was asked for. Two presses in a burst
      // ask for two months and a slow owner draws them one at a time, so the first arrival is a
      // month to pass through rather than the answer; and an owner that answered with some third
      // month of its own has not answered this request either. Either way the reader goes to the
      // month on screen rather than nowhere, and the request is kept until its own month is drawn.
      const landing = honoured ? dropped.landing : activeDate
      droppedRequest.current = honoured ? null : { waitingIn: monthKey, landing: dropped.landing }
      if (landing && focusIsOurs()) {
        // Moved here and now, never queued through `keyboardTarget` for the next render to carry
        // out. The month is already drawn, so the cell already exists — and a queued move is
        // indistinguishable from a month request, which a second late answer arriving in the
        // meantime would read as a refusal of a month nobody asked for, dropping the real request
        // on the floor. That is what left a burst of two presses on the document body.
        //
        // `keyboardTarget` is still set across the call, the same way the answered path below sets
        // it, so the cell's own `focus` handler leaves both the Tab stop and the kept request
        // alone.
        keyboardTarget.current = landing
        gridRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${landing}"]`)?.focus()
        keyboardTarget.current = null
        cursorDate.current = landing
        setRequestedDate(landing)
      }
      return
    }

    const target = keyboardTarget.current
    if (target === null) return

    if (target !== activeDate) {
      // A later press asked for somewhere else, and that press's own effect will move the focus.
      //
      // Only the render that carries the request may conclude that nothing will ever satisfy it,
      // which is what `target === requestedDate` asks. Without that, an effect left over from the
      // month a burst passed through would look at a day two months away, find it nowhere on its
      // own grid, and throw away a request the very next render was about to answer — the focus
      // then stayed on the grid itself and never reached a day at all.
      //
      // When it is this render's own request and the grid still cannot show it, the caller has not
      // answered `onSelectMonth` in the render the call triggered. The request is dropped rather
      // than held for ever, and the reader goes back to the day they were on — the Tab stop
      // through `setRequestedDate`, and the focus with it when the focus is still where this
      // component parked it. That is what leaves a refused press costing nothing: without it the
      // next arrow press is spent walking back to a day the reader never left.
      if (target === requestedDate && !days.some((day) => day.inMonth && day.date === target)) {
        keyboardTarget.current = null
        const parked = parkedFrom.current
        // The grid on screen is the one to go back to, so a caller that answered with some third
        // month rather than with none falls back to that month's own Tab stop.
        const back = parked && days.some((day) => day.inMonth && day.date === parked)
          ? parked
          : activeDate
        parkedFrom.current = null

        // The cursor is deliberately not assigned here. The render this asks for reconciles it —
        // `activeDate` is `back` in that render — and a second assignment would be a line no check
        // could ever distinguish from its absence.
        if (back) setRequestedDate(back)

        // The focus moves only from where this component parked it. A reader who moved it
        // somewhere else while the request was outstanding — another control, another part of the
        // page — is not pulled back into a calendar they have left. `keyboardTarget` is already
        // cleared above, so the cell's own `focus` handler agrees rather than fighting this.
        if (back && document.activeElement === gridRef.current) {
          gridRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${back}"]`)?.focus()
        }

        // Remembered after that call and not before it: the focus lands on a day, whose own
        // `focus` handler forgets any outstanding request, and it is this request that has to
        // survive. Kept in case the caller was slow rather than unwilling — see the top of this
        // effect.
        droppedRequest.current = { waitingIn: monthKey, landing: target }
      }
      return
    }

    gridRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${target}"]`)?.focus()
    // Cleared after the focus call and not before it, so the `focus` handler below can tell the
    // focus this moved from the focus a reader moved.
    keyboardTarget.current = null
    // A month request that was answered clears both: the day it was parked away from, and any
    // request dropped before it. `parkedFrom` is what says this *was* a month request — an arrow
    // key never sets it — so a day moved to inside the month on screen leaves a dropped request
    // alone, and a caller still to answer it late is still answered.
    if (parkedFrom.current !== null) droppedRequest.current = null
    parkedFrom.current = null
  }, [activeDate, requestedDate])

  /**
   * Whether a month is one this calendar will show at all.
   *
   * Pure over props, so a key press can ask about a month no render has drawn yet — which is
   * exactly what the press that has just asked for that month needs to know.
   */
  const monthShown = (monthKey: string) =>
    (monthKey >= minDate.slice(0, 7) && monthKey <= maxDate.slice(0, 7)) ||
    Object.keys(slotsByDate).some((date) => date.slice(0, 7) === monthKey)

  const previousMonth = shiftMonth(firstOfMonth, -1)
  const nextMonth = shiftMonth(firstOfMonth, 1)
  // An arrow with nothing to show is not rendered as a dead link: in link mode it becomes a
  // span, because a disabled `<a>` is still focusable and still navigable with Enter.
  const previousEnabled = monthShown(previousMonth.slice(0, 7))
  const nextEnabled = monthShown(nextMonth.slice(0, 7))

  /**
   * Move the roving focus to `date`, when it is a day of the month the cursor is in.
   *
   * The cursor's month rather than the rendered one, so an arrow that follows a month change is
   * measured against the month it has just landed on. **No check holds this**, and saying so is
   * the point: two real key presses always have a render between them, because each arrives as its
   * own protocol message, so the rendered month is never stale by the time a press reads it. The
   * case this guards needs a press that outruns a render, which no browser check here can produce —
   * it is correct by construction and unproven by measurement.
   */
  const moveTo = (date: string) => {
    const from = cursorDate.current
    if (!from || date.slice(0, 7) !== from.slice(0, 7)) return
    keyboardTarget.current = date
    cursorDate.current = date
    setRequestedDate(date)
  }

  /**
   * Ask for the month `months` away from the one the cursor is in, on the same day number.
   *
   * Counted from the cursor and not from the month on screen, so a second press that arrives
   * before the caller has re-rendered asks for the month after the one the first press asked for,
   * rather than for the same one again.
   *
   * Nothing happens without `onSelectMonth`: in link mode the month lives in the URL, and a key
   * press that navigated the page would be a surprise the dual-mode contract does not promise.
   * The arrows are links there, and Tab reaches them.
   *
   * @param months `-1` or `1`.
   * @param takeFocus Whether the grid should take the focus onto the day it lands on. A key press
   *   inside the grid does; a month arrow does not, because the reader is standing on the arrow.
   * @returns Whether the month was asked for.
   */
  const requestMonth = (months: -1 | 1, takeFocus: boolean): boolean => {
    const from = cursorDate.current
    if (!onSelectMonth || !from) return false

    const target = shiftMonth(from, months)
    if (!monthShown(target.slice(0, 7))) return false

    const landing = dayInMonth(target, Number(from.slice(8, 10)))
    cursorDate.current = landing
    if (takeFocus) {
      keyboardTarget.current = landing
      parkedFrom.current = from
      // Park the focus on the grid itself, now, before the month is asked for.
      //
      // A month change replaces every cell, so the element the focus is standing on is about to
      // stop existing, and the focus would fall back to `<body>` until the effect puts it on a day
      // a frame later. A key pressed in that gap never reaches this handler at all — which is why
      // holding Page Down moved one month and then appeared to stop, and why an arrow straight
      // after a Page Down did nothing. The grid element itself survives every render, so the focus
      // waits there and the next press is still the grid's to answer.
      //
      // The parking is a wait and never a destination: the month the caller draws takes the focus
      // to the day it lands on, and a month the caller refuses to draw takes it back to `from`,
      // which is why that day is remembered here rather than worked out again afterwards.
      gridRef.current?.focus({ preventScroll: true })
    }
    setRequestedDate(landing)
    onSelectMonth(target)
    return true
  }

  const onKeyDown = (event: KeyboardEvent) => {
    // Every key below counts from here and never from the render. Which of the reads that depend
    // on this cursor a check actually holds is worth knowing before editing the handler, and each
    // one says so where it is written: the month `requestMonth` asks for is held, and so is the day
    // a refused request goes back to; the month guard inside `moveTo` is not, and neither is this
    // handler's own count. A burst of key presses cannot tell the cursor from the rendered day,
    // because each press arrives as its own protocol message and the page renders in between, so
    // the two agree by the time any press reads them. The month arrows are the exception — two
    // activations really can land before a render, and `pages/checks/system.ts` sends them.
    const from = cursorDate.current
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return

    switch (event.key) {
      case "ArrowLeft":
        moveTo(addDaysIso(from, -1))
        break
      case "ArrowRight":
        moveTo(addDaysIso(from, 1))
        break
      case "ArrowUp":
        moveTo(addDaysIso(from, -WEEK))
        break
      case "ArrowDown":
        moveTo(addDaysIso(from, WEEK))
        break
      case "Home":
        moveTo(weekEnds(from, firstWeekday).first)
        break
      case "End":
        moveTo(weekEnds(from, firstWeekday).last)
        break
      case "PageUp":
        if (!requestMonth(-1, true)) return
        break
      case "PageDown":
        if (!requestMonth(1, true)) return
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
          // Through the same cursor the keys use, so two activations inside one frame ask for two
          // months. The focus stays on the arrow, which is where the reader is standing.
          onClick={() => requestMonth(direction === "previous" ? -1 : 1, false)}
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
      // A reader who clicks or Tabs into a cell moves the grid's Tab stop with them. A focus this
      // component moved itself is skipped: it would otherwise overwrite the day a key press just
      // asked for, and the press would be lost.
      onFocus: () => {
        if (keyboardTarget.current !== null) return
        // Standing on a day of their own choosing, so there is no lost focus left to rescue and a
        // month that arrives late is an ordinary month change rather than an answer owed to them.
        droppedRequest.current = null
        setRequestedDate(day.date)
      },
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
        // Focusable only from code, never from Tab: it is where the focus stands for the one frame
        // between a month being asked for and the day cells of that month existing.
        tabIndex={-1}
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
 * The first and last day of the week `date` sits in, clipped to `date`'s own month.
 *
 * Worked out from the date and the locale's first weekday rather than from the rendered grid, so a
 * Home or End arriving before the render that a Page Down asked for is still answered about the
 * week the reader is actually on.
 *
 * @param date A day of the month in question.
 * @param firstWeekday The week's first day, `1` = Monday … `7` = Sunday.
 */
function weekEnds(date: string, firstWeekday: number): { first: string; last: string } {
  const leading = monthFirstWeekday(date, firstWeekday)
  const dayNumber = Number(date.slice(8, 10))
  const column = (leading + dayNumber - 1) % WEEK
  return {
    first: dayInMonth(date, dayNumber - column),
    last: dayInMonth(date, dayNumber + (WEEK - 1 - column)),
  }
}

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
