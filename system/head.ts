/**
 * Page-head model, the canonical-address normaliser, and an optional per-request head store.
 *
 * Everything here is pure and app-agnostic. Two rules shape it:
 *
 * - **A canonical address is normalised before it is published.** Search engines and social
 *   networks read what this package emits, so an address is parsed, required to be `http` or
 *   `https`, and stripped of the parts that must never reach a page — a user name, a password and
 *   a fragment. Anything that is not a web address is refused rather than printed.
 * - **A breadcrumb trail is the caller's, never a guess.** Nothing here reads a path and invents a
 *   name for a segment of it. A route that wants a `BreadcrumbList` states its own crumbs.
 */

import { type Signal, signal } from "@preact/signals"

/** Open Graph object type a page declares. */
export type OgType = "profile" | "article" | "website" | "service"

/** One entry in the breadcrumb trail a page declares. */
export interface Crumb {
  /** Visible name of the entry, exactly as it should appear. Never derived from the address. */
  name: string
  /**
   * Where the entry points. Absolute, or relative to the page's canonical address.
   *
   * The last entry normally omits it: a trail ends on the current page, whose address is the
   * canonical one.
   */
  href?: string
}

/** Every field {@link SEOHead} renders, plus the JSON-LD inputs. */
export interface PageHead {
  /** `<title>`, `og:title` and `twitter:title`. */
  title: string
  /** `<meta name="description">` and both social equivalents. */
  description: string
  /**
   * Absolute `http`/`https` address of this page. Drives `<link rel="canonical">` and `og:url`.
   *
   * It is normalised before it is emitted — see {@link normalizeCanonical} — so the address that
   * reaches the page is not necessarily the string handed in.
   */
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
  /**
   * The page's breadcrumb trail, root first, current page last.
   *
   * Supplied by the route, because only the route knows what its ancestors are called. Fewer than
   * two entries emits no `BreadcrumbList` at all: a one-item trail is noise in a rich result.
   */
  crumbs?: readonly Crumb[]
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

/**
 * Parse an address that is going to be published, refusing anything that is not a web page.
 *
 * Three things are dropped rather than refused, because each is meaningless on a published
 * address and harmful in one: a user name and a password would print credentials into a page that
 * search engines and social networks read, and a fragment names a position inside a page rather
 * than a page. What survives is the origin, the path and the query, the three parts that identify
 * a page. `URL` normalises the rest for free — the host is lower-cased, a default port is dropped
 * and an origin with no path gains its `/`.
 *
 * @param input The address as the caller wrote it.
 * @param label What the address is, used in the error message.
 * @param base Resolves a relative address; omitted when the address must already be absolute.
 * @throws When the address does not parse, or its scheme is not `http` or `https`.
 */
function webUrl(input: string, label: string, base?: URL): URL {
  let url: URL
  try {
    url = new URL(input, base)
  } catch {
    throw new Error(`${label} must be an absolute URL, received: ${input}`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must be an http or https URL, received: ${input}`)
  }

  url.username = ""
  url.password = ""
  url.hash = ""
  return url
}

/**
 * Parse a canonical address into the normalised `URL` that will be published.
 *
 * Refusing rather than falling back is deliberate, and it is the same split the calendar makes
 * between an impossible date and an unknown time zone. A canonical address is the caller's own
 * arithmetic: a route built it out of an origin and a path, and if the result is
 * `javascript:alert(1)` or `/products/widgets` then the route is wrong, not the environment. The
 * alternatives are worse in a way nobody would notice: omitting the tag publishes a page with no
 * canonical address at all, and there is no origin to fall back to that would not be invented.
 *
 * @param canonical Absolute `http`/`https` address of the page.
 * @throws When it is relative, unparsable, or carries any other scheme.
 */
export function canonicalUrl(canonical: string): URL {
  return webUrl(canonical, "canonical")
}

/**
 * The canonical address as it should be published: one clean `http`/`https` address.
 *
 * `https://user:pw@ACME.Example:443/a/b?x=1#frag` becomes `https://acme.example/a/b?x=1`.
 */
export function normalizeCanonical(canonical: string): string {
  return canonicalUrl(canonical).href
}

/**
 * `itemListElement` for a schema.org `BreadcrumbList`, built from the crumbs the caller stated.
 *
 * Positions are 1-based and follow the array. Every `item` is an absolute address, because the
 * structured data has to stand alone in a search result: a crumb's `href` is resolved against the
 * canonical address and normalised the same way it is, and a crumb with no `href` — the last one,
 * the page itself — takes the canonical address.
 *
 * @param canonical Absolute address of the page the trail ends on.
 * @param crumbs The trail, root first, current page last.
 */
export function breadcrumbItems(
  canonical: string,
  crumbs: readonly Crumb[],
): BreadcrumbListItem[] {
  const base = canonicalUrl(canonical)

  return crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: crumb.href === undefined ? base.href : webUrl(crumb.href, "crumb href", base).href,
  }))
}

/**
 * The complete `BreadcrumbList` node, `@id`-anchored to the page it describes.
 *
 * The anchor is built from the normalised address, which is why it carries exactly one `#`: a
 * canonical address handed in with a fragment used to produce `…#frag#breadcrumb`, an identifier
 * no other node could ever match.
 */
export function breadcrumbListJsonLd(
  canonical: string,
  crumbs: readonly Crumb[],
): BreadcrumbListJsonLd {
  const base = canonicalUrl(canonical)

  return {
    "@type": "BreadcrumbList",
    "@id": `${base.href}#breadcrumb`,
    itemListElement: breadcrumbItems(base.href, crumbs),
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
 * **Create one per request, not one per module.** A module-level store is a single signal shared
 * by every request a server handles, so one visitor's title can be rendered onto another
 * visitor's page — the same bug as a shared theme, and it only shows up under concurrency. Call
 * this where a request is handled, pass the store down, and let it be collected with the request.
 * In a browser there is one document and one store, created where the app is created.
 *
 * ```ts
 * // A request handler, server-side: one store, this request only.
 * function handler(request: Request) {
 *   const { head, setHead } = createHeadStore(siteDefaults)
 *   setHead({ title: "Widgets", canonical: new URL(request.url).href })
 *   return renderPage(head.value)
 * }
 * ```
 *
 * A factory rather than a module-level signal for a second reason too: the library never owns app
 * data. The app keeps the writer side and passes `store.head` into `<SEOHead>`, and an island that
 * changes the title is handed the same store the layout reads.
 *
 * @param defaults Fields used by every page; also the state `resetHead()` returns to. They are
 *   copied here, so a caller who changes the object afterwards does not change what a reset
 *   restores. The copy is shallow: a crumb or JSON-LD object inside it is still the caller's.
 */
export function createHeadStore(defaults: PageHead): HeadStore {
  const initial: PageHead = { ...defaults }
  const head = signal<PageHead>({ ...initial })

  return {
    head,
    setHead(patch) {
      head.value = { ...head.value, ...patch }
      return head.value
    },
    resetHead() {
      // A fresh copy every time: a signal holding `initial` itself would let one mutation of the
      // returned head leak into every later reset.
      head.value = { ...initial }
      return head.value
    },
  }
}
