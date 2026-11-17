// Not exported from the package: how `SiteSearch` loads, checks and searches a site's index.

import { loadIndex, type SearchEntry, type SearchIndex } from "@spy4x/search"

/** The longest query `onSearched` reports, in characters. */
export const MAX_REPORTED_QUERY = 64

/**
 * Whether a result may link to `href`: a `mailto:` address, or an address on the page's own origin
 * over HTTP or HTTPS, such as `/blog/post` or `#pricing`. `javascript:`, `data:` and another site's
 * address are not, nor `//other.example`, nor a path a tab or a backslash turns into one.
 *
 * @param href The entry's `href`.
 * @param base The page's address, `location.href`.
 */
export function isSiteHref(href: string | undefined, base: string): boolean {
  if (href === undefined) return false
  if (/^mailto:/i.test(href)) return true
  try {
    const url = new URL(href, base)
    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === new URL(base).origin
  } catch {
    return false
  }
}

/** A loaded index and how many of its entries no result may show. */
export interface SiteIndex {
  index: SearchIndex
  /** Entries without a link `isSiteHref` allows; searches ask for this many more hits. */
  blocked: number
}

/**
 * Fetches and loads a site's prebuilt index.
 *
 * @param get The caller's `fetch`.
 * @param src Where the index is, such as `/search.json`.
 * @param base The page's address, `location.href`.
 * @throws When the answer is not 2xx or not an index.
 */
export async function fetchSiteIndex(
  get: (src: string) => Promise<Response>,
  src: string,
  base: string,
): Promise<SiteIndex> {
  const response = await get(src)
  if (!response.ok) throw new Error(`${src} answered ${response.status}`)
  // A dynamic import, so a bundler splits arktype into a chunk fetched with the index, not on page
  // load: arktype is about 157 KB, and its `new Function` probe trips a strict CSP.
  const { parseSiteIndex } = await import("./site-search-check.ts")
  const json = parseSiteIndex(await response.json())
  const blocked = json.entries.filter((entry) => !isSiteHref(entry.href, base)).length
  return { index: loadIndex(json), blocked }
}

/** What {@link searchSite} found. */
export interface SiteHits {
  /** Up to `limit` entries, best first, each with a link `isSiteHref` allows. */
  entries: (SearchEntry & { href: string })[]
  /** The alias each entry was found by, in the same order. */
  aliases: (string | undefined)[]
  /** The body text around each entry's first matched word, in the same order. */
  snippets: (string | undefined)[]
  correction?: "layout" | "typo"
}

/**
 * The best `limit` entries for `query` that a result may link to.
 *
 * @param site The loaded index.
 * @param query What the reader typed.
 * @param limit How many rows the palette shows.
 * @param base The page's address, `location.href`.
 */
export function searchSite(site: SiteIndex, query: string, limit: number, base: string): SiteHits {
  const found = site.index.search(query, { limit: limit + site.blocked })
  const hits = found.hits.filter((hit) => isSiteHref(hit.entry.href, base)).slice(0, limit)
  return {
    entries: hits.map((hit) => hit.entry as SearchEntry & { href: string }),
    aliases: hits.map((hit) => hit.alias),
    snippets: hits.map((hit) => hit.snippet?.map((part) => part.text).join("")),
    correction: found.correction,
  }
}

/**
 * The query as `onSearched` reports it: trimmed, and cut to {@link MAX_REPORTED_QUERY} characters
 * without splitting one.
 *
 * @param query What the reader typed.
 */
export function reportedQuery(query: string): string {
  return [...query.trim()].slice(0, MAX_REPORTED_QUERY).join("")
}

/**
 * `options` with the groups `order` names first, in that order, then the rest as they came.
 *
 * @param options The palette's rows.
 * @param order Group names, first to last.
 */
export function orderGroups<T extends { group?: string }>(
  options: readonly T[],
  order: readonly string[],
): T[] {
  // Unheaded rows first, as the palette lists them; then the named groups; then the rest.
  const rank = (option: T) =>
    option.group === undefined ? -1 : (order.indexOf(option.group) + 1 || order.length + 1)
  return options.map((option, index) => ({ option, index, rank: rank(option) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((ranked) => ranked.option)
}

/**
 * What a query lists: its `rows`, or `fallback` when a typed query found nothing, so the reader
 * still has a way forward. An empty query keeps its rows, even none.
 *
 * @param rows The results and commands the query found.
 * @param fallback The commands listed instead of nothing.
 * @param query What the reader typed, trimmed.
 */
export function withFallback<T>(
  rows: readonly T[],
  fallback: readonly T[],
  query: string,
): { rows: readonly T[]; fellBack: boolean } {
  const fellBack = query !== "" && rows.length === 0 && fallback.length > 0
  return { rows: fellBack ? fallback : rows, fellBack }
}
