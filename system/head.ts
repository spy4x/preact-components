/**
 * Page-head model, breadcrumb derivation, and an optional head store.
 *
 * Everything here is pure and app-agnostic: the canonical URL a page passes in is the single
 * input the breadcrumb trail and its JSON-LD twin are derived from, so a route never has to
 * state its ancestors twice. Nothing is hardcoded to a brand, domain or root path — the origin
 * comes from the canonical URL and the labels come from the caller.
 */

import { type Signal, signal } from "@preact/signals"

/** Open Graph object type a page declares. */
export type OgType = "profile" | "article" | "website" | "service"

/** Every field {@link SEOHead} renders, plus the JSON-LD inputs. */
export interface PageHead {
  /** `<title>`, `og:title` and `twitter:title`. */
  title: string
  /** `<meta name="description">` and both social equivalents. */
  description: string
  /** Absolute URL of this page. Drives `<link rel="canonical">`, `og:url` and the breadcrumb. */
  canonical: string
  /** Absolute social preview image. The `og:image` / `twitter:image` pair is omitted without it. */
  ogImage?: string
  /** Defaults to `"website"`. */
  ogType?: OgType
  /** Renders `noindex, nofollow` instead of `index, follow`. */
  noindex?: boolean
  /** `og:site_name`; omitted when absent. */
  siteName?: string
  /** Twitter/X handle for `twitter:site`, e.g. `"@acme"`. */
  twitterSite?: string
  /** `og:locale`, e.g. `"en_US"`. */
  locale?: string
  /** Extra JSON-LD entities appended to the `@graph`, ahead of the breadcrumb node. */
  jsonLd?: readonly unknown[]
  /** Label of the root breadcrumb entry. Defaults to `"Home"`. */
  homeLabel?: string
  /** `false` leaves the `BreadcrumbList` node out of the graph. Defaults to `true`. */
  breadcrumbs?: boolean
}

/** One visible breadcrumb entry. The last entry carries no `href`. */
export interface Crumb {
  name: string
  href?: string
}

/** A schema.org `ListItem` as it appears inside a `BreadcrumbList`. */
export interface BreadcrumbListItem {
  "@type": "ListItem"
  position: number
  name: string
  item: string
}

/** A schema.org `BreadcrumbList` node. */
export interface BreadcrumbListJsonLd {
  "@type": "BreadcrumbList"
  "@id": string
  itemListElement: BreadcrumbListItem[]
}

/** Knobs shared by both breadcrumb derivations. */
export interface BreadcrumbOptions {
  /** Label of the root entry. Defaults to `"Home"`. */
  homeLabel?: string
  /** `href` of the root entry in the visible trail. Defaults to `"/"`. */
  homeHref?: string
}

/** Decode a URL path segment, tolerating the stray `%` a slug may contain. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Turn a URL segment into a readable label: `"how-i-work"` becomes `"How I Work"`.
 *
 * Segments are percent-decoded first, so `"hello%20world"` reads as two words.
 */
export function humanizeSlug(slug: string): string {
  return decodeSegment(slug)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Parse an absolute canonical URL, throwing a readable error when it is relative.
 *
 * `URL.pathname` is the reason every helper here is trailing-slash safe: `/blog/` and `/blog`
 * both yield the segment list `["blog"]`, and the query string, hash, protocol and port are
 * stripped for free — no regex, and no assumption about the deploying domain.
 */
export function canonicalUrl(canonical: string): URL {
  try {
    return new URL(canonical)
  } catch {
    throw new Error(`canonical must be an absolute URL, received: ${canonical}`)
  }
}

/** Path segments of a canonical URL, decoded, without empties. `"/"` yields `[]`. */
export function pathSegments(canonical: string): string[] {
  return canonicalUrl(canonical).pathname.split("/").filter(Boolean).map(decodeSegment)
}

/**
 * Breadcrumb trail for the visible `<nav>`, derived from a canonical URL.
 *
 * Returns `[{ name: "Home", href: "/" }, …, { name: pageName }]` — the last entry never has an
 * `href`, because the current page is not a link. Intermediate labels are humanized from the
 * path, so `/how-i-work` reads as "How I Work" without the route declaring it.
 *
 * @param canonical Absolute URL of the page being rendered.
 * @param pageName Label for the last crumb, normally the page title.
 * @param options `homeLabel` (default `"Home"`) and `homeHref` (default `"/"`).
 */
export function breadcrumbsFromCanonical(
  canonical: string,
  pageName: string,
  options: BreadcrumbOptions = {},
): Crumb[] {
  const { homeLabel = "Home", homeHref = "/" } = options
  const segments = pathSegments(canonical)
  const items: Crumb[] = [{ name: homeLabel, href: homeHref }]

  let accumulated = ""
  segments.forEach((segment, index) => {
    accumulated += `/${encodeURIComponent(segment)}`
    const isLast = index === segments.length - 1
    items.push(isLast ? { name: pageName } : { name: humanizeSlug(segment), href: accumulated })
  })

  return items
}

/**
 * `itemListElement` for a schema.org `BreadcrumbList`, derived from a canonical URL.
 *
 * Same walk as {@link breadcrumbsFromCanonical}, but every entry is an absolute `item` URL so
 * the structured data stands alone in a search result. Positions are 1-based; the root is 1.
 *
 * @param canonical Absolute URL of the page, used for the origin and the path.
 * @param pageName Label of the last entry.
 */
export function breadcrumbFromCanonical(
  canonical: string,
  pageName: string,
  options: BreadcrumbOptions = {},
): BreadcrumbListItem[] {
  const { homeLabel = "Home" } = options
  const { origin } = canonicalUrl(canonical)
  const segments = pathSegments(canonical)

  const items: BreadcrumbListItem[] = [
    { "@type": "ListItem", position: 1, name: homeLabel, item: `${origin}/` },
  ]

  let accumulated = ""
  segments.forEach((segment, index) => {
    accumulated += `/${encodeURIComponent(segment)}`
    const isLast = index === segments.length - 1
    items.push({
      "@type": "ListItem",
      position: index + 2,
      name: isLast ? pageName : humanizeSlug(segment),
      item: `${origin}${accumulated}`,
    })
  })

  return items
}

/** The complete `BreadcrumbList` node, `@id`-anchored to the page it describes. */
export function breadcrumbListJsonLd(
  canonical: string,
  pageName: string,
  options: BreadcrumbOptions = {},
): BreadcrumbListJsonLd {
  return {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: breadcrumbFromCanonical(canonical, pageName, options),
  }
}

/** A head signal with the defaults it was created from, so `resetHead()` is exact. */
export interface HeadStore {
  /** Current page head. Read `.value` in a component to subscribe. */
  head: Signal<PageHead>
  /** Merge a patch into the current head and return the result. */
  setHead: (patch: Partial<PageHead>) => PageHead
  /** Restore the defaults handed to {@link createHeadStore}. */
  resetHead: () => PageHead
}

/**
 * Build a head store from defaults.
 *
 * A factory rather than a module-level signal: the library never owns app data, so an app calls
 * this once, passes `store.head` into `<SEOHead>` (or sets it from a route) and keeps the writer
 * side. An island that changes the title imports the same store the layout reads.
 *
 * @param defaults Fields used by every page; also the state `resetHead()` returns to.
 */
export function createHeadStore(defaults: PageHead): HeadStore {
  const head = signal<PageHead>({ ...defaults })

  return {
    head,
    setHead(patch) {
      head.value = { ...head.value, ...patch }
      return head.value
    },
    resetHead() {
      head.value = { ...defaults }
      return head.value
    },
  }
}
