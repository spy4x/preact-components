/**
 * The route table the guide's own build echoes into its document and reads back, and the check that
 * holds it to the route model. Not an entry point of the package: only this repository's `pages/`
 * build, its browser checks and the tests import it.
 *
 * @module
 */

import { type CatalogueSection, catalogueSections, guidePageIds } from "./registry.ts"
import {
  demoHref,
  pageHref,
  pageOfRoute,
  parseRoute,
  routeHref,
  type RouteMatch,
  routeSlug,
} from "./routes.ts"

/** One section's route, as the emitted route table carries it. */
export interface SectionRouteEntry {
  /** The section, as `registry.ts` identifies it. */
  sectionId: string
  /** Canonical slug. */
  slug: string
  /** Canonical href. */
  href: string
}

/** One demo's route, as the emitted route table carries it. */
export interface DemoRouteEntry {
  /** Section the demo lives in. */
  sectionId: string
  /** That section's slug. */
  sectionSlug: string
  /** Component export name, or a class card's id. */
  name: string
  /** Canonical slug of the demo. */
  slug: string
  /** Canonical href. */
  href: string
}

/** One page's route, as the emitted route table carries it. */
export interface PageRouteEntry {
  /** The page, as `registry.ts` identifies it. */
  pageId: string
  /** Canonical href. */
  href: string
}

/**
 * The routes the deployed document echoes: one entry per page, per section and per demo.
 *
 * Every field is a `string` on purpose: this is the shape a JSON echo parses back into, and the whole
 * point of {@link routeTableDrift} is to hold those strings against the real section ids and demo
 * names. A table already narrowed to `SectionId` could not report an id the catalogue has never
 * heard of, which is one of the failures the build has to be able to name.
 */
export interface RouteTable {
  pages: PageRouteEntry[]
  sections: SectionRouteEntry[]
  demos: DemoRouteEntry[]
}

/**
 * The route table for a set of sections: every section's route, then every demo's.
 *
 * This is what `pages/src/document.tsx` embeds in the single `index.html` and what `pages/build.ts`
 * re-reads out of the emitted document, so the links the navigation writes are checked against the
 * resolver that has to accept them. Nothing reads it at runtime — the cost of the echo is a few
 * kilobytes of JSON in the document, paid for a build that cannot ship a link the page would not
 * open.
 *
 * @param sections Sections to build routes for; defaults to the catalogue's.
 * @returns The table, in render order.
 */
export function routeTable(sections: readonly CatalogueSection[] = catalogueSections): RouteTable {
  return {
    pages: guidePageIds.map((pageId) => ({ pageId, href: pageHref(pageId) })),
    sections: sections.map((section) => ({
      sectionId: section.id,
      slug: routeSlug(section.id),
      href: routeHref(section.id),
    })),
    demos: sections.flatMap((section) =>
      section.names.map((name) => ({
        sectionId: section.id,
        sectionSlug: routeSlug(section.id),
        name,
        slug: routeSlug(name),
        href: demoHref(section.id, name),
      }))
    ),
  }
}

/**
 * Read an emitted route table back and report every entry the resolver would not accept.
 *
 * The build's guard, and the reason the echo exists: `pages/build.ts` hands the table it just wrote
 * into the document back to this function, and a non-empty result fails the build. Each message
 * names the offending entry — the href it emitted and what the resolver did with it — because a
 * guard that reports "the table drifted" without saying which link is broken is not a detection.
 *
 * Four kinds of drift are reported, in both halves: an entry whose href does not resolve back to its
 * own section or demo, an entry that is not canonical (a slug or href the grammar would not write
 * itself), an id or name the catalogue does not have, an href emitted twice; and then whatever the
 * table is **missing** — a section or a demo with no entry at all, so a table that lost half its
 * rows cannot report agreement.
 *
 * @param table Table to check, normally read back out of the document.
 * @param sections Sections the table must agree with; defaults to the catalogue's.
 * @returns One message per problem, in table order; empty when every route round-trips.
 */
export function routeTableDrift(
  table: RouteTable,
  sections: readonly CatalogueSection[] = catalogueSections,
): string[] {
  const drift: string[] = []
  const emittedHrefs = new Set<string>()
  const emittedSections = new Set<string>()
  const emittedDemos = new Set<string>()
  const emittedPages = new Set<string>()

  // Pages first, in their own href set: a page whose id is a section's shares that section's href on
  // purpose, so a shared href is not drift here.
  for (const entry of table.pages) {
    const label = `page ${JSON.stringify(entry.pageId)} (${JSON.stringify(entry.href)})`
    const pageId = guidePageIds.find((id) => id === entry.pageId)
    if (!pageId) {
      drift.push(`${label}: no such page in the guide`)
      continue
    }
    if (emittedPages.has(pageId)) drift.push(`${label}: page emitted twice`)
    emittedPages.add(pageId)
    if (entry.href !== pageHref(pageId)) {
      drift.push(`${label}: not the canonical href ${JSON.stringify(pageHref(pageId))}`)
    }
    const opened = pageOfRoute(parseRoute(entry.href, sections), sections)
    if (opened !== pageId) drift.push(`${label}: opens page ${opened ?? "none"}`)
  }

  for (const entry of table.sections) {
    const label = `section ${JSON.stringify(entry.sectionId)} (${JSON.stringify(entry.href)})`
    if (emittedHrefs.has(entry.href)) drift.push(`${label}: href emitted twice`)
    emittedHrefs.add(entry.href)

    const section = sections.find((candidate) => candidate.id === entry.sectionId)
    if (!section) {
      drift.push(`${label}: no such section in the catalogue`)
      continue
    }

    emittedSections.add(section.id)
    const slug = routeSlug(section.id)
    if (entry.slug !== slug) {
      drift.push(`${label}: slug ${JSON.stringify(entry.slug)}, expected ${JSON.stringify(slug)}`)
    }
    if (entry.href !== routeHref(section.id)) {
      drift.push(`${label}: not the canonical href ${JSON.stringify(routeHref(section.id))}`)
    }
    const match = parseRoute(entry.href, sections)
    if (match.kind !== "section" || match.sectionId !== section.id || match.href !== entry.href) {
      drift.push(`${label}: resolves to ${describe(match)}`)
    }
  }

  for (const entry of table.demos) {
    const label = `demo ${JSON.stringify(entry.name)} in ` +
      `${JSON.stringify(entry.sectionId)} (${JSON.stringify(entry.href)})`
    if (emittedHrefs.has(entry.href)) drift.push(`${label}: href emitted twice`)
    emittedHrefs.add(entry.href)

    const section = sections.find((candidate) => candidate.id === entry.sectionId)
    if (!section) {
      drift.push(`${label}: no such section in the catalogue`)
      continue
    }

    emittedDemos.add(`${section.id}/${entry.name}`)
    const slug = routeSlug(section.id)
    if (entry.sectionSlug !== slug) {
      drift.push(
        `${label}: section slug ${JSON.stringify(entry.sectionSlug)}, expected ${
          JSON.stringify(slug)
        }`,
      )
    }
    if (!section.names.some((name) => name === entry.name)) {
      drift.push(`${label}: ${JSON.stringify(section.id)} demos no component of that name`)
    }
    if (entry.slug !== routeSlug(entry.name)) {
      drift.push(
        `${label}: slug ${JSON.stringify(entry.slug)}, expected ${
          JSON.stringify(routeSlug(entry.name))
        }`,
      )
    }
    if (entry.href !== demoHref(section.id, entry.name)) {
      drift.push(
        `${label}: not the canonical href ${JSON.stringify(demoHref(section.id, entry.name))}`,
      )
    }
    const match = parseRoute(entry.href, sections)
    if (
      match.kind !== "demo" || match.name !== entry.name || match.sectionId !== section.id ||
      match.href !== entry.href
    ) {
      drift.push(`${label}: resolves to ${describe(match)}`)
    }
  }

  for (const pageId of guidePageIds) {
    if (!emittedPages.has(pageId)) drift.push(`page ${JSON.stringify(pageId)}: no route emitted`)
  }

  for (const section of sections) {
    if (!emittedSections.has(section.id)) {
      drift.push(`section ${JSON.stringify(section.id)}: no route emitted`)
    }
    for (const name of section.names) {
      if (!emittedDemos.has(`${section.id}/${name}`)) {
        drift.push(
          `demo ${JSON.stringify(name)} in ${JSON.stringify(section.id)}: no route emitted`,
        )
      }
    }
  }

  return drift
}

/** How a match reads in a drift message: `index (unknown)`, `section inputs`, `demo inputs/Badge`. */
function describe(match: RouteMatch): string {
  if (match.kind === "index") return `index (${match.reason})`
  if (match.kind === "page") return `page ${match.pageId}`
  if (match.kind === "section") return `section ${match.sectionId}`
  return `demo ${match.sectionId}/${match.name}`
}
