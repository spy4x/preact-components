/**
 * Page-head model and an optional per-request head store.
 *
 * Everything here is app-agnostic: {@link createHeadStore} builds a fresh signal on every call and
 * hands back functions that write it. The canonical-address normaliser, the breadcrumb builders
 * and the `Crumb` type live in `@spy4x/platform/universal/seo` (spy4x/ts-libs), so a server can
 * use them without Preact. Two rules shape what they do:
 *
 * - **A canonical address is normalised before it is published.** Search engines and social
 *   networks read what this package emits, so an address is parsed, required to be `http` or
 *   `https`, and stripped of the parts that must never reach a page — a user name, a password and
 *   a fragment. Anything that is not a web address is refused rather than printed.
 * - **A breadcrumb trail is the caller's, never a guess.** Nothing here reads a path and invents a
 *   name for a segment of it. A route that wants a `BreadcrumbList` states its own crumbs.
 */

import { type Signal, signal } from "@preact/signals"
import type { Crumb } from "@spy4x/platform/universal/seo"

/** Open Graph object type a page declares. */
export type OgType = "profile" | "article" | "website" | "service"

/**
 * `twitter:card` value a page can publish.
 *
 * `app` and `player` are Twitter/X card types too, but each needs data this component has no
 * field for — an app id per platform, a player iframe URL and its pixel size — so a caller who
 * wants one renders it beside `SEOHead` rather than through it. `summary` and `summary_large_image`
 * need nothing beyond what {@link PageHead} already carries.
 */
export type TwitterCard = "summary" | "summary_large_image"

/** Every field {@link SEOHead} renders, plus the JSON-LD inputs. */
export interface PageHead {
  /** `<title>`, `og:title` and `twitter:title`. */
  title: string
  /** `<meta name="description">` and both social equivalents. */
  description: string
  /**
   * Absolute `http`/`https` address of this page. Drives `<link rel="canonical">` and `og:url`.
   *
   * It is normalised before it is emitted — see `normalizeCanonical` — so the address that
   * reaches the page is not necessarily the string handed in.
   */
  canonical: string
  /** Absolute social preview image. The `og:image` / `twitter:image` pair is omitted without it. */
  ogImage?: string
  /**
   * Width of {@link PageHead.ogImage} in pixels, published as `og:image:width`.
   *
   * Omitted when unset, and also when there is no `ogImage`: a size describes an image, and a
   * page without one has nothing to measure.
   */
  imageWidth?: number
  /** Height of {@link PageHead.ogImage} in pixels, `og:image:height`; omitted like `imageWidth`. */
  imageHeight?: number
  /** Defaults to `"website"`. */
  ogType?: OgType
  /** Renders `noindex, nofollow` instead of `index, follow`. */
  noindex?: boolean
  /** `og:site_name`; omitted when absent. */
  siteName?: string
  /** Twitter/X handle for `twitter:site`, e.g. `"@acme"`. */
  twitterSite?: string
  /** Twitter/X handle of the page's author, for `twitter:creator`, e.g. `"@jane"`. */
  twitterCreator?: string
  /**
   * Overrides the derived `twitter:card` value.
   *
   * Left unset, `twitter:card` is `"summary_large_image"` when {@link PageHead.ogImage} is given
   * and `"summary"` when it is not — a page never claims a large preview image it has none of. Set
   * this when the derivation is wrong for the page: an `ogImage` too small for a large card, or a
   * caller with no `ogImage` who still wants `"summary_large_image"` for a reason of their own.
   * Nothing here second-guesses the value, the same way nothing here second-guesses `title`.
   */
  twitterCard?: TwitterCard
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

/**
 * A head signal with the defaults it was created from, so `resetHead()` is exact.
 *
 * `T` is the head the app keeps: {@link PageHead} itself, or `PageHead` plus fields of the app's
 * own, such as a `pageName` its layout prints. `SEOHead` reads only the `PageHead` part.
 */
export interface HeadStore<T extends PageHead = PageHead> {
  /** Current page head. Read `.value` in a component to subscribe. */
  head: Signal<T>
  /**
   * Merge a patch into the current head, write it to {@link HeadStore.head}, and return it.
   *
   * A field the patch names with the value `undefined` is cleared; an empty patch changes no field.
   */
  setHead: (patch: Partial<T>) => T
  /**
   * Write the defaults handed to {@link createHeadStore} back to {@link HeadStore.head}, and
   * return them.
   *
   * Kept for the long-lived store a browser app holds across client-side navigations, although
   * nothing in this repository calls it. `setHead` merges, so it clears only a field the patch
   * names. The next page does not know what the previous page set — its `noindex`, its `crumbs` —
   * so it cannot name them; a reset before its patch clears them without that list.
   */
  resetHead: () => T
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
 * In a browser the store outlives a page, so a client-side navigation calls `resetHead()` before
 * the next page's `setHead()`; otherwise the new page inherits every field the old one set.
 *
 * An app with head fields of its own names its type, and the store carries them with no cast:
 * `createHeadStore<PageHead & { pageName: string }>(defaults)`.
 *
 * @param defaults Fields used by every page; also the state `resetHead()` returns to. They are
 *   copied here, so a caller who changes the object afterwards does not change what a reset
 *   restores. The copy is shallow: a crumb or JSON-LD object inside it is still the caller's.
 */
export function createHeadStore<T extends PageHead = PageHead>(defaults: NoInfer<T>): HeadStore<T> {
  const initial: T = { ...defaults }
  const head = signal<T>({ ...initial })

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
