/**
 * The route echo: the catalogue's route table, embedded in the one `index.html` this demo ships.
 *
 * With hash routing there is exactly one document, so "emitting a route" is not writing a file per
 * route — it is writing the table of routes the navigation links to into the document, where the
 * build reads it back and holds every entry against the resolver that has to accept it. A link the
 * resolver would not accept fails `pages/build.ts` instead of shipping.
 *
 * The reading half is validated with `arktype` rather than cast, because the payload it parses is
 * the one thing here that could arrive malformed: a hand-edited document, a truncated write, a
 * reordering of the template. Shape is `arktype`'s job; *identity* — that the ids and names are the
 * catalogue's — is {@link routeTableDrift}'s, which is why the schema validates strings and not the
 * `SectionId` union: an id no section has must be reported, not rejected at parse time as if the
 * document were unreadable.
 *
 * Nothing here reaches the browser bundle: `document.tsx` and `build.ts` are the only importers, and
 * neither is an island entry point.
 */

import { type } from "arktype"
import type { RouteTable } from "@spy4x/preact-ui-guide/routes"

/** `id` of the echo element. The one string both halves have to agree on. */
export const ROUTE_TABLE_ID = "ui-guide-routes"

/** Shape of one echoed page route. */
const pageEntrySchema = type({ pageId: "string", href: "string" })

/** Shape of one echoed section route. */
const sectionEntrySchema = type({ sectionId: "string", slug: "string", href: "string" })

/** Shape of one echoed demo route. */
const demoEntrySchema = type({
  sectionId: "string",
  sectionSlug: "string",
  name: "string",
  slug: "string",
  href: "string",
})

/** Shape of the whole payload: the three arrays {@link RouteTable} declares. */
export const routeTableSchema = type({
  pages: pageEntrySchema.array(),
  sections: sectionEntrySchema.array(),
  demos: demoEntrySchema.array(),
})

/**
 * Render one table as the echo element.
 *
 * `<` is escaped to its `\u003c` form so the payload cannot close the script element it lives in —
 * the values are identifiers, so nothing today contains one, but a template that can be broken by
 * its own data is not worth keeping. The result is a `<script type="application/json">`, which the
 * browser parses as data and never executes.
 *
 * @param table Route table to echo, normally `routeTable()`.
 * @returns The element as markup, for `document.tsx` to place in the document.
 */
export function renderRouteTable(table: RouteTable): string {
  const json = JSON.stringify(table).replaceAll("<", "\\u003c")
  return `<script type="application/json" id="${ROUTE_TABLE_ID}">${json}</script>`
}

/**
 * Read the echo back out of a rendered document.
 *
 * @param html The document's markup.
 * @returns The route table it carries.
 * @throws When the document carries no echo, when the payload is not JSON, or when it is not the
 * shape {@link routeTableSchema} declares — each naming what it saw, because "the build failed"
 * without the offending field is not a diagnosis.
 */
export function routeTableFromHtml(html: string): RouteTable {
  // `[\s\S]` rather than `.` so a payload formatted across lines is read whole.
  const match = html.match(
    new RegExp(`<script type="application/json" id="${ROUTE_TABLE_ID}">([\\s\\S]*?)</script>`),
  )
  if (!match) {
    throw new Error(`the document carries no route echo (no element with id "${ROUTE_TABLE_ID}")`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(match[1])
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`the route echo is not JSON: ${reason}`)
  }

  const table = routeTableSchema(parsed)
  if (table instanceof type.errors) {
    throw new Error(`the route echo is not a route table: ${table.summary}`)
  }

  return table
}
