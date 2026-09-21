import { type Signal, useSignal, useSignalEffect } from "@preact/signals"
import { useEffect } from "preact/hooks"
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
 * parameter that has left the address takes its field back to `initialValue`. A change to a signal
 * writes the whole set back through the router.
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
  useEffect(() => {
    isInitializing.value = true
    for (const field of Object.values(fields)) {
      field.signal.value = resolveFilterValue(field, searchParams.get(field.urlParam))
    }
    isInitializing.value = false
  }, [search])

  // signals → URL. Values are read first so this effect stays subscribed to every filter even on
  // the runs it skips.
  useSignalEffect(() => {
    const pending = Object.values(fields).map((field) => [field, field.signal.value] as const)
    if (isInitializing.value) return

    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const [field, value] of pending) {
        if (shouldPersistFilter(field, value)) {
          next.set(field.urlParam, String(value))
        } else {
          next.delete(field.urlParam)
        }
      }
      return next
    })
  })

  const clearFilters = (): void => {
    for (const field of Object.values(fields)) {
      field.signal.value = field.initialValue
    }
  }

  return {
    filters: Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.signal]),
    ) as { [K in keyof T]: T[K]["signal"] },
    isInitializing,
    clearFilters,
  }
}
