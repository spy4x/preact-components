/**
 * `Calendar`'s roving focus and month requests, kept apart from the grid it draws.
 *
 * Not exported from the package: `Calendar` is the only caller. The comments below are the reasons
 * behind each piece; `system/README.md`, "The calendar's keyboard", says what a reader gets.
 */

import { useSignal } from "@preact/signals"
import type { RefObject } from "preact"
import { useEffect, useLayoutEffect, useRef } from "preact/hooks"
import { dayInMonth, monthFirstWeekday, shiftMonth } from "@spy4x/time/date"
import { addDays } from "@spy4x/time/tz"

/** Days in a week, and weeks in the grid: the two numbers the layout is built from. */
export const WEEK = 7
export const WEEKS = 6

/** The one date shape `focusHere` can carry besides `"grid"`. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** One cell of the grid as the keyboard needs it: its date and whether it is a day of the month. */
interface GridDay {
  date: string
  inMonth: boolean
}

/** What {@link useCalendarFocus} reads from `Calendar`'s props and render. */
export interface CalendarFocusInput {
  /** The first day of the month on screen, `YYYY-MM-DD`. */
  firstOfMonth: string
  /** The grid's 42 cells, in order. */
  days: readonly GridDay[]
  selectedDate: string | null
  /** Today in the calendar's zone, `YYYY-MM-DD`. */
  currentDate: string
  minDate: string
  maxDate: string
  availableByDate: Readonly<Record<string, number>>
  /** The locale's first weekday, `1` = Monday … `7` = Sunday. */
  firstWeekday: number
  onSelectMonth?: (monthAnchor: string) => void
}

/** What {@link useCalendarFocus} hands back to `Calendar`'s render. */
export interface CalendarFocus {
  /** The day that is the grid's one Tab stop. */
  activeDate: string | undefined
  /** `true` once hydrated: the cells rove only then. */
  enhanced: boolean
  /** The grid element; it holds the focus while a month is on its way. */
  gridRef: RefObject<HTMLDivElement>
  /** Ask for the month `months` away. See the function's own comment. */
  requestMonth: (months: -1 | 1, takeFocus: boolean) => boolean
  onKeyDown: (event: KeyboardEvent) => void
  onFocusIn: (event: FocusEvent) => void
  onFocusOut: () => void
  /** A cell's `focus` handler: a reader who clicks or Tabs into a day moves the Tab stop there. */
  onDayFocus: (date: string) => void
}

/**
 * Whether a month is one the calendar will show at all.
 *
 * Pure over props, so a key press can ask about a month no render has drawn yet — which is exactly
 * what the press that has just asked for that month needs to know.
 *
 * @param monthKey `YYYY-MM` of the month in question.
 */
export function monthShown(
  monthKey: string,
  minDate: string,
  maxDate: string,
  availableByDate: Readonly<Record<string, number>>,
): boolean {
  return (monthKey >= minDate.slice(0, 7) && monthKey <= maxDate.slice(0, 7)) ||
    Object.keys(availableByDate).some((date) => date.slice(0, 7) === monthKey)
}

/**
 * The roving Tab stop, the keyboard and the month requests of `Calendar`'s grid.
 *
 * Every key counts from a cursor kept here rather than from the render, because a press can arrive
 * before the render its predecessor asked for. Two layout effects put the focus back after a month
 * is drawn, and a refused month request puts the reader back on the day they pressed from.
 */
export function useCalendarFocus(input: CalendarFocusInput): CalendarFocus {
  const { firstOfMonth, days, selectedDate, currentDate, onSelectMonth } = input
  const monthKey = firstOfMonth.slice(0, 7)

  // The one day the grid offers as its Tab stop. It is a request rather than a decision: a month
  // arrow can change the month under it, and a requested day that is not on screen has to give way
  // to one that is.
  const requested = useSignal<string | null>(null)
  const requestedDate = requested.value

  // The day the Tab stop was on when a month arrow asked for another month, so a month the caller
  // does not draw leaves the Tab stop where it was (#202). No focus moves for it: the reader is
  // standing on the arrow they clicked.
  //
  // A candidate rather than a correction, and that is what separates it from the keyboard's
  // `parkedFrom` below. The arrow leaves `requestedDate` on the same day number in the month it
  // asked for, so a caller that draws that month — in the render the click caused or in a later one
  // — still lands the Tab stop there. This day only fills the gap while the request is unanswered,
  // ahead of the selection and today, which are where the grid would otherwise fall back to.
  //
  // It belongs to that one request and to the screen it was made on, so it is ignored by the first
  // render that shows another month — the one asked for, or any month the caller moved to for its
  // own reasons — or another selection, and forgotten by that render's layout effect. Without that,
  // a day left behind with an arrow long ago outranked the selection every time the caller came
  // back to its month. Every other way the Tab stop moves sets `requestedDate` to a day on screen,
  // which outranks this anyway.
  const arrowRequest = useRef<{ from: string; selected: string | null } | null>(null)
  const arrowStale = (pending: { from: string; selected: string | null } | null) =>
    pending !== null && (pending.from.slice(0, 7) !== monthKey || pending.selected !== selectedDate)
  const arrowFrom = arrowStale(arrowRequest.current) ? null : arrowRequest.current?.from ?? null
  const activeDate = firstOnScreen(
    [requestedDate, arrowFrom, selectedDate, currentDate],
    monthKey,
    days,
  )

  // Roving tabindex is a hydrated-page contract: taking Tab away from the cells is only safe
  // because a key handler gives the movement back. Before hydration there is no handler, so the
  // cells keep their natural tab order and a reader without JavaScript can still reach every day.
  const enhanced = useSignal(false)
  useEffect(() => {
    enhanced.value = true
  }, [])

  // Where the next key press counts from, and the one value the keyboard is allowed to read.
  //
  // A press can arrive before the render its predecessor asked for, so anything a press works out
  // from what the *render* is showing is a step lost: the second of two presses would count from
  // the day the first has left, and — because a press can also change the month — from the month
  // the first has left. Everything below therefore counts from this cursor and from the props the
  // component never changes itself (`minDate`, `maxDate`, `availableByDate`, `locale`), never from
  // `firstOfMonth`, `days` or `activeDate`, which are all answers to the last render.
  //
  // The first layout effect of each commit reconciles it, unless a press is still waiting to be
  // answered: a caller that ignores `onSelectMonth` leaves the cursor in a month nothing will ever
  // draw, and the effect below puts it back. No event reaches a handler between a render and its
  // layout effects, so a handler never reads it unreconciled.
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

  // Where inside this grid the focus is, as the component's own bookkeeping rather than as a
  // question asked of the document: the `YYYY-MM-DD` of the cell holding it, `"grid"` while the
  // container holds it, and `null` once the focus has left the grid.
  //
  // It exists to answer one question the DOM cannot: the focus is on `<body>` — is that because a
  // cell this component focused has just been replaced, or because the reader clicked some plain
  // text and left? Both look identical afterwards. The late-answer checks in
  // `pages/checks/system.ts` rest on telling them apart, and go red if that ever fails.
  const focusHere = useRef<string | null>(null)

  // Set by a `focusout`, and read on the microtask that follows it, unless a commit of this
  // component's layout effects cleared it first.
  //
  // The question "did the reader leave, or was the cell taken out from under them?" has no answer
  // in the event itself. Chromium raises `focusout` for a removal exactly as it does for a blur,
  // with a null `relatedTarget` and — measured, not assumed — with the element still reporting
  // itself as connected. What separates the two is *when*: a removal's `focusout` is dispatched
  // synchronously inside the commit, before that commit's layout effects run, and a reader's is
  // dispatched in a task of its own, whose microtask runs before any render could follow it.
  const departure = useRef(false)

  /** Whether nothing in the document holds the focus, which is where a replaced cell leaves it. */
  const focusLost = () => {
    const active = document.activeElement
    return active === null || active === document.body || active === document.documentElement
  }

  // Declared first, so it runs before the effect below in every commit: the cursor follows the
  // render, and a `focusout` this commit raised is a removal, not the reader leaving.
  useLayoutEffect(() => {
    departure.current = false
    if (arrowStale(arrowRequest.current)) arrowRequest.current = null
    if (keyboardTarget.current === null) cursorDate.current = activeDate
  })

  // A layout effect, not a passive one, and the difference is a key press.
  //
  // Preact runs a passive effect after the browser has painted, which leaves a window between the
  // month being drawn and the focus being put back — long enough for the browser to dispatch the
  // next key to a document body that answers nothing. A reader holding Page Down at a caller that
  // answers on a microtask lost every second press to it. A layout effect runs synchronously with
  // the commit that removed the cell, before any further input is delivered, so the window is not
  // narrowed but closed.
  useLayoutEffect(() => {
    // Nothing holds the focus, and this grid is where it was: put it back.
    //
    // One rule covers every way a month can arrive under a reader — drawn late in answer to their
    // own press, drawn for the caller's own reasons, or drawn for a press another press has already
    // superseded — because all three end the same way, with the cells the focus was on replaced.
    // The day is the day number they were on, in whatever month is now on screen, which is the same
    // promise Page Up and Page Down make when a caller answers at once.
    //
    // It asks `focusHere` and not the document, because `<body>` holding the focus is not on its
    // own an invitation: a reader who blurred, clicked away or tabbed out has chosen to be
    // somewhere else, and a month changing afterwards must not haul them back into a calendar they
    // have left.
    if (keyboardTarget.current === null && focusHere.current !== null && focusLost()) {
      const wasOn = focusHere.current
      const landing = ISO_DAY.test(wasOn)
        ? dayInMonth(firstOfMonth, Number(wasOn.slice(8, 10)))
        : activeDate
      if (landing && landing !== wasOn) {
        cursorDate.current = landing
        // `preventScroll`, because this is the one focus move the calendar makes on its own
        // initiative rather than in answer to a key pressed inside it. Scrolling the page to a
        // calendar the reader has not touched for two seconds is not something they asked for.
        dayElement(landing)?.focus({ preventScroll: true })
        return
      }
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
      // than held for ever, and the reader goes back to the day they were on — the Tab stop through
      // `requested`, and the focus with it when the focus is still where this component parked
      // it. That is what leaves a refused press costing nothing: without it the next arrow press is
      // spent walking back to a day the reader never left.
      //
      // Nothing is remembered about the dropped request. A caller that draws the month later is
      // answered by the rule at the top of this effect, which needs only the day the reader is
      // standing on — and that day is where this branch has just put them.
      if (target === requestedDate && !days.some((day) => day.inMonth && day.date === target)) {
        keyboardTarget.current = null
        const parked = parkedFrom.current
        parkedFrom.current = null
        // The day number is what survives, not the date: a burst that parked from a month the
        // caller never drew leaves `parked` outside the grid on screen, and the reader is standing
        // on that day number of the month that *is* on screen.
        const back = parked && days.some((day) => day.inMonth && day.date === parked)
          ? parked
          : parked
          ? dayInMonth(firstOfMonth, Number(parked.slice(8, 10)))
          : activeDate

        // The cursor is deliberately not assigned here. The render this asks for reconciles it —
        // `activeDate` is `back` in that render — and a second assignment would be a line no check
        // could ever distinguish from its absence.
        if (back) requested.value = back

        // The focus moves only from where this component parked it. A reader who moved it
        // somewhere else while the request was outstanding — another control, another part of the
        // page — is not pulled back into a calendar they have left. `keyboardTarget` is already
        // cleared above, so the cell's own `focus` handler agrees rather than fighting this.
        if (back && document.activeElement === gridRef.current) dayElement(back)?.focus()
      }
      return
    }

    dayElement(target)?.focus()
    // Cleared after the focus call and not before it, so the `focus` handler below can tell the
    // focus this moved from the focus a reader moved.
    keyboardTarget.current = null
    parkedFrom.current = null
  }, [activeDate, requestedDate])

  /** The focusable element of the cell for `date`, when it is on screen. */
  const dayElement = (date: string) =>
    gridRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${date}"]`)

  const shown = (key: string) =>
    monthShown(key, input.minDate, input.maxDate, input.availableByDate)

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
    requested.value = date
  }

  /**
   * Ask for the month `months` away from the one the cursor is in, on the same day number.
   *
   * Counted from the cursor and not from the month on screen. Two month-arrow activations in the
   * same statement land before any render, and counting from the cursor is what makes them ask
   * for two months rather than for the same one twice.
   *
   * A key press is different, because the render that follows it — and the layout effect that
   * reads the answer — run before the next key is delivered. A caller that has drawn the month by
   * then leaves the cursor in it, so presses accumulate. A caller that has not has the press read
   * as a refusal, which rewinds the cursor to the day on screen, so the next press asks for the
   * **same** month again: at such a caller a burst travels one month, and Page Down then Page Up
   * lands a month before where the reader started. That is a trade, taken so that the cursor and
   * the focus never disagree about where the reader is; `system/README.md` says why.
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
    if (!shown(target.slice(0, 7))) return false

    const landing = dayInMonth(target, Number(from.slice(8, 10)))
    // Only the day on screen is worth going back to. A second arrow click in the same frame starts
    // from the month the first one asked for, which is not a day the reader was ever on.
    if (!takeFocus && from.slice(0, 7) === monthKey) {
      arrowRequest.current = { from, selected: selectedDate }
    }
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
    requested.value = landing
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
        moveTo(addDays(from, -1))
        break
      case "ArrowRight":
        moveTo(addDays(from, 1))
        break
      case "ArrowUp":
        moveTo(addDays(from, -WEEK))
        break
      case "ArrowDown":
        moveTo(addDays(from, WEEK))
        break
      case "Home":
        moveTo(weekEnds(from, input.firstWeekday).first)
        break
      case "End":
        moveTo(weekEnds(from, input.firstWeekday).last)
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

  return {
    activeDate,
    enhanced: enhanced.value,
    gridRef,
    requestMonth,
    onKeyDown,
    // `focusin` and `focusout` on the grid rather than the cells' own handlers, because the
    // container sees every arrival and every departure in one place.
    onFocusIn: (event: FocusEvent) => {
      const arrived = event.target as Element | null
      focusHere.current = arrived?.getAttribute?.("data-calendar-date") ?? "grid"
    },
    onFocusOut: () => {
      // A cell taken out from under the focus by this component's own render is not the reader
      // leaving; only a departure they chose ends the calendar's claim on the focus. The commit
      // that removed the cell clears `departure` in its first layout effect, before this microtask.
      //
      // A move to another element *inside* this grid needs no guard of its own, which was measured
      // rather than assumed: `focusin` follows at once and puts `focusHere` back before this
      // microtask runs, so the check below keeps it.
      departure.current = true
      queueMicrotask(() => {
        if (!departure.current) return
        departure.current = false
        if (!gridRef.current?.contains(document.activeElement)) focusHere.current = null
      })
    },
    // A focus this component moved itself is skipped: it would otherwise overwrite the day a key
    // press just asked for, and the press would be lost.
    onDayFocus: (date: string) => {
      if (keyboardTarget.current === null) requested.value = date
    },
  }
}

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
  days: readonly GridDay[],
): string | undefined {
  for (const candidate of candidates) {
    if (candidate && candidate.slice(0, 7) === monthKey) return candidate
  }
  return days.find((day) => day.inMonth)?.date
}
