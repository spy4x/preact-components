/**
 * The address rules behind `useUrlFilters`, apart from the hook so they can be tested without a
 * DOM. Not an entry point of the package: an app imports `./use-url-filters.ts` alone.
 *
 * @module
 */
import { batch } from "@preact/signals"
import { type FilterField, resolveFilterValue, shouldPersistFilter } from "./use-url-filters.ts"

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
 * Take every field back to its default, as **one** change.
 *
 * The `batch` is the point. Preact's signals adapter already batches writes made inside an event
 * handler, so a clear driven by a button behaves this way with or without it — measured on the
 * Pages demo: one `pushState` either way. An application that clears from a timer, or after a
 * request comes back, is outside that adapter's reach, and there each field would be a change of
 * its own: a write per field, a history entry per field, and a reader who has to press Back once
 * per filter to undo one clear. `use-url-filters.test.ts` is where that is held.
 *
 * @param fields The fields to reset.
 */
export function clearFilterFields<T extends Record<string, FilterField>>(fields: T): void {
  batch(() => {
    for (const field of Object.values(fields)) {
      field.signal.value = field.initialValue
    }
  })
}

/**
 * The query string a set of filter values implies, starting from the one the address already has.
 *
 * Three rules live here, and they are the whole of what a write does **to the query string** —
 * which is why this is a function over two strings rather than something only a browser can run.
 * What the write then does to the rest of the address is {@link restoredAddress}.
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

/** An address as `location` reports it, in the four pieces this hook has to read. */
export interface AddressParts {
  /** `location.pathname`: the path, including whatever base path the site is served under. */
  pathname: string
  /** `location.search`: the query string with its leading `?`, or empty. */
  search: string
  /** `location.hash`: the fragment with its leading `#`, or empty. */
  hash: string
  /**
   * `location.href`: the whole address. It is here for one distinction the other three cannot
   * make. An address ending in a bare `?` — which is what the router leaves behind when a write
   * empties the query string, because it navigates to `pathname + "?" + ""` — reports `search` as
   * the empty string, exactly like an address with no query string at all.
   */
  href: string
}

/**
 * The address the write should have left behind, or `undefined` when that is already the address.
 *
 * Two things are wrong with the address the router leaves, and both are things it appends or drops
 * that no filter asked it to.
 *
 * **The fragment.** The router's `navigate` is handed `pathname?search` and nothing else, and a
 * target with no `#` resolves to an address with no fragment — measured in Chromium:
 * `history.pushState(null, "", "/x?y=1")` on `/x#anchor` leaves `location.hash` empty. So the write
 * is followed by a question this function answers: did the address just lose a fragment it had a
 * moment ago, and what is the address that has it again?
 *
 * **The bare `?`.** A write that empties the query string — clearing the last filter — navigates to
 * `pathname + "?" + ""`, and the address keeps that question mark with nothing after it. Left
 * alone, an address with a fragment and one without would end a clear differently (`/list#section`
 * against `/list?`), for no reason a reader could see, so the same step takes it off.
 *
 * The condition is a **measurement of the address**, not a guess about which location hook the
 * router is using, and that is the point of doing it after the write rather than before. A router
 * that keeps its own location in the fragment — wouter's `useHashLocation` — sets the fragment as
 * part of navigating, so `after.hash` is not empty and this function answers `undefined`, leaving
 * that router's own write alone. Handing the fragment to `navigate` instead would have corrupted
 * exactly that case: `useHashLocation`'s navigate splits its target on `?`, so the fragment lands
 * percent-encoded inside the query string (`?page=2%23/list`). No browser check in this repository
 * exercises that guard, because the demo runs one router: proving it would take a second router on
 * the page whose own navigation sets a different fragment. `use-url-filters.test.ts` holds it at
 * the level this function works at, which is the address rather than the router.
 *
 * Everything is rebuilt from the address the write left behind, so a base path needs no special
 * handling: it is already in `after.pathname`, whether it came from the site's own prefix or from a
 * router `base`. The fragment is copied across verbatim, which is what a fragment carrying its own
 * `?`, `&` or `=` — a hash route such as `#/list?tab=2` — needs.
 *
 * @param fragment The fragment as it was immediately before the write, `#` included, or empty.
 * @param after The address the write left behind.
 * @returns The address to replace the current history entry with, or `undefined` for no change.
 */
export function restoredAddress(fragment: string, after: AddressParts): string | undefined {
  // Documented insurance rather than a proven branch: no browser check reaches this line, and
  // making one would take a second router on the demo page that sets a different fragment while
  // navigating. What holds it is `use-url-filters.test.ts`, over the address alone.
  if (after.hash !== "") return undefined
  if (fragment === "" && !after.href.endsWith("?")) return undefined
  return `${after.pathname}${after.search}${fragment}`
}

/**
 * Read the address into the filters, and answer with the query string they now agree on.
 *
 * Every field takes the value its parameter implies (see {@link resolveFilterValue}), with one
 * exception, and the exception is why this takes `held`. The hook reads the address in an effect, a
 * frame after the render that reported it, and writes a changed filter to the address a frame after
 * the change. A reader can change a filter inside either gap: a field focused the moment it appears
 * takes the first key press before the first read, and a key pressed while typing fast lands
 * between the last write and the next read. Overwriting that value from the address would lose the
 * key press. So a field whose signal no longer holds the value in `held` keeps its value. The
 * answer is still the query string the *address* implies, which is what makes the hook's write
 * effect see the kept value as a change and write it to the address. The same holds for a filter a
 * child component sets in its own mount effect, which runs before the first read: it beats the
 * address too.
 *
 * Every other field loads from the address and its entry in `held` is set to what it loaded, so
 * the next read compares against this one. Back, forward, a link and a push therefore win for every
 * field the reader has not changed in the last frame.
 *
 * Without `held`, the address wins for every field.
 *
 * @param fields The fields, keyed as the hook was given them.
 * @param search The query string the router reports, with or without its leading `?`.
 * @param held What each field's signal held when the filters and the address last agreed, by the
 *             same keys: at the first render, after a read, after a write. Updated in place for
 *             each field this read loads.
 * @returns The query string the address implies for these fields — what the write compares against.
 */
export function readAddress<T extends Record<string, FilterField>>(
  fields: T,
  search: string,
  held?: Record<string, unknown>,
): string {
  const params = new URLSearchParams(search)
  const writes: FilterWrite[] = []
  for (const [key, field] of Object.entries(fields)) {
    const fromAddress = resolveFilterValue(field, params.get(field.urlParam))
    writes.push(filterWrite(field, fromAddress))
    if (held !== undefined && key in held && !Object.is(field.signal.peek(), held[key])) continue
    field.signal.value = fromAddress
    if (held !== undefined) held[key] = fromAddress
  }
  return filterSearch(search, writes)
}
