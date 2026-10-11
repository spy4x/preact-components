/**
 * The private half of a `LeaveGuard`: what `UnsavedGuard` drives its dialog with. It is not an
 * entry point of the package. An app sees only `LeaveGuard.navigate`.
 */

import { signal } from "@preact/signals"

/**
 * The question "leave with unsaved changes?" for navigation an app starts from code: a sidebar
 * button, a keyboard shortcut, a redirect. The app creates one with {@link createLeaveGuard}, gives
 * it to its `UnsavedGuard` as `leaveGuard`, and wraps its own navigation in `navigate`.
 */
export interface LeaveGuard {
  /**
   * Runs `go` at once when no `UnsavedGuard` with unsaved changes shares this guard. Otherwise it
   * asks first, in that guard's dialog: "Leave" runs `go`, "Stay" drops it.
   *
   * A call that arrives while the question is already on screen replaces the earlier `go`: the
   * dialog stays as it is, and "Leave" runs only the newest one.
   *
   * @param go The navigation itself, such as `() => setLocation("/lists")`.
   */
  navigate(go: () => void): void
}

/** What `UnsavedGuard` does with a {@link LeaveGuard}; reached through {@link leaveGuardInternals}. */
export interface LeaveGuardInternals {
  /**
   * Marks unsaved changes on behalf of `holder`, until the returned function is called. When the
   * last holder lets go, a navigation still waiting is dropped.
   *
   * @param holder Any object that stands for the caller, compared by identity.
   * @returns The function that lets go. Calling it twice does nothing more.
   */
  hold(holder: object): () => void
  /**
   * Whether `holder` is the earliest one still holding: the one guard that asks, and the one that
   * holds a history step back, however many guards share this `LeaveGuard`.
   */
  leads(holder: object): boolean
  /**
   * Whether `holder` should show the question now: a navigation is waiting and `holder` is the
   * earliest one still holding, so two guards that share a `LeaveGuard` never show two dialogs. It
   * reads signals, so a component that calls it while rendering re-renders when the answer changes.
   */
  asks(holder: object): boolean
  /**
   * Answers "Leave": closes the question and hands the waiting navigation to the caller, who runs
   * it. Handing it out first means nothing the caller does in between, such as dropping the
   * changes and unmounting the guard, can lose it.
   *
   * @returns The waiting navigation, or `null` when none waits.
   */
  take(): (() => void) | null
  /** Answers "Stay": closes the question and drops the waiting navigation. */
  stay(): void
}

const internals = new WeakMap<LeaveGuard, LeaveGuardInternals>()

/**
 * Creates a {@link LeaveGuard}. Create one for the app, outside any component, so the code that
 * navigates and the `UnsavedGuard` that asks share it.
 *
 * It knows no router and touches no global: the app passes its own navigation to `navigate` each
 * time.
 */
export function createLeaveGuard(): LeaveGuard {
  const holders = signal<readonly { holder: object }[]>([])
  const waiting = signal<(() => void) | null>(null)
  const guard: LeaveGuard = {
    navigate(go) {
      if (holders.value.length === 0) go()
      else waiting.value = go
    },
  }
  internals.set(guard, {
    hold(holder) {
      // Its own entry, so a release called twice cannot let go of a later hold by the same holder.
      const entry = { holder }
      holders.value = [...holders.value, entry]
      return () => {
        if (!holders.value.includes(entry)) return
        holders.value = holders.value.filter((other) => other !== entry)
        if (holders.value.length === 0) waiting.value = null
      }
    },
    leads: (holder) => holders.value[0]?.holder === holder,
    asks: (holder) => waiting.value !== null && holders.value[0]?.holder === holder,
    take() {
      const go = waiting.value
      waiting.value = null
      return go
    },
    stay() {
      waiting.value = null
    },
  })
  return guard
}

/**
 * The private half of a guard that {@link createLeaveGuard} made.
 *
 * @throws When `guard` is any other object: only `createLeaveGuard` can make a `LeaveGuard`.
 */
export function leaveGuardInternals(guard: LeaveGuard): LeaveGuardInternals {
  const found = internals.get(guard)
  if (!found) {
    throw new Error("UnsavedGuard: `leaveGuard` must be an object that createLeaveGuard() returned")
  }
  return found
}

/**
 * Whether a history step from one address to another leaves the page a form is on: the path or the
 * query differs. A step that changes only the fragment stays on the page, as a link to a fragment of
 * the same page does.
 *
 * @param from The address before the step, absolute.
 * @param to The address after it, absolute.
 */
export function leavesPage(from: string, to: string): boolean {
  const before = new URL(from)
  const after = new URL(to)
  return before.pathname !== after.pathname || before.search !== after.search
}

/** One entry of the tab's history, as the Navigation API describes it. */
interface HistoryEntry {
  /** The entry's name, the same for as long as the entry exists. */
  key: string
  /** The entry's address; `null` when the browser hides it. */
  url: string | null
}

/** The parts of the browser's `navigation` object the guard reads. It cancels nothing through it. */
interface HistoryEntries extends EventTarget {
  currentEntry: HistoryEntry | null
}

/**
 * Holds back the browser's Back and Forward buttons while a form has unsaved changes, until the
 * returned function is called. A step that would leave the page is answered at once by a new
 * history entry with the page's own address and state, and handed to `ask` as the function that
 * repeats the step: one step back from that new entry, which is where the person went.
 *
 * It listens for the Navigation API's `currententrychange`, not for `popstate`. A router listens
 * for `popstate` and was there first, and a browser may call the listeners of `window` in the
 * order they were added, so the router would draw the other page, and unmount the form, before a
 * `popstate` listener of the guard's ran at all. `currententrychange` comes before `popstate`, and
 * adding an entry takes effect at once, so by the time the router looks, the address is the form's
 * again and it draws nothing new. In a browser without the Navigation API (Safari before 26.2,
 * Firefox before 147) nothing is held.
 *
 * It leaves alone a step inside the page (only the fragment changes) and the step `ask`'s function
 * itself takes. A step to another document never reaches it: the browser unloads the page, and
 * `beforeunload` asks.
 *
 * @param leads Whether this hold is the one that acts now. The others keep track and do nothing.
 * @param ask Called with the function that repeats the step the person took.
 * @returns The function that stops holding.
 */
export function holdHistory(leads: () => boolean, ask: (go: () => void) => void): () => void {
  const entries = (globalThis as { navigation?: HistoryEntries }).navigation
  if (!entries?.currentEntry) return () => {}
  const read = () => ({ url: location.href, state: history.state as unknown })
  /** The address and state of the entry the form is on. */
  let here = read()
  /** The entry "Leave" steps back to, until it arrives there. */
  let leavingTo: string | null = null
  const onEntryChange = (event: Event) => {
    const now = entries.currentEntry
    const travelled = (event as Event & { navigationType?: string }).navigationType === "traverse"
    if (
      travelled && now && now.key !== leavingTo && leads() && leavesPage(here.url, location.href)
    ) {
      const { key } = now
      history.pushState(here.state, "", here.url)
      ask(() => {
        leavingTo = key
        history.back()
      })
      return
    }
    // The app or a link moved inside the page, or this is where "Leave" was going: the form, if it
    // is still there, is on this entry now.
    leavingTo = null
    here = read()
  }
  entries.addEventListener("currententrychange", onEntryChange)
  return () => entries.removeEventListener("currententrychange", onEntryChange)
}
