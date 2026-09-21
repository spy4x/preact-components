import { batch, type Signal, useSignal, useSignalEffect } from "@preact/signals"
import { useEffect, useRef } from "preact/hooks"
import { useSearchParams } from "wouter-preact"

/**
 * `@preact-components/signals/use-url-filters` — two-way binding between URL parameters and filter
 * signals.
 *
 * Ported from `template/libs/client/preact/use-url-filters.ts`. The template version registered its
 * `popstate` listener inside the wrong effect — the handler was never attached, and the returned
 * cleanup belonged to a listener that did not exist — so browser back/forward left the filters
 * stale. That listener is gone here rather than repaired: the router already re-renders this hook on
 * `popstate`, `pushState`, `replaceState` and `hashchange`, and the URL-to-signals effect below is
 * keyed on the search string it hands over, so every one of those arrives by the same path. A
 * hand-written listener reading `globalThis.location.search` would also read the wrong half of the
 * address under a router whose search comes from the fragment.
 *
 * The value coercion is pulled out into {@link resolveFilterValue} so it can be tested without a
 * DOM. Everything else here is an effect, and `pages/checks/signals.ts` is where those are proven —
 * no test in this repository executes one.
 */

/** One filter, bound to one URL parameter. */
export interface FilterField<T = string | number | null> {
  /** The signal the UI reads and writes. */
  signal: Signal<T>
  /** Name of the query parameter this field round-trips through. */
  urlParam: string
  /** Value that means "no filter"; cleared from the URL rather than written to it. */
  initialValue: T
  /** Custom URL-to-value coercion. Defaults to `parseInt` for numbers, identity otherwise. */
  parser?: (value: string | null) => T
}

/** Result of {@link useUrlFilters}. */
export interface UrlFilters<T extends Record<string, FilterField>> {
  /** The signals, keyed as they were passed in. */
  filters: { [K in keyof T]: T[K]["signal"] }
  /** True while the URL is being read into the signals, before they may write back. */
  isInitializing: Signal<boolean>
  /** Reset every filter to its default, which also clears it from the URL. */
  clearFilters: () => void
}

/**
 * Value a URL parameter implies for one field.
 *
 * A missing parameter means the default. A number field parses with `parseInt`, falling back to the
 * default rather than to `NaN` when the parameter is junk — which is what the template version did
 * with `isNaN`, kept here because a `?page=abc` URL is a real thing users end up with.
 */
export function resolveFilterValue<T>(field: FilterField<T>, raw: string | null): T {
  if (raw === null) return field.initialValue
  if (field.parser) return field.parser(raw)
  if (typeof field.initialValue === "number") {
    const parsed = Number.parseInt(raw, 10)
    // Both branches narrow a generic `T` from a value whose runtime type the check above establishes;
    // TypeScript cannot carry that check back to `T`.
    return (Number.isNaN(parsed) ? field.initialValue : parsed) as T
  }
  return (raw || field.initialValue) as T
}

/** Whether a value belongs in the URL: not the default, not `null`, not the empty string. */
export function shouldPersistFilter<T>(field: FilterField<T>, value: T): boolean {
  return value !== field.initialValue && value !== null && value !== ""
}

/** What one filter does to its own query parameter: set it, or — with no `value` — remove it. */
export interface FilterWrite {
  /** Name of the query parameter. */
  urlParam: string
  /** What to write, or `undefined` to take the parameter out of the query string. */
  value?: string
}

/**
 * What one field's value means for its parameter.
 *
 * @param field The field.
 * @param value Its current value.
 * @returns The parameter written, or removed when the value is one {@link shouldPersistFilter}
 *          keeps out of the address.
 */
export function filterWrite<T>(field: FilterField<T>, value: T): FilterWrite {
  return {
    urlParam: field.urlParam,
    value: shouldPersistFilter(field, value) ? String(value) : undefined,
  }
}

/**
 * The query string a set of filter values implies, starting from the one the address already has.
 *
 * Three rules live here, and they are the whole of what a write does — which is why this is a
 * function over two strings rather than something only a browser can run.
 *
 * - A parameter the caller says nothing about is **carried through untouched**. An application's
 *   address holds more than one component's filters — a tab, a sort, a campaign tag — and a write
 *   that rebuilt the query string from nothing would delete other people's state. A repeated key
 *   (`?tag=a&tag=b`) survives the same way, as long as no filter owns that name.
 * - A filter holding its default is **removed**, so an unfiltered list has a clean address.
 * - Everything else is **set**.
 *
 * One cosmetic cost of rebuilding through `URLSearchParams`: a carried parameter comes back in that
 * class's own spelling, so `q=x%20y` reads as `q=x+y` after the first write. Both decode to the
 * same thing, and a read alone never rewrites anything, so nothing is lost but the spelling.
 *
 * @param search The query string to start from, with or without its leading `?`.
 * @param writes What each filter does to its own parameter.
 * @returns The query string, with no leading `?`.
 */
export function filterSearch(search: string, writes: readonly FilterWrite[]): string {
  const next = new URLSearchParams(search)
  for (const { urlParam, value } of writes) {
    if (value === undefined) next.delete(urlParam)
    else next.set(urlParam, value)
  }

  return next.toString()
}

/**
 * Bind filter signals to URL parameters.
 *
 * Call it with fields built from `useSignal`, so the signals outlive the component and a sibling
 * can read the active filters:
 *
 * ```tsx
 * const status = useSignal("")
 * const page = useSignal(1)
 * const { filters, clearFilters } = useUrlFilters({
 *   status: { signal: status, urlParam: "status", initialValue: "" },
 *   page: { signal: page, urlParam: "page", initialValue: 1 },
 * })
 * ```
 *
 * The binding runs both ways for as long as the component is mounted. Any change to the address the
 * router reports — a link, a push, back, forward — re-reads every parameter into its signal, and a
 * parameter that has left the address takes its field back to `initialValue`. A filter changing in
 * the page writes the whole set back through the router; a parameter belonging to anything else on
 * the page is carried through that write untouched (see {@link filterSearch}).
 *
 * **Reading the address never writes to it.** A filter changing in the page is the only thing that
 * does. That matters most for an address this hook would spell differently — a filter written out
 * at its default (`?page=1`), a value a `parser` rejects (`?size=huge`), an empty value
 * (`?status=`) — which is left exactly as it arrived rather than tidied up. The filters follow it,
 * the address bar keeps the redundant parameter, and the first real filter change rewrites the
 * query string canonically.
 *
 * The alternative, rewriting on arrival, is what this hook used to do, and it cost two things a
 * reader notices: a deep link to `?page=1` gained a history entry nobody asked for, so pressing
 * Back landed on the address the hook had just rewritten and was rewritten again — Back went
 * nowhere — and on a fragment-routed page the rewrite took the route with it.
 *
 * **A write that does happen replaces the whole address.** The router's `navigate` pushes
 * `pathname?search`, which carries no fragment, so a page keeping anything in the fragment — a hash
 * route, an anchor — loses it when a filter changes. Arriving, reading and remounting leave both
 * halves of the address alone; changing a filter does not.
 *
 * **One address change costs one history entry**, whichever direction it came from, so one press of
 * Back moves the reader once. `clearFilters` is one change, not one per field.
 */
export function useUrlFilters<T extends Record<string, FilterField>>(fields: T): UrlFilters<T> {
  const [searchParams, setSearchParams] = useSearchParams()
  const isInitializing = useSignal(true)

  // URL → signals, re-read whenever the router's search string changes.
  //
  // A plain effect keyed on that string, and not `useSignalEffect`: in the pinned
  // `@preact/signals` 2.5.1 `useSignalEffect` is `useEffect(…, [])` whose body re-runs only when a
  // signal it *read* changes, and this body reads none. So the filters used to be read out of the
  // address once, at mount, and a route pushed afterwards left them showing the previous route's
  // values while the address bar showed the new one.
  //
  // `searchParams` is the router's own `useMemo(() => new URLSearchParams(search), [search])`, so
  // its `toString()` moves exactly when the router's search string does. Two spellings of the same
  // parameters — `?q=a%20b` and `?q=a+b` — normalise to one string and do not re-run the effect,
  // which is correct: they resolve to the same filter values.
  const search = searchParams.toString()

  // Two strings the effects below need and a render is the only place to catch.
  //
  // `latestSearch` is the address as the router last reported it: what a write starts from, so that
  // a parameter this hook does not own is carried across it. The callback form of `setSearchParams`
  // would hand the same thing over, but only once the decision to navigate has already been taken.
  //
  // `agreed` is the query string the filters implied the last time they read the address — the
  // canonical spelling of what they now hold. The write compares against *that* rather than against
  // the address, which is what makes reading harmless: an address spelt differently from the way
  // the filters would spell it (`?page=1`, `?size=huge`) produces no write, while a filter that
  // actually changes always produces one, including the change `clearFilters` makes.
  //
  // Both are also assigned by the write itself, so two writes in one tick each start from what the
  // one before them left.
  const latestSearch = useRef(search)
  latestSearch.current = search
  const agreed = useRef(search)

  useEffect(() => {
    isInitializing.value = true
    for (const field of Object.values(fields)) {
      field.signal.value = resolveFilterValue(field, searchParams.get(field.urlParam))
    }
    agreed.current = filterSearch(
      search,
      Object.values(fields).map((field) => filterWrite(field, field.signal.value)),
    )
    isInitializing.value = false
  }, [search])

  // signals → URL. Values are read first so this effect stays subscribed to every filter even on
  // the runs it skips.
  //
  // The read above flips `isInitializing`, which re-runs this effect after every address change —
  // including the ones this effect made. Without a comparison it would write every time: each
  // address change cost two history entries instead of one, so the browser's Back button did
  // nothing the first time it was pressed, and the write at mount replaced the whole address,
  // taking any fragment the page was carrying with it.
  useSignalEffect(() => {
    const pending = Object.values(fields).map((field) => filterWrite(field, field.signal.value))
    if (isInitializing.value) return

    const next = filterSearch(latestSearch.current, pending)
    if (next === agreed.current) return

    latestSearch.current = next
    agreed.current = next
    setSearchParams(new URLSearchParams(next))
  })

  // One `batch`, so the effect above runs once and clearing costs the reader one history entry
  // rather than one per field that was set.
  const clearFilters = (): void => {
    batch(() => {
      for (const field of Object.values(fields)) {
        field.signal.value = field.initialValue
      }
    })
  }

  return {
    filters: Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.signal]),
    ) as { [K in keyof T]: T[K]["signal"] },
    isInitializing,
    clearFilters,
  }
}
