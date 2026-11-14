// Not exported from the package: how `SiteSearch` loads, checks and searches a site's index.

import { type } from "arktype"
import { loadIndex, type SearchEntry, type SearchIndex, type SearchIndexJSON } from "@spy4x/search"

/** The longest query `onSearched` reports, in characters. */
export const MAX_REPORTED_QUERY = 64

/** One entry as `/search.json` holds it; keys the palette does not read pass through unchecked. */
const entrySchema = type({
  label: "string",
  "aliases?": "string[]",
  "keywords?": "string[]",
  "detail?": "string",
  "text?": "string",
  "group?": "string",
  "href?": "string",
  "id?": "string",
})

/** What `SearchIndex.toJSON()` writes: the entries and MiniSearch's own plain object. */
const payloadSchema = type({ entries: entrySchema.array(), index: "object" })

/**
 * The parsed body of `/search.json`, checked.
 *
 * @param data The parsed JSON.
 * @throws When it is not `{ entries, index }` with a `label` on every entry.
 */
export function parseSiteIndex(data: unknown): SearchIndexJSON {
  const payload = payloadSchema(data)
  if (payload instanceof type.errors) throw new Error(`Not a site search index: ${payload.summary}`)
  return payload as SearchIndexJSON
}

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
