import { join } from "@spy4x/preact-cn/join"
import type { JSX } from "preact"
import { useFormat } from "./format.tsx"
import { useLabels } from "./i18n.tsx"

/** One post of a {@link PostList}. */
export interface PostListItem {
  /** Where the title links to. */
  href: string
  /** The post's title, the row's link text. */
  title: string
  /** One or two sentences, cut to two lines. Left out, the row has no description. */
  description?: string
  /** The day the post went live, as an ISO 8601 instant or date. Shown in UTC, so every reader sees one day. */
  publishedAt: string
  /** The reading time in whole minutes. Left out, the row shows the date alone. */
  readMinutes?: number
  /**
   * The language of the title and the description, such as `"en"` for an English post on an
   * Arabic page, so a screen reader reads them in that language's voice. The date and the reading
   * time stay in the page's language. Left out, both are in the page's language.
   */
  lang?: string
  /**
   * The direction of the title and the description. Defaults to `"auto"` when `lang` is given, so
   * an English title keeps its punctuation at its end on a right-to-left page, and to the page's
   * direction otherwise.
   */
  dir?: "ltr" | "rtl" | "auto"
  /** The post's cover, beside the text from 640 px and above it on a phone. Left out, the row is text only. */
  image?: PostListImage
}

/**
 * The cover of a {@link PostListItem}. It has no `alt`: the title already names the row, so the
 * picture is decorative and drawn with `alt=""`.
 */
export interface PostListImage {
  /** The image, best a 16:9 one: the frame crops it to 16:9. */
  src: string
  /** Its intrinsic width, so the row keeps its size while the image loads. */
  width: number
  /** Its intrinsic height. */
  height: number
  /** Other sizes of the image, as an `<img srcset>`. */
  srcset?: string
  /** The `<img sizes>` that goes with `srcset`, such as `"(min-width: 640px) 192px, calc(100vw - 32px)"`. */
  sizes?: string
}

/** The words a {@link PostList} shows. */
export interface PostListLabels {
  /** The reading time. Default: `"6 min read"`. */
  readTime: (minutes: number) => string
}

/** The English words {@link PostList} shows when the caller passes none. */
export const POST_LIST_LABELS: PostListLabels = {
  readTime: (minutes) => `${minutes} min read`,
}

/** Props of {@link PostList}. */
export interface PostListProps {
  /** The posts, newest first. An empty list renders nothing, so the caller draws its own empty state. */
  posts: readonly PostListItem[]
  /** Level of each title's heading, `<h2>` to `<h4>`. Defaults to `2`. */
  headingLevel?: 2 | 3 | 4
  /** The list's accessible name, such as `"Read next"`. Left out, the list has none. */
  label?: string
  /** The words shown; see {@link POST_LIST_LABELS}. */
  labels?: Partial<PostListLabels>
  /**
   * The list is on the first screen: the first row's cover loads with `loading="eager"` and
   * `fetchpriority="high"`. Every other cover loads with `loading="lazy"`. Defaults to `false`.
   */
  eagerFirst?: boolean
  /** Utilities on the list. */
  class?: string
}

/** The title link: the whole row is its target, through a stretched `::after`. */
const LINK =
  "rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-hidden " +
  "after:absolute after:inset-0 after:rounded-primary focus-visible:after:ring-2 " +
  "focus-visible:after:ring-focus"

/** A row with a cover: the cover on top on a phone, beside the text from 640 px. */
const ROW_WITH_IMAGE =
  "relative flex flex-col gap-4 border-b border-subtle py-6 sm:flex-row sm:items-start sm:gap-6"

/** A cover's frame: full width and 16:9 on a phone, 192×108 beside the text from 640 px. */
const IMAGE =
  "order-first aspect-video h-auto w-full rounded-card border border-subtle bg-surface " +
  "object-cover sm:order-none sm:w-48 sm:shrink-0"

/**
 * A list of articles, as a blog's index or its "Read next": per row the day it went live and its
 * reading time, the title as a link, and a description cut to two lines, and an optional cover: above the text on a phone, beside it from 640 px.
 *
 * Plain markup and CSS, so it works on a server-rendered page with no JavaScript. The whole row
 * takes the click, while a screen reader hears one link per post, named by its title. The date is
 * a `<time datetime>` in the formatter of the nearest `FormatContext`, read in UTC.
 *
 * @param props The posts and options, see {@link PostListProps}.
 */
export function PostList(
  { posts, headingLevel = 2, label, labels, eagerFirst = false, class: className }: PostListProps,
): JSX.Element | null {
  const format = useFormat().utc()
  if (posts.length === 0) return null
  const words = useLabels("PostList", POST_LIST_LABELS, labels, { readTime: ["minutes"] })
  const Heading = `h${headingLevel}` as const
  return (
    <ul aria-label={label} class={join("border-t border-subtle", className)} data-e2e="post-list">
      {posts.map((post, index) => {
        // Only the post's own words take its language; the line about it is the page's.
        const own = { lang: post.lang, dir: post.dir ?? (post.lang ? "auto" : undefined) }
        const text = (
          <>
            <p class="text-sm text-muted tabular-nums">
              <time dateTime={post.publishedAt}>{format.date(post.publishedAt)}</time>
              {post.readMinutes !== undefined && ` · ${words.readTime(post.readMinutes)}`}
            </p>
            <Heading class="mt-1 text-lg font-semibold text-balance sm:text-xl">
              <a href={post.href} class={LINK} {...own}>{post.title}</a>
            </Heading>
            {post.description && (
              <p
                class="mt-1 line-clamp-2 text-base text-muted text-pretty [text-align:match-parent]"
                {...own}
              >
                {post.description}
              </p>
            )}
          </>
        )
        if (!post.image) {
          return <li key={post.href} class="relative border-b border-subtle py-6">{text}</li>
        }
        const eager = eagerFirst && index === 0
        // The stretched title link covers the picture too, so a click on it opens the post.
        return (
          <li key={post.href} class={ROW_WITH_IMAGE}>
            <div class="min-w-0 flex-1">{text}</div>
            <img
              src={post.image.src}
              srcset={post.image.srcset}
              sizes={post.image.sizes}
              width={post.image.width}
              height={post.image.height}
              alt=""
              loading={eager ? "eager" : "lazy"}
              fetchpriority={eager ? "high" : undefined}
              decoding="async"
              class={IMAGE}
            />
          </li>
        )
      })}
    </ul>
  )
}
