/**
 * The catalogue's route model — the hash grammar every URL of the deployed guide is matched against.
 *
 * The guide is multipage by **hash route**, because the host is GitHub Pages serving one static
 * directory under a base subpath: there is no server and no SPA fallback, so a path route such as
 * `/preact-components/inputs` would be a 404. Per-route prerendered files were considered and
 * rejected — they need a build-system change and a rewrite rule the host does not have. Hash routing
 * needs neither, and it survives a move to a custom domain. The costs, stated plainly: uglier URLs,
 * and one shared fragment namespace with the per-demo deep links that already ship.
 *
 * The grammar, in the order {@link parseRoute} matches it:
 *
 * | Hash                     | Match                                                        |
 * | ------------------------ | ------------------------------------------------------------ |
 * | `#`, `#/`, `""`          | {@link IndexRouteMatch}, `reason: "empty"` — the landing page |
 * | `#/ui`                   | {@link PageRouteMatch} — one page of the guide                |
 * | `#/inputs`               | {@link SectionRouteMatch} — one section of the catalogue      |
 * | `#/inputs/toggle-switch` | {@link DemoRouteMatch} — one demo card                        |
 * | `#toggle-switch`         | {@link DemoRouteMatch} — the shipped legacy deep link         |
 * | `#/nonsense`             | {@link IndexRouteMatch}, `reason: "unknown"` — never a throw  |
 *
 * A page is what the guide renders at one time: the overview, or one package (see `guidePages` in
 * `registry.ts`). Every route names one — {@link pageOfRoute} — except an unknown one, which names
 * none, so the host keeps the page it is on. A page whose id is also a section's (`charts`, `crud`,
 * `map`, `system`) has that section's route as its own; the others (`ui`, `theme`, `icons`,
 * `signals`, `cn`) match as a {@link PageRouteMatch}, and no page id is a section id of another
 * page, which `routes.test.ts` asserts.
 *
 * A bare fragment (`#toggle-switch`, `#ToggleSwitch`, `#demo-ToggleSwitch`) is the shape the page
 * shipped before hash routing, so it stays: it resolves against every section's demo names, and it
 * is the one case where the section is derived rather than named. Every other bare fragment —
 * `#icons`, `#top`, a section's own DOM id — is deliberately **not** a route: the index match means
 * "not ours", and the browser's native anchor scroll keeps working. Because the guide renders one
 * page at a time, the element such a fragment names can be on a page that is not showing;
 * {@link pageOfFragment} answers which page holds a section's or a page's own id, and the shell
 * opens it.
 *
 * Routes derive from {@link catalogueSections} rather than from a hand-kept parallel list: slugs are
 * {@link routeSlug} of the section id and of the component name, and {@link parseRoute} reads the
 * sections it is handed, so a section added to `registry.ts` is routable with no second edit. Two
 * things then hold that derivation to account, because a route module that quietly stopped covering
 * a section would be worse than none: `routes.test.ts` drives the live `catalogueSections` and fails
 * when a section has no route the resolver accepts or when the number of routes stops equalling the
 * number of sections, and {@link routeTableDrift} — which `pages/build.ts` runs over the echo it
 * reads back out of the emitted document — reports a section or a demo with no route at all.
 *
 * A type-level `Record<SectionId, …>` is deliberately not the guard here. The ids at runtime come
 * from `catalogueSections: CatalogueSection[]` — a plain array with no tuple of literals to be
 * exhaustive over — so a mapped type could only be fed by a second, hand-kept list, which is the
 * drift this module exists to avoid. Deriving at runtime and checking against the array is the
 * honest form of the same guarantee, and the build fails, not just the test.
 *
 * Pure by construction — no DOM, no `window`, no `location`, no renderer — so every decision below is
 * unit-testable without a browser. The effects live elsewhere: {@link parseRoute} answers *which*
 * route a hash is, the shell (`shell.tsx`) scrolls and marks, and the host titles the document.
 */

import {
  type CatalogueSection,
  catalogueSections,
  type GuidePageId,
  guidePageIds,
  guidePages,
  pageOfSection,
  type SectionId,
} from "./registry.ts"

/** Matched the landing route: the catalogue's index, and the fallback for anything that is not one. */
export interface IndexRouteMatch {
  kind: "index"
  /**
   * Why this is the match.
   *
   * `"empty"` for `#`, `#/` or an empty string; `"unknown"` for a hash that names no route at all.
   * The host says so rather than guessing — and for `"unknown"` it must not touch the DOM, because
   * the browser's own anchor handling still owns fragments such as `#icons` or `#top`.
   */
  reason: "empty" | "unknown"
  /** The hash as normalised: percent-decoded, trimmed, one leading `#`. */
  hash: string
}

/** Matched one section of the catalogue: `#/inputs`. */
export interface SectionRouteMatch {
  kind: "section"
  /** The section, as `registry.ts` identifies it. */
  sectionId: SectionId
  /** Canonical section slug — {@link routeSlug} of the id. */
  slug: string
  /** The section's heading, so a host can title the page without a second lookup. */
  title: string
  /** Canonical href, `#/inputs`. */
  href: string
  /** The hash as normalised. */
  hash: string
}

/** Matched one demo card: `#/inputs/toggle-switch`, or the legacy `#toggle-switch`. */
export interface DemoRouteMatch {
  kind: "demo"
  /** Section the demo lives in — derived from the registry, not from the URL segment. */
  sectionId: SectionId
  /** Component export name, or the card id of a class card, e.g. `class-input`. */
  name: string
  /** Canonical href, `#/inputs/toggle-switch`. */
  href: string
  /**
   * Which grammar matched.
   *
   * `"hash"` for the canonical `#/…` shape, `"fragment"` for the legacy bare fragment. The two
   * resolve to the same route; the field is how a host can tell a pasted old link from one the page
   * itself wrote, without re-deriving the grammar.
   */
  source: "hash" | "fragment"
  /** The hash as normalised. */
  hash: string
}

/** Matched one page of the guide whose id names no section: `#/ui`, `#/icons`. */
export interface PageRouteMatch {
  kind: "page"
  /** The page, as `registry.ts` identifies it. */
  pageId: GuidePageId
  /** The page's heading. */
  title: string
  /** Canonical href, `#/ui`. */
  href: string
  /** The hash as normalised. */
  hash: string
}

/** What a hash resolved to: a page, a section, a demo, or the landing route. */
export type RouteMatch = IndexRouteMatch | PageRouteMatch | SectionRouteMatch | DemoRouteMatch

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
 * URL slug of a name or a section id: `ToggleSwitch` becomes `toggle-switch`.
 *
 * The repository's **one** slug rule. Section slugs and demo slugs both come from here, and
 * `pages/src/deep-link.ts`'s `demoSlug` delegates rather than re-implements it, so a link the guide
 * writes and a link the page resolves cannot disagree about what a name looks like.
 *
 * Every component `ui/` exports is camel-cased from words, so splitting on a lower-to-upper boundary
 * is enough; an acronym would need its own rule and there is none.
 *
 * @param name Component name or section id.
 * @returns The slug the navigation links to.
 */
export function routeSlug(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Canonical href of a section.
 *
 * @param sectionId Section to link to.
 * @returns `#/inputs`.
 */
export function routeHref(sectionId: SectionId): string {
  return `#/${routeSlug(sectionId)}`
}

/**
 * Canonical href of a page: `#/` for the overview, `#/<id>` for the rest.
 *
 * A page whose id is a section's shares that section's href, which is what makes `#/charts` both.
 *
 * @param pageId Page to link to.
 * @returns `#/ui`.
 */
export function pageHref(pageId: GuidePageId): string {
  return pageId === "overview" ? "#/" : `#/${routeSlug(pageId)}`
}

/**
 * The page a route opens, or `undefined` for a hash that names no route.
 *
 * `undefined` is the host's cue to stay on the page it is on: a bare fragment such as `#top` or a
 * card's own in-page link is the browser's business, and switching pages under it would take the
 * element it points at off the page.
 *
 * @param match A route {@link parseRoute} returned.
 * @param sections Sections to resolve against; defaults to the catalogue's.
 * @returns The page to render.
 */
export function pageOfRoute(
  match: RouteMatch,
  sections: readonly CatalogueSection[] = catalogueSections,
): GuidePageId | undefined {
  if (match.kind === "index") return match.reason === "empty" ? "overview" : undefined
  if (match.kind === "page") return match.pageId
  const section = sections.find((candidate) => candidate.id === match.sectionId)
  return section ? pageOfSection(section) : undefined
}

/**
 * The page holding the element a bare fragment names, for the ids the guide itself renders: a
 * section's (`#inputs`) and a page's own (`#icons`, the gallery). `undefined` for anything else —
 * a card's in-page target, `#top`, a route — whose page the guide cannot know without rendering it.
 *
 * @param hash The address's fragment, `#inputs`.
 * @param sections Sections to resolve against; defaults to the catalogue's.
 * @returns The page to open so the element is there, or `undefined`.
 */
export function pageOfFragment(
  hash: string,
  sections: readonly CatalogueSection[] = catalogueSections,
): GuidePageId | undefined {
  const id = /^#([^/]+)$/.exec(hash)?.[1]
  if (id === undefined) return undefined
  const section = sections.find((candidate) => candidate.id === id)
  if (section) return pageOfSection(section)
  return guidePageIds.find((pageId) => pageId === id && pageId !== "overview")
}

/**
 * Canonical href of one demo card.
 *
 * The section is a parameter rather than a lookup so the caller that already knows it — the
 * navigation iterates the sections — cannot be charged a second pass over the registry, and its type
 * is the compile-time half of the tie: a href cannot be built against a section that does not exist.
 * The name is a plain string because the same builder is what the build guard re-runs over the raw
 * strings it read back out of the document; nothing is validated here, and a builder that silently
 * rewrote a mismatched pair would hide the bug {@link routeTableDrift} exists to report.
 *
 * @param sectionId Section the demo lives in.
 * @param name Component export name, or a class card's id.
 * @returns `#/inputs/toggle-switch`.
 */
export function demoHref(sectionId: SectionId, name: string): string {
  return `${routeHref(sectionId)}/${routeSlug(name)}`
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

/**
 * Resolve an incoming `location.hash` to the route it names.
 *
 * Never throws and never returns `undefined`: a hash that names no route is an
 * {@link IndexRouteMatch} with `reason: "unknown"`, which is both the sane default for a mistyped
 * URL and the sentinel a host needs to say so — and to know that a bare fragment such as `#icons` is
 * the browser's business, not its own.
 *
 * A hash-route segment matches case-insensitively against slugs and export names alike, so
 * `#/inputs/ToggleSwitch` opens the same card as `#/inputs/toggle-switch`. A demo must live in the
 * section its URL names: `#/buttons/toggle-switch` is `"unknown"` rather than silently redirected,
 * because the table the build checks writes one canonical href per demo and a resolver that accepted
 * a second one would make that check weaker than it looks.
 *
 * @param hash Raw hash, with or without the leading `#`, percent-encoded or not.
 * @param sections Sections to resolve against; defaults to the catalogue's.
 * @returns The match, never `undefined`.
 */
export function parseRoute(
  hash: string,
  sections: readonly CatalogueSection[] = catalogueSections,
): RouteMatch {
  const { body, hash: normalised } = normaliseHash(hash)
  if (body === "/") return indexRoute("empty", normalised)

  if (body.startsWith("/")) {
    const segments = body.slice(1).split("/").filter((segment) => segment !== "")
    if (segments.length === 0) return indexRoute("empty", normalised)

    const section = sections.find((candidate) =>
      routeSlug(candidate.id) === segments[0].toLowerCase()
    )
    if (!section) {
      const page = guidePages.find((candidate) =>
        candidate.id !== "overview" && routeSlug(candidate.id) === segments[0].toLowerCase()
      )
      return page && segments.length === 1
        ? {
          kind: "page",
          pageId: page.id,
          title: page.title,
          href: pageHref(page.id),
          hash: normalised,
        }
        : indexRoute("unknown", normalised)
    }
    if (segments.length === 1) {
      return {
        kind: "section",
        sectionId: section.id,
        slug: routeSlug(section.id),
        title: section.title,
        href: routeHref(section.id),
        hash: normalised,
      }
    }
    if (segments.length > 2) return indexRoute("unknown", normalised)

    const name = nameIn(section, segments[1])
    return name ? demoRoute(section, name, "hash", normalised) : indexRoute("unknown", normalised)
  }

  if (body === "") return indexRoute("empty", normalised)

  // The legacy bare fragment: the shape this page shipped before hash routing, resolved against
  // every section because the fragment names a component and not a place.
  const wanted = body.replace(/^demo-/i, "").toLowerCase()
  for (const section of sections) {
    const name = nameIn(section, wanted)
    if (name) return demoRoute(section, name, "fragment", normalised)
  }

  return indexRoute("unknown", normalised)
}

/**
 * Percent-decode a hash, trim it, and split it into the body the grammar reads and the hash a match
 * echoes back.
 *
 * A malformed escape (`#%E0%A4%A`) is matched as written rather than raising: a broken URL is a URL
 * that names no route, which is the index match's whole job.
 *
 * @param hash Raw hash.
 * @returns The decoded, trimmed body, and `#` + that body.
 */
function normaliseHash(hash: string): { body: string; hash: string } {
  const trimmed = hash.trim()
  const without = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed

  let decoded = without
  try {
    decoded = decodeURIComponent(without)
  } catch {
    // Not an escape sequence; fall through with the raw text.
  }

  const body = decoded.trim()
  return { body, hash: `#${body}` }
}

/** One demo match, canonical href included. */
function demoRoute(
  section: CatalogueSection,
  name: string,
  source: "hash" | "fragment",
  hash: string,
): DemoRouteMatch {
  return {
    kind: "demo",
    sectionId: section.id,
    name,
    href: demoHref(section.id, name),
    source,
    hash,
  }
}

/** The landing route, with the reason the host reports. */
function indexRoute(reason: "empty" | "unknown", hash: string): IndexRouteMatch {
  return { kind: "index", reason, hash }
}

/**
 * The name one section demos that a URL segment means, if any.
 *
 * Case-insensitive against both the export name and its slug, so a hand-typed `ToggleSwitch` and the
 * navigation's `toggle-switch` are the same card.
 *
 * @param section Section to look in.
 * @param segment Decoded URL segment, already lowered by the caller when it is a fragment.
 * @returns The name, or `undefined` when the section demos nothing of that name.
 */
function nameIn(section: CatalogueSection, segment: string): string | undefined {
  const wanted = segment.toLowerCase()
  return section.names.find((name) => name.toLowerCase() === wanted || routeSlug(name) === wanted)
}

/** How a match reads in a drift message: `index (unknown)`, `section inputs`, `demo inputs/Badge`. */
function describe(match: RouteMatch): string {
  if (match.kind === "index") return `index (${match.reason})`
  if (match.kind === "page") return `page ${match.pageId}`
  if (match.kind === "section") return `section ${match.sectionId}`
  return `demo ${match.sectionId}/${match.name}`
}
