import { type ReadonlySignal, signal } from "@preact/signals"
import { useEffect, useMemo } from "preact/hooks"
import type { Clock } from "@spy4x/platform/universal/time"
import { addDays, isoDateInTz, isValidTimeZone, resolveWallClock } from "@spy4x/time/tz"

/**
 * `@spy4x/preact-signals/now` — the current time on a signal that moves when the calendar day
 * does (https://github.com/spy4x/preact-components/issues/617).
 *
 * A view that groups by "today" reads the time once, when it renders, and keeps yesterday's
 * grouping after midnight until something unrelated renders it again. This signal changes at the
 * first instant of each new day in the caller's zone, and whenever the page becomes visible again,
 * because a browser pauses a background tab's timers and a phone sleeps through midnight.
 *
 * It does not tick every second: a view that shows a running clock needs its own interval.
 */

/** Timer port. `globalThis` satisfies it. */
export interface NowTimers {
  setTimeout(callback: () => void, ms: number): number
  clearTimeout(id: number): void
}

/** Page-visibility port. `document` satisfies it. */
export interface NowVisibility {
  readonly visibilityState: string
  addEventListener(type: "visibilitychange", listener: () => void): void
  removeEventListener(type: "visibilitychange", listener: () => void): void
}

/** Options for {@link createNow} and {@link useNow}. Every one is optional. */
export interface NowOptions {
  /**
   * The IANA zone whose midnight moves the signal, such as `Europe/Berlin`. Defaults to the
   * runtime's own zone. An unknown zone throws a `RangeError`.
   */
  zone?: string
  /** Where the time comes from. Defaults to `Date.now()`; a test passes a clock it moves itself. */
  clock?: Clock
  /** Where the midnight timer is set. Defaults to `globalThis`. */
  timers?: NowTimers
  /**
   * Whose `visibilitychange` re-reads the clock. Defaults to `globalThis.document` when it exists;
   * `null` listens nowhere.
   */
  visibility?: NowVisibility | null
}

/** The current time, and the wiring that keeps it current. */
export interface NowStore {
  /** The time the clock last read. It changes at each midnight in the zone and on each return. */
  now: ReadonlySignal<Date>
  /**
   * Read the clock again, set a timer for the next midnight in the zone, and re-read the clock
   * whenever the page becomes visible.
   *
   * @returns The function that clears the timer and removes the listener. Calling it twice is
   * harmless.
   */
  start(): () => void
}

/** The runtime's own zone, or `UTC` when it reports none. */
function runtimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

/** The first instant of the calendar day after the one `ms` falls on in `zone`. */
function nextDayStart(ms: number, zone: string): number {
  const tomorrow = addDays(isoDateInTz(new Date(ms), zone), 1, zone)
  // A zone that skips midnight (a forward change at 00:00) starts the day at the shifted-forward
  // instant, which `resolveWallClock` returns for a gap.
  return resolveWallClock(tomorrow, "00:00", zone).instant.getTime()
}

/**
 * Create a store holding the current time. It reads the clock once for its first value and sets
 * no timer until {@link NowStore.start} runs. In a component, {@link useNow} does both.
 *
 * @example
 * ```ts
 * const clock = createNow({ zone: "Europe/Berlin" })
 * const stop = clock.start()
 * const today = computed(() => isoDateInTz(clock.now.value, "Europe/Berlin"))
 * ```
 */
export function createNow(options: NowOptions = {}): NowStore {
  const zone = options.zone ?? runtimeZone()
  if (!isValidTimeZone(zone)) throw new RangeError(`createNow: unknown time zone "${zone}"`)
  const clock = options.clock ?? { now: () => Date.now() }
  const now = signal(new Date(clock.now()))

  function start(): () => void {
    const timers = options.timers ?? globalThis
    const visibility = options.visibility !== undefined
      ? options.visibility
      : (globalThis as { document?: NowVisibility }).document ?? null
    let timer: number | undefined
    let stopped = false

    const refresh = (): void => {
      const ms = clock.now()
      now.value = new Date(ms)
      if (timer !== undefined) timers.clearTimeout(timer)
      // A timer that fires a moment early re-reads the old day and sets itself again, a
      // millisecond or so later, so the change still lands on the new day.
      timer = timers.setTimeout(refresh, Math.max(0, nextDayStart(ms, zone) - ms))
    }
    const onVisibility = (): void => {
      if (visibility?.visibilityState === "visible") refresh()
    }

    refresh()
    visibility?.addEventListener("visibilitychange", onVisibility)
    return () => {
      if (stopped) return
      stopped = true
      if (timer !== undefined) timers.clearTimeout(timer)
      visibility?.removeEventListener("visibilitychange", onVisibility)
    }
  }

  return { now, start }
}

/**
 * The current time, on a signal that changes at each midnight in `zone` and whenever the page
 * becomes visible again. The timer and the listener go when the component unmounts.
 *
 * The store is made once per zone: a new `zone` makes a new signal, while new `clock`, `timers` or
 * `visibility` ports on a later render are ignored.
 *
 * @example
 * ```tsx
 * function Today({ tasks, zone }: { tasks: Task[]; zone: string }) {
 *   const now = useNow({ zone })
 *   const today = isoDateInTz(now.value, zone)
 *   return <TaskList tasks={tasks.filter((task) => task.due === today)} />
 * }
 * ```
 */
export function useNow(options: NowOptions = {}): ReadonlySignal<Date> {
  const store = useMemo(() => createNow(options), [options.zone])
  useEffect(() => store.start(), [store])
  return store.now
}
