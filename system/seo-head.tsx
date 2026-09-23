/**
 * `SEOHead` — the page-head tag set, and the JSON-LD graph that mirrors it.
 *
 * Two exports, one definition: {@link seoHeadTags} returns the tag set as data (so an app whose
 * head is not a component tree can inject it, and so tests can assert the exact set), and
 * {@link SEOHead} renders that same set as JSX. Nothing is read from a global store: the props
 * *are* the page head, which is what makes this package usable from a layout, a route or a test.
 *
 * The canonical address is normalised before anything is emitted, and a `BreadcrumbList` is
 * emitted only for a trail the caller stated — nothing here reads a path and names a crumb after
 * a segment of it.
 */

import type { JSX } from "preact"
import { breadcrumbListJsonLd, normalizeCanonical, type PageHead } from "./head.ts"

/** Which `<head>` element a {@link HeadTag} describes. */
export type HeadTagName = "title" | "meta" | "link" | "script"

/** A serialisable `<head>` element, in document order. */
export interface HeadTag {
  tag: HeadTagName
  attrs: Record<string, string>
  /** Text content: the document title, or the JSON-LD body. */
  text?: string
}

/**
 * Serialise JSON-LD for a `<script>` body.
 *
 * `<` is escaped to `\u003c` (valid JSON, same string) so a description containing `</script>`
 * cannot close the element it is embedded in.
 */
export function jsonLdText(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

/**
 * Build the JSON-LD `@graph` for a page: the caller's entities, then the breadcrumb.
 *
 * The breadcrumb is the `crumbs` the caller stated, and it is emitted only when there are at
 * least two of them: a trail consisting of the current page alone is noise in a rich result, and
 * a page that states none wants none. Returns `[]` when nothing is left to emit.
 *
 * @param head The page head the graph describes.
 */
export function seoHeadJsonLd(head: PageHead): unknown[] {
  const graph: unknown[] = [...(head.jsonLd ?? [])]
  const crumbs = head.crumbs ?? []

  if (crumbs.length > 1) graph.push(breadcrumbListJsonLd(head.canonical, crumbs))

  return graph
}

/**
 * The full `<head>` tag set for a page, in document order.
 *
 * Primary meta, then the Twitter card, then Open Graph, then JSON-LD. Optional tags are omitted
 * rather than emitted empty — no `og:image=""`, no `og:site_name` a caller did not supply.
 *
 * `<link rel="canonical">` and `og:url` carry the *normalised* address rather than the string the
 * caller handed in, and the whole set is refused before a tag exists when that address is not an
 * `http`/`https` one: a tag set built on a wrong canonical address is wrong everywhere it is read.
 *
 * @param head Page head; only `title`, `description` and `canonical` are required.
 * @returns Tag descriptors, ready to render or to hand to a non-JSX head pipeline.
 */
export function seoHeadTags(head: PageHead): HeadTag[] {
  const canonical = normalizeCanonical(head.canonical)
  // A page never claims a large preview image it has none of: `summary_large_image` only when an
  // `ogImage` is given, unless the caller overrides it — see `PageHead.twitterCard`.
  const twitterCard = head.twitterCard ?? (head.ogImage ? "summary_large_image" : "summary")

  const tags: HeadTag[] = [
    { tag: "title", attrs: {}, text: head.title },
    { tag: "meta", attrs: { name: "description", content: head.description } },
    { tag: "link", attrs: { rel: "canonical", href: canonical } },
    {
      tag: "meta",
      attrs: {
        name: "robots",
        content: head.noindex ? "noindex, nofollow" : "index, follow",
      },
    },

    { tag: "meta", attrs: { name: "twitter:card", content: twitterCard } },
  ]

  if (head.twitterSite) {
    tags.push({ tag: "meta", attrs: { name: "twitter:site", content: head.twitterSite } })
  }
  tags.push(
    { tag: "meta", attrs: { name: "twitter:title", content: head.title } },
    { tag: "meta", attrs: { name: "twitter:description", content: head.description } },
  )
  if (head.ogImage) {
    tags.push({ tag: "meta", attrs: { name: "twitter:image", content: head.ogImage } })
  }

  tags.push(
    { tag: "meta", attrs: { property: "og:type", content: head.ogType ?? "website" } },
    { tag: "meta", attrs: { property: "og:title", content: head.title } },
    { tag: "meta", attrs: { property: "og:description", content: head.description } },
    { tag: "meta", attrs: { property: "og:url", content: canonical } },
  )
  if (head.ogImage) {
    tags.push({ tag: "meta", attrs: { property: "og:image", content: head.ogImage } })
  }
  if (head.siteName) {
    tags.push({ tag: "meta", attrs: { property: "og:site_name", content: head.siteName } })
  }
  if (head.locale) {
    tags.push({ tag: "meta", attrs: { property: "og:locale", content: head.locale } })
  }

  const graph = seoHeadJsonLd(head)
  if (graph.length > 0) {
    tags.push({
      tag: "script",
      attrs: { type: "application/ld+json" },
      text: jsonLdText({ "@context": "https://schema.org", "@graph": graph }),
    })
  }

  return tags
}

function renderTag(tag: HeadTag, index: number) {
  switch (tag.tag) {
    case "title":
      return <title key={index}>{tag.text}</title>
    case "link":
      return <link key={index} {...tag.attrs} />
    case "script":
      return (
        <script
          key={index}
          {...tag.attrs}
          // The body is JSON this module serialised, with `<` escaped; see `jsonLdText`.
          dangerouslySetInnerHTML={{ __html: tag.text ?? "" }}
        />
      )
    default:
      return <meta key={index} {...tag.attrs} />
  }
}

/**
 * Render the head tag set for a page.
 *
 * The fragment goes wherever the host framework puts head tags — `<Head>` in Fresh, a
 * `<HeadContent>` in a custom `_app.tsx`, or straight into an SSR string. The component itself
 * touches no framework and no global, so it also renders under `preact-render-to-string` in a
 * test with no head pipeline at all.
 */
export function SEOHead(head: PageHead): JSX.Element {
  return <>{seoHeadTags(head).map(renderTag)}</>
}
