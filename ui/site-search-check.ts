// Not exported from the package: the check of a site's index, which `fetchSiteIndex` imports only
// when it fetches one, so arktype stays out of the code a page loads up front.

import { type } from "arktype"
import type { SearchIndexJSON } from "@spy4x/search"

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
